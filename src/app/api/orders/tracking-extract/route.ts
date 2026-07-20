import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { friendlyAiError } from "@/lib/ai-errors";

// ============================================================
//  อ่านรูป/PDF ฉลากพัสดุ-ใบนำส่ง -> เลขพัสดุ + จับคู่ออเดอร์ (JSON)
//  โครงเดียวกับ /api/products/import-extract: Mistral OCR -> Gemini -> Claude -> GPT
// ============================================================

export const maxDuration = 120;

export interface TrackingExtractRow {
  tracking_number: string;
  order_number?: string;
  customer_name?: string;
  phone?: string;
  // เติมฝั่ง server หลังจับคู่:
  matched_order_number?: string;
  match_by?: "order_number" | "name" | "phone";
}

const MAX_BYTES = 4 * 1024 * 1024;
const OK_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "image", "image/jpeg": "image", "image/webp": "image",
};

const EXTRACT_PROMPT = `คุณคือระบบอ่านฉลากพัสดุ/ใบนำส่งของขนส่งไทย (Flash, Kerry, J&T, ไปรษณีย์ไทย, DHL ฯลฯ) ตอบเป็น JSON เท่านั้น (ไม่มีข้อความอื่น ไม่มี markdown fence)
ดึง "รายการพัสดุ" ทั้งหมดในเอกสารเป็น JSON array ตาม schema:
[{"tracking_number": "เลขพัสดุ (จำเป็น เช่น TH1234567890, KEX..., EMS EX...TH)", "order_number": "เลขออเดอร์ของร้าน ถ้าเห็นในเอกสาร", "customer_name": "ชื่อผู้รับ ถ้ามี", "phone": "เบอร์ผู้รับ ถ้ามี (เฉพาะตัวเลข)"}]
กติกา:
- เลขพัสดุมักเป็นตัวอักษร+ตัวเลข 10-20 หลัก อยู่ใต้บาร์โค้ด — อ่านให้ครบทุกตัวอักษร ห้ามเดา ห้ามแต่ง
- 1 ฉลาก = 1 รายการ (เอกสารอาจมีหลายฉลาก)
- ช่องที่อ่านไม่ชัด/ไม่มี ให้เว้น (ยกเว้น tracking_number ถ้าอ่านไม่ชัดให้ข้ามรายการนั้น)
- ถ้าไม่พบเลขพัสดุเลย ตอบ []`;

function parseRows(raw: string): TrackingExtractRow[] {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(start >= 0 && end > start ? s.slice(start, end + 1) : s);
  } catch {
    throw new Error("AI ตอบข้อมูลที่อ่านไม่ได้ — ลองใหม่ หรือถ่ายรูปให้ชัดขึ้น");
  }
  const arr = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown[] })?.items;
  if (!Array.isArray(arr)) throw new Error("ไม่พบเลขพัสดุในผลลัพธ์");
  return arr
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      tracking_number: String(r.tracking_number ?? "").trim().slice(0, 60),
      order_number: r.order_number ? String(r.order_number).trim().slice(0, 60) : undefined,
      customer_name: r.customer_name ? String(r.customer_name).trim().slice(0, 120) : undefined,
      phone: r.phone ? String(r.phone).replace(/[^0-9]/g, "").slice(0, 15) : undefined,
    }))
    .filter((r) => r.tracking_number.length >= 8)
    .slice(0, 100);
}

// ---- Mistral: OCR แล้วจัดโครงสร้าง ----
async function extractWithMistral(key: string, b64: string, mime: string): Promise<TrackingExtractRow[]> {
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
  if (!markdown.trim()) throw new Error("OCR อ่านไม่พบข้อความ — ภาพอาจไม่ชัด");

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "mistral-small-latest",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACT_PROMPT + `\nตอบเป็น JSON object รูปแบบ {"items": [...]}` },
        { role: "user", content: `เนื้อหาเอกสาร (จาก OCR):\n\n${markdown}` },
      ],
      max_tokens: 4000,
    }),
  });
  if (!res.ok) throw new Error(`mistral ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return parseRows(j.choices?.[0]?.message?.content ?? "");
}

async function extractWithGemini(key: string, b64: string, mime: string): Promise<TrackingExtractRow[]> {
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
  return parseRows(text);
}

async function extractWithAnthropic(key: string, b64: string, mime: string): Promise<TrackingExtractRow[]> {
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
  return parseRows(text);
}

async function extractWithOpenAI(key: string, b64: string, mime: string): Promise<TrackingExtractRow[]> {
  const part = mime === "application/pdf"
    ? { type: "file", file: { filename: "labels.pdf", file_data: `data:application/pdf;base64,${b64}` } }
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
  return parseRows(j.choices?.[0]?.message?.content ?? "");
}

export async function POST(request: Request) {
  try {
    const fd = await request.formData();
    const shopId = String(fd.get("shop_id") ?? "");
    const file = fd.get("file") as File | null;
    if (!shopId || !file) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ครบ" }, { status: 400 });
    await assertMember(shopId, ["owner", "admin", "agent"]);

    const mime = file.type;
    if (!OK_TYPES[mime]) return NextResponse.json({ ok: false, error: "รองรับเฉพาะรูป PNG/JPG/WebP หรือ PDF (ไฟล์ Excel/CSV ระบบอ่านเองไม่ต้องใช้ AI)" });
    if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกิน 4MB — ลดขนาดแล้วลองใหม่" });

    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const svc = createServiceClient();

    // เพดานรายวันร่วมกับนำเข้าสินค้า (AI ใช้ key แพลตฟอร์ม)
    const LIMIT_PER_DAY = 20;
    const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count: used } = await svc.from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId).eq("purpose", "ocr").like("model", "tracking/%").gte("created_at", dayAgo);
    if ((used ?? 0) >= LIMIT_PER_DAY) {
      return NextResponse.json({ ok: false, error: `ครบโควตาอ่านฉลากด้วย AI วันนี้แล้ว (${LIMIT_PER_DAY} ไฟล์/วัน) — กรอกเลขเอง หรือใช้ไฟล์ Excel/CSV แทน (ไม่จำกัด)` });
    }
    const keyOf = async (p: string) => (await svc.rpc("get_ai_key", { p_provider: p })).data as string | null;

    const engines: { name: string; run: () => Promise<TrackingExtractRow[]> }[] = [];
    const mistral = await keyOf("mistral");
    if (mistral) engines.push({ name: "mistral-ocr", run: () => extractWithMistral(mistral, b64, mime) });
    const google = await keyOf("google");
    if (google) engines.push({ name: "gemini", run: () => extractWithGemini(google, b64, mime) });
    const anthropic = await keyOf("anthropic");
    if (anthropic) engines.push({ name: "claude", run: () => extractWithAnthropic(anthropic, b64, mime) });
    const openai = await keyOf("openai");
    if (openai) engines.push({ name: "gpt", run: () => extractWithOpenAI(openai, b64, mime) });

    if (!engines.length) {
      return NextResponse.json({ ok: false, error: "ยังไม่มี AI key ที่อ่านรูปได้ — ผู้ดูแลแพลตฟอร์มต้องใส่ key ของ Mistral / Gemini / Claude / GPT อย่างน้อย 1 ค่าย" });
    }

    let rows: TrackingExtractRow[] | null = null;
    let engineUsed = "";
    let lastErr = "";
    for (const eng of engines) {
      try {
        rows = await eng.run();
        engineUsed = eng.name;
        break;
      } catch (e) {
        lastErr = (e as Error).message;
        console.error(`tracking-extract ${eng.name} failed`, lastErr);
      }
    }
    if (!rows) return NextResponse.json({ ok: false, error: friendlyAiError(lastErr) });
    await svc.from("ai_usage_logs").insert({ shop_id: shopId, purpose: "ocr", model: `tracking/${engineUsed}`, cost_usd: 0 });

    // ---- จับคู่ออเดอร์ที่รอจัดส่ง: เลขออเดอร์ > ชื่อผู้รับ > เบอร์ ----
    const { data: openOrders } = await svc.from("orders")
      .select("order_number, shipping_name, shipping_phone")
      .eq("shop_id", shopId).in("status", ["paid", "confirmed"]).limit(500);
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
    const byNumber = new Map((openOrders ?? []).map((o) => [norm(o.order_number as string), o.order_number as string]));
    const byName = new Map<string, string>();
    const byPhone = new Map<string, string>();
    for (const o of openOrders ?? []) {
      if (o.shipping_name) byName.set(norm(o.shipping_name as string), o.order_number as string);
      if (o.shipping_phone) byPhone.set(String(o.shipping_phone).replace(/[^0-9]/g, ""), o.order_number as string);
    }
    for (const r of rows) {
      if (r.order_number && byNumber.has(norm(r.order_number))) {
        r.matched_order_number = byNumber.get(norm(r.order_number)); r.match_by = "order_number";
      } else if (r.customer_name && byName.has(norm(r.customer_name))) {
        r.matched_order_number = byName.get(norm(r.customer_name)); r.match_by = "name";
      } else if (r.phone && byPhone.has(r.phone)) {
        r.matched_order_number = byPhone.get(r.phone); r.match_by = "phone";
      }
    }

    return NextResponse.json({ ok: true, rows, engine: engineUsed });
  } catch (e) {
    const m = (e as Error).message;
    if (m.includes("forbidden")) return NextResponse.json({ ok: false, error: "คุณไม่มีสิทธิ์จัดการออเดอร์ในร้านนี้" }, { status: 403 });
    return NextResponse.json({ ok: false, error: `เกิดข้อผิดพลาด: ${m.slice(0, 200)}` }, { status: 500 });
  }
}
