import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { platformAiGuard, consumeAiQuota, assertShopActive, ocrMonthlyGuard } from "@/lib/ai-guard";
import { OCR_EST_COST_USD, ocrCostUsd } from "@/lib/ai-catalog";
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

    const svc = createServiceClient();

    // ============================================================
    //  ด่านกันโควตารั่ว — ตรวจ 4 ส.ค. 2569 พบว่าทางนี้เผา token ได้โดยไม่ผ่านด่านกลาง
    //  ต้องเรียงแบบเดียวกับผู้ช่วย AI: เกราะแพลตฟอร์ม -> โควตาผู้ใช้ -> เพดานเฉพาะทาง
    // ============================================================

    // ด่าน 0: kill switch + เพดานค่า AI/วันของแพลตฟอร์ม
    // เดิมไม่มีด่านนี้ = ปิดสวิตช์ AI ทั้งระบบแล้วทางนี้ยังยิงออกอยู่
    const guard = await platformAiGuard(svc, "นำเข้าด้วยไฟล์ Excel/CSV ใช้ได้ตามปกติ");
    if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: 503 });

    // กิจการที่ถูกระงับต้องใช้ AI ไม่ได้ — ก่อนหน้านี้ทางนี้เป็นช่องหลุด (ดูคอมเมนต์ใน assertShopActive)
    const active = await assertShopActive(svc, shopId);
    if (!active.ok) return NextResponse.json({ ok: false, error: active.error }, { status: 403 });

    // ⚠️ ลำดับด่านสำคัญมาก (แก้จากผลรีวิว 4 ส.ค. 2569)
    // เดิมเรียกโควตากลางก่อนแล้วค่อยเช็คเพดานนำเข้า -> ร้านที่นำเข้าครบ 20 ไฟล์แล้ว
    // กดไฟล์ที่ 21 จะโดน "ตัดโควตาผู้ช่วย AI" ทิ้งฟรีแล้วค่อยถูกปฏิเสธ กด 10 ครั้ง = หาย 10 หน่วย
    // ด่านที่ "ปฏิเสธเฉย ๆ" ต้องอยู่ก่อนด่านที่ "ตัดโควตา" เสมอ

    // ด่าน 1: เพดานเฉพาะการนำเข้า — AI อ่านไฟล์ใช้ key ของแพลตฟอร์ม ต้องกันกดรัว
    // fail-closed: นับไม่ได้ = ไม่ให้ใช้ (เดิม (used ?? 0) ทำให้คิวรีพังแล้วปล่อยผ่าน)
    const IMPORT_LIMIT_PER_DAY = 20;
    const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count: used, error: countErr } = await svc.from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId).eq("purpose", "ocr").like("model", "import/%").gte("created_at", dayAgo);
    // ⚠️ ใช้ Number.isFinite ไม่ใช่ == null — PostgREST ตอบ Content-Range: */* ได้
    // แล้ว parseInt ได้ NaN ซึ่ง NaN == null เป็นเท็จ และ NaN >= 20 ก็เป็นเท็จ = หลุดทั้งสองด่าน
    if (countErr || !Number.isFinite(used)) {
      console.error("import-extract นับโควตาไม่สำเร็จ", countErr?.message ?? `count=${String(used)}`);
      return NextResponse.json({ ok: false, error: "ตรวจโควตาไม่สำเร็จ ลองใหม่อีกครั้ง — ระหว่างนี้นำเข้าด้วยไฟล์ Excel/CSV ได้ตามปกติ" }, { status: 503 });
    }
    if ((used as number) >= IMPORT_LIMIT_PER_DAY) {
      return NextResponse.json({ ok: false, error: `ครบโควตานำเข้าด้วย AI ในรอบ 24 ชม.แล้ว (${IMPORT_LIMIT_PER_DAY} ไฟล์) — รอครบรอบแล้วนำเข้าต่อได้ หรือใช้ไฟล์ Excel/CSV แทน (ไม่จำกัด)` }, { status: 429 });
    }

    // เพดาน OCR ต่อเดือนตามแพ็ก — ปฏิเสธเฉย ๆ จึงอยู่ก่อนด่านที่ตัดโควตา
    const ocrCap = await ocrMonthlyGuard(svc, shopId);
    if (!ocrCap.ok) {
      return NextResponse.json({ ok: false, error: ocrCap.error, quotaExceeded: ocrCap.quotaExceeded },
        { status: ocrCap.quotaExceeded ? 429 : 503 });
    }

    // ด่าน 2: โควตา AI ของผู้ใช้ (ต่อวัน/ต่อเดือน) — ตัวนี้ "ตัดโควตา" จึงต้องอยู่ท้ายสุด
    // เดิมทางนี้ไม่ถูกนับเลย แพ็กที่เขียนว่า "30 คำสั่ง/วัน" ใช้เกินได้ผ่านหน้านำเข้าสินค้า
    const quota = await consumeAiQuota(svc, shopId, "นำเข้าด้วยไฟล์ Excel/CSV ใช้ได้ไม่จำกัด");
    if (!quota.ok) {
      return NextResponse.json({ ok: false, error: quota.error, quotaExceeded: quota.quotaExceeded },
        { status: quota.quotaExceeded ? 429 : 503 });
    }

    // แปลง base64 หลังผ่านด่านครบแล้วเท่านั้น — สตริงที่ได้ใหญ่ราว 5.6MB
    // ถ้าแปลงก่อน ทุกคำขอที่ถูกปฏิเสธ (สวิตช์ปิด/โควตาเต็ม/เกินเพดาน) จะเผา CPU+แรมทิ้งฟรี
    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");

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
    // สะสมต้นทุนของทุกเอนจินที่ยิงไปแล้ว — ตัวที่พังก็เสียเงินไปแล้วเหมือนกัน
    let spentUsd = 0;
    for (const eng of engines) {
      spentUsd += ocrCostUsd(eng.name);
      try {
        const rows = await eng.run();
        await svc.from("ai_usage_logs").insert({ shop_id: shopId, purpose: "ocr", model: `import/${eng.name}`, cost_usd: spentUsd });
        return NextResponse.json({ ok: true, rows, engine: eng.name });
      } catch (e) {
        lastErr = (e as Error).message;
        console.error(`import-extract ${eng.name} failed`, lastErr);
      }
    }
    // ⚠️ พังทุกเอนจินก็ต้องบันทึก — ยิงผู้ให้บริการจริงไปแล้วสูงสุด 4 ค่าย
    // เดิมบันทึกเฉพาะตอนสำเร็จ ไฟล์เสียใบเดียวจึงกดซ้ำเผา token ได้ไม่จำกัด
    // โดยตัวนับทุกชั้น (โควตาผู้ใช้/เพดานนำเข้า/เพดานแพลตฟอร์ม) มองไม่เห็นเลย
    try {
      await svc.from("ai_usage_logs").insert({ shop_id: shopId, purpose: "ocr", model: "import/failed", cost_usd: spentUsd || OCR_EST_COST_USD });
    } catch { /* บันทึกไม่สำเร็จอย่าไปทับ error จริงของผู้ใช้ */ }
    return NextResponse.json({ ok: false, error: friendlyAiError(lastErr) });
  } catch (e) {
    const m = (e as Error).message;
    if (m.includes("forbidden")) return NextResponse.json({ ok: false, error: "เฉพาะเจ้าของ/ผู้ดูแลร้านนำเข้าสินค้าได้" }, { status: 403 });
    return NextResponse.json({ ok: false, error: `เกิดข้อผิดพลาด: ${m.slice(0, 200)}` }, { status: 500 });
  }
}
