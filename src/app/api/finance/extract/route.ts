import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { friendlyAiError } from "@/lib/ai-errors";

// ============================================================
//  AI อ่านเอกสารการเงิน (บิล/ใบเสร็จ/ใบกำกับภาษี/ใบแจ้งหนี้) -> JSON
//  ลำดับเอนจิน: Mistral OCR -> Gemini -> Claude -> GPT (ตาม key ที่มี)
//  อัปโหลดไฟล์เก็บใน bucket slips ให้ด้วย (แนบกับเอกสารที่บันทึก)
// ============================================================

export const maxDuration = 120;

export interface ExtractedBill {
  doc_kind?: "expense_bill" | "invoice" | "receipt" | "slip" | "unknown";
  vendor_name?: string;
  vendor_tax_id?: string;
  customer_name?: string;
  date?: string;               // YYYY-MM-DD
  doc_ref?: string;
  items?: { name: string; qty?: number; unit_price?: number }[];
  subtotal?: number;
  vat_amount?: number;
  wht_rate?: number;
  total?: number;
  category?: string;           // หมวดค่าใช้จ่ายที่เดา
}

const MAX_BYTES = 4 * 1024 * 1024;
const OK_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "image", "image/jpeg": "image", "image/webp": "image",
};

const EXTRACT_PROMPT = `คุณคือระบบอ่านเอกสารการเงินไทย (บิล ใบเสร็จ ใบกำกับภาษี ใบแจ้งหนี้ สลิปโอนเงิน) ตอบเป็น JSON เท่านั้น (ไม่มีข้อความอื่น ไม่มี markdown fence)
อ่านเอกสารแล้วตอบตาม schema:
{"doc_kind": "expense_bill|invoice|receipt|slip|unknown", "vendor_name": "ชื่อผู้ขาย/ร้านที่ออกบิล", "vendor_tax_id": "เลขผู้เสียภาษี 13 หลักถ้ามี", "date": "วันที่เอกสาร YYYY-MM-DD", "doc_ref": "เลขที่เอกสารถ้ามี", "items": [{"name": "รายการ", "qty": จำนวน, "unit_price": ราคาต่อหน่วย}], "subtotal": มูลค่าก่อน VAT, "vat_amount": ยอด VAT (0 ถ้าไม่มี), "wht_rate": อัตราหัก ณ ที่จ่าย % (0 ถ้าไม่มี), "total": ยอดรวมสุทธิ, "category": "หมวดค่าใช้จ่ายที่เหมาะสุด เลือกจาก: ซื้อสินค้า/วัตถุดิบ, เงินเดือน/ค่าจ้าง, ค่าเช่า, ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต, ค่าขนส่ง/เดินทาง, การตลาด/โฆษณา, ค่าธรรมเนียม/บริการ, วัสดุ/อุปกรณ์สำนักงาน, ภาษี/ประกันสังคม, อื่น ๆ"}
กติกา:
- ตัวเลขตัดสัญลักษณ์สกุลเงิน/คอมมาให้เหลือตัวเลข เช่น "1,290.50 บาท" -> 1290.5
- วันที่ไทย พ.ศ. ให้แปลงเป็น ค.ศ. (เช่น 2569 -> 2026)
- ห้ามแต่งข้อมูลที่ไม่มีในเอกสาร ช่องที่ไม่รู้ให้เว้น
- ถ้ารายการเยอะ/อ่านไม่ครบ ใส่เฉพาะที่อ่านได้ชัด แล้วให้ total ตรงกับยอดรวมจริงในบิล`;

function parseBill(raw: string): ExtractedBill {
  let s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(start >= 0 && end > start ? s.slice(start, end + 1) : s);
  } catch {
    throw new Error("AI ตอบข้อมูลที่อ่านไม่ได้ — ลองใหม่หรือถ่ายรูปให้ชัดขึ้น");
  }
  const num = (v: unknown) => (v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Math.abs(Number(v)));
  return {
    doc_kind: ["expense_bill", "invoice", "receipt", "slip"].includes(String(parsed.doc_kind)) ? parsed.doc_kind as ExtractedBill["doc_kind"] : "unknown",
    vendor_name: parsed.vendor_name ? String(parsed.vendor_name).slice(0, 200) : undefined,
    vendor_tax_id: parsed.vendor_tax_id ? String(parsed.vendor_tax_id).replace(/[^0-9]/g, "").slice(0, 13) : undefined,
    date: typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : undefined,
    doc_ref: parsed.doc_ref ? String(parsed.doc_ref).slice(0, 60) : undefined,
    items: Array.isArray(parsed.items)
      ? (parsed.items as Record<string, unknown>[])
        .filter((it) => it && String(it.name ?? "").trim())
        .slice(0, 50)
        .map((it) => ({ name: String(it.name).slice(0, 200), qty: num(it.qty) ?? 1, unit_price: num(it.unit_price) ?? 0 }))
      : undefined,
    subtotal: num(parsed.subtotal),
    vat_amount: num(parsed.vat_amount),
    wht_rate: num(parsed.wht_rate),
    total: num(parsed.total),
    category: parsed.category ? String(parsed.category).slice(0, 100) : undefined,
  };
}

async function extractWithMistral(key: string, b64: string, mime: string): Promise<ExtractedBill> {
  const kind = mime === "application/pdf" ? "document_url" : "image_url";
  const ocrRes = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document: kind === "document_url"
        ? { type: "document_url", document_url: `data:${mime};base64,${b64}` }
        : { type: "image_url", image_url: `data:${mime};base64,${b64}` },
    }),
  });
  if (!ocrRes.ok) throw new Error(`mistral ${ocrRes.status}: ${(await ocrRes.text()).slice(0, 300)}`);
  const ocr = await ocrRes.json();
  const markdown = ((ocr.pages ?? []) as { markdown?: string }[]).map((p) => p.markdown ?? "").join("\n\n").slice(0, 60000);
  if (!markdown.trim()) throw new Error("OCR อ่านไม่พบข้อความในไฟล์ — ไฟล์อาจว่างหรือภาพไม่ชัด");

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "mistral-small-latest",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACT_PROMPT },
        { role: "user", content: `เนื้อหาเอกสาร (จาก OCR):\n\n${markdown}` },
      ],
      max_tokens: 4000,
    }),
  });
  if (!res.ok) throw new Error(`mistral ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return parseBill(j.choices?.[0]?.message?.content ?? "");
}

async function extractWithGemini(key: string, b64: string, mime: string): Promise<ExtractedBill> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: EXTRACT_PROMPT }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8000 },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const text = ((j.candidates?.[0]?.content?.parts ?? []) as { text?: string }[]).map((p) => p.text ?? "").join("");
  return parseBill(text);
}

async function extractWithAnthropic(key: string, b64: string, mime: string): Promise<ExtractedBill> {
  const block = mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
    : { type: "image", source: { type: "base64", media_type: mime, data: b64 } };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001", max_tokens: 4000,
      messages: [{ role: "user", content: [block, { type: "text", text: EXTRACT_PROMPT }] }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const text = ((j.content ?? []) as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  return parseBill(text);
}

async function extractWithOpenAI(key: string, b64: string, mime: string): Promise<ExtractedBill> {
  const part = mime === "application/pdf"
    ? { type: "file", file: { filename: "bill.pdf", file_data: `data:application/pdf;base64,${b64}` } }
    : { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: [part, { type: "text", text: EXTRACT_PROMPT }] }],
      max_completion_tokens: 4000,
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return parseBill(j.choices?.[0]?.message?.content ?? "");
}

export async function POST(request: Request) {
  try {
    const fd = await request.formData();
    const shopId = String(fd.get("shop_id") ?? "");
    const file = fd.get("file") as File | null;
    if (!shopId || !file) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ครบ" }, { status: 400 });
    await assertMember(shopId, ["owner", "admin", "agent"]);

    const mime = file.type;
    if (!OK_TYPES[mime]) return NextResponse.json({ ok: false, error: "รองรับเฉพาะ PDF, PNG, JPG, WebP" });
    if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกิน 4MB — ลดขนาดแล้วลองใหม่" });

    const buf = Buffer.from(await file.arrayBuffer());
    const b64 = buf.toString("base64");
    const svc = createServiceClient();

    // เพดานรายวันกันกดรัว (AI ใช้ key ของแพลตฟอร์ม)
    const EXTRACT_LIMIT_PER_DAY = 60;
    const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count: used } = await svc.from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId).eq("purpose", "ocr").like("model", "finance/%").gte("created_at", dayAgo);
    if ((used ?? 0) >= EXTRACT_LIMIT_PER_DAY) {
      return NextResponse.json({ ok: false, error: `ครบโควตา AI อ่านเอกสารวันนี้แล้ว (${EXTRACT_LIMIT_PER_DAY} ไฟล์/วัน) — พรุ่งนี้ใช้ต่อได้ หรือคีย์เองได้ไม่จำกัด` });
    }

    // เก็บไฟล์ไว้แนบเอกสาร (bucket slips เป็น private)
    const path = `${shopId}/finance/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-ก-๙]/g, "_")}`;
    await svc.storage.from("slips").upload(path, buf, { contentType: mime });

    const keyOf = async (p: string) => (await svc.rpc("get_ai_key", { p_provider: p })).data as string | null;
    const engines: { name: string; run: () => Promise<ExtractedBill> }[] = [];
    const mistral = await keyOf("mistral");
    if (mistral) engines.push({ name: "mistral-ocr", run: () => extractWithMistral(mistral, b64, mime) });
    const google = await keyOf("google");
    if (google) engines.push({ name: "gemini", run: () => extractWithGemini(google, b64, mime) });
    const anthropic = await keyOf("anthropic");
    if (anthropic) engines.push({ name: "claude", run: () => extractWithAnthropic(anthropic, b64, mime) });
    const openai = await keyOf("openai");
    if (openai) engines.push({ name: "gpt", run: () => extractWithOpenAI(openai, b64, mime) });

    if (!engines.length) {
      return NextResponse.json({ ok: false, error: "ยังไม่มี AI key ที่อ่านไฟล์ได้ — ผู้ดูแลแพลตฟอร์มต้องใส่ key ของ Mistral / Gemini / Claude / GPT อย่างน้อย 1 ค่าย ในหน้า ศูนย์ AI (Admin)", file_path: path });
    }

    let lastErr = "";
    for (const eng of engines) {
      try {
        const data = await eng.run();
        await svc.from("ai_usage_logs").insert({ shop_id: shopId, purpose: "ocr", model: `finance/${eng.name}`, cost_usd: 0 });
        return NextResponse.json({ ok: true, data, engine: eng.name, file_path: path });
      } catch (e) {
        lastErr = (e as Error).message;
        console.error(`finance-extract ${eng.name} failed`, lastErr);
      }
    }
    return NextResponse.json({ ok: false, error: friendlyAiError(lastErr), file_path: path });
  } catch (e) {
    const m = (e as Error).message;
    if (m.includes("forbidden")) return NextResponse.json({ ok: false, error: "คุณไม่มีสิทธิ์ใช้งานส่วนนี้" }, { status: 403 });
    return NextResponse.json({ ok: false, error: `เกิดข้อผิดพลาด: ${m.slice(0, 200)}` }, { status: 500 });
  }
}
