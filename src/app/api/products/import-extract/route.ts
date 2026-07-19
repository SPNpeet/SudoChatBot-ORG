import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { friendlyAiError } from "@/lib/ai-errors";

// ============================================================
//  อ่านไฟล์ PDF/รูปแคตตาล็อกสินค้า -> รายการสินค้า (JSON)
//  ลำดับเอนจิน: Mistral OCR (ถ้ามี key) -> vision ของค่ายที่มี key
//  (Gemini / Claude / GPT อ่าน PDF+รูปได้ตรง)
// ============================================================

export const maxDuration = 120; // Vercel: ไฟล์หลายหน้าอาจใช้เวลา

export interface ImportRow {
  name: string; sku?: string; category?: string;
  price: number; stock?: number; description?: string;
  variants?: { name: string; sku?: string; price: number | null; stock: number }[];
}

const MAX_BYTES = 4 * 1024 * 1024; // Vercel function body limit ~4.5MB
const OK_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "image", "image/jpeg": "image", "image/webp": "image",
};

const EXTRACT_PROMPT = `คุณคือระบบแปลงแคตตาล็อกสินค้าเป็นข้อมูล ตอบเป็น JSON เท่านั้น (ไม่มีข้อความอื่น ไม่มี markdown fence)
อ่านเอกสารแล้วดึง "รายการสินค้า" ทั้งหมดออกมาเป็น JSON array ตาม schema นี้:
[{"name": "ชื่อสินค้า (จำเป็น)", "sku": "รหัส ถ้ามี", "category": "หมวดหมู่ ถ้ามี", "price": ราคาเป็นตัวเลข (จำเป็น ถ้าไม่รู้ใส่ 0), "stock": จำนวนสต๊อกเป็นตัวเลข ถ้าไม่รู้ใส่ 0, "description": "รายละเอียด/จุดเด่น ถ้ามี", "variants": [{"name": "ตัวเลือกย่อย เช่น สี/ไซซ์", "price": ราคาตัวเลือกหรือ null ถ้าใช้ราคาหลัก, "stock": จำนวน}] }]
กติกา:
- แถวในตาราง 1 แถว = สินค้า 1 ตัว (ถ้าเป็นตัวเลือกย่อยของสินค้าเดียวกัน เช่น สี/ไซซ์ ให้รวมเป็น variants ของสินค้านั้น)
- ราคา: ตัดสัญลักษณ์สกุลเงิน/คอมมา ให้เหลือตัวเลข เช่น "1,290 บาท" -> 1290
- ห้ามแต่งข้อมูลที่ไม่มีในเอกสาร ช่องที่ไม่รู้ให้เว้น (ยกเว้น name/price)
- ถ้าไม่พบสินค้าเลย ตอบ []`;

function parseRows(raw: string): ImportRow[] {
  let s = raw.trim();
  // ตัด markdown fence ถ้าโมเดลใส่มา
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  // หา array แรกในข้อความ
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(start >= 0 && end > start ? s.slice(start, end + 1) : s);
  } catch {
    throw new Error("AI ตอบข้อมูลที่อ่านไม่ได้ — ลองใหม่อีกครั้ง หรือเปลี่ยนไฟล์ให้ชัดขึ้น");
  }
  const arr = Array.isArray(parsed) ? parsed : (parsed as { products?: unknown[] })?.products;
  if (!Array.isArray(arr)) throw new Error("ไม่พบรายการสินค้าในผลลัพธ์");
  return arr
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      name: String(r.name ?? "").trim().slice(0, 200),
      sku: r.sku ? String(r.sku).trim().slice(0, 60) : undefined,
      category: r.category ? String(r.category).trim().slice(0, 100) : undefined,
      price: Math.max(0, Number(r.price) || 0),
      stock: Math.max(0, parseInt(String(r.stock ?? 0), 10) || 0),
      description: r.description ? String(r.description).trim().slice(0, 2000) : undefined,
      variants: Array.isArray(r.variants)
        ? (r.variants as Record<string, unknown>[])
          .filter((v) => v && typeof v === "object" && String(v.name ?? "").trim())
          .slice(0, 50)
          .map((v) => ({
            name: String(v.name).trim().slice(0, 100),
            sku: v.sku ? String(v.sku).trim().slice(0, 60) : undefined,
            price: v.price === null || v.price === undefined || Number.isNaN(Number(v.price)) ? null : Math.max(0, Number(v.price)),
            stock: Math.max(0, parseInt(String(v.stock ?? 0), 10) || 0),
          }))
        : undefined,
    }))
    .filter((r) => r.name)
    .slice(0, 300);
}

// ---- Mistral: OCR เป็น markdown แล้วให้ mistral-small จัดโครงสร้าง ----
async function extractWithMistral(key: string, b64: string, mime: string): Promise<ImportRow[]> {
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
        { role: "system", content: EXTRACT_PROMPT + `\nตอบเป็น JSON object รูปแบบ {"products": [...]}` },
        { role: "user", content: `เนื้อหาเอกสาร (จาก OCR):\n\n${markdown}` },
      ],
      max_tokens: 8000,
    }),
  });
  if (!res.ok) throw new Error(`mistral ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return parseRows(j.choices?.[0]?.message?.content ?? "");
}

// ---- Gemini: อ่าน PDF/รูป inline ได้ตรง ----
async function extractWithGemini(key: string, b64: string, mime: string): Promise<ImportRow[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: EXTRACT_PROMPT }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 16000 },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const text = ((j.candidates?.[0]?.content?.parts ?? []) as { text?: string }[]).map((p) => p.text ?? "").join("");
  return parseRows(text);
}

// ---- Claude: document/image block ----
async function extractWithAnthropic(key: string, b64: string, mime: string): Promise<ImportRow[]> {
  const block = mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
    : { type: "image", source: { type: "base64", media_type: mime, data: b64 } };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001", max_tokens: 8000,
      messages: [{ role: "user", content: [block, { type: "text", text: EXTRACT_PROMPT }] }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const text = ((j.content ?? []) as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  return parseRows(text);
}

// ---- OpenAI: image_url / input file ----
async function extractWithOpenAI(key: string, b64: string, mime: string): Promise<ImportRow[]> {
  const part = mime === "application/pdf"
    ? { type: "file", file: { filename: "catalog.pdf", file_data: `data:application/pdf;base64,${b64}` } }
    : { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: [part, { type: "text", text: EXTRACT_PROMPT }] }],
      max_completion_tokens: 8000,
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
    await assertMember(shopId, ["owner", "admin"]);

    const mime = file.type;
    if (!OK_TYPES[mime]) return NextResponse.json({ ok: false, error: "รองรับเฉพาะ PDF, PNG, JPG, WebP (ไฟล์ Excel/CSV ระบบอ่านเองไม่ต้องใช้ AI)" });
    if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกิน 4MB — ลดขนาด/แยกไฟล์ แล้วลองใหม่" });

    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const svc = createServiceClient();

    // เพดานรายวัน — AI อ่านไฟล์ใช้ key ของแพลตฟอร์ม ต้องมีเพดานกันกดรัว
    const IMPORT_LIMIT_PER_DAY = 20;
    const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count: used } = await svc.from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId).eq("purpose", "ocr").like("model", "import/%").gte("created_at", dayAgo);
    if ((used ?? 0) >= IMPORT_LIMIT_PER_DAY) {
      return NextResponse.json({ ok: false, error: `ครบโควตานำเข้าด้วย AI วันนี้แล้ว (${IMPORT_LIMIT_PER_DAY} ไฟล์/วัน) — พรุ่งนี้นำเข้าต่อได้ หรือใช้ไฟล์ Excel/CSV แทน (ไม่จำกัด)` });
    }
    const keyOf = async (p: string) => (await svc.rpc("get_ai_key", { p_provider: p })).data as string | null;

    // ลำดับ: Mistral OCR (เก่งตาราง/สแกน) -> Gemini -> Claude -> GPT
    const engines: { name: string; run: () => Promise<ImportRow[]> }[] = [];
    const mistral = await keyOf("mistral");
    if (mistral) engines.push({ name: "mistral-ocr", run: () => extractWithMistral(mistral, b64, mime) });
    const google = await keyOf("google");
    if (google) engines.push({ name: "gemini", run: () => extractWithGemini(google, b64, mime) });
    const anthropic = await keyOf("anthropic");
    if (anthropic) engines.push({ name: "claude", run: () => extractWithAnthropic(anthropic, b64, mime) });
    const openai = await keyOf("openai");
    if (openai) engines.push({ name: "gpt", run: () => extractWithOpenAI(openai, b64, mime) });

    if (!engines.length) {
      return NextResponse.json({ ok: false, error: "ยังไม่มี AI key ที่อ่านไฟล์ได้ — ผู้ดูแลแพลตฟอร์มต้องใส่ key ของ Mistral / Gemini / Claude / GPT อย่างน้อย 1 ค่าย ในหน้า ศูนย์ AI (Admin)" });
    }

    let lastErr = "";
    for (const eng of engines) {
      try {
        const rows = await eng.run();
        await svc.from("ai_usage_logs").insert({ shop_id: shopId, purpose: "ocr", model: `import/${eng.name}`, cost_usd: 0 });
        return NextResponse.json({ ok: true, rows, engine: eng.name });
      } catch (e) {
        lastErr = (e as Error).message;
        console.error(`import-extract ${eng.name} failed`, lastErr);
      }
    }
    return NextResponse.json({ ok: false, error: friendlyAiError(lastErr) });
  } catch (e) {
    const m = (e as Error).message;
    if (m.includes("forbidden")) return NextResponse.json({ ok: false, error: "เฉพาะเจ้าของ/ผู้ดูแลร้านนำเข้าสินค้าได้" }, { status: 403 });
    return NextResponse.json({ ok: false, error: `เกิดข้อผิดพลาด: ${m.slice(0, 200)}` }, { status: 500 });
  }
}
