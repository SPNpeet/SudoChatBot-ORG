// ============================================================
//  ทดสอบคุณภาพผู้ช่วยบัญชี AI โดย "ไม่เขียนข้อมูลจริงสักตัว"
//
//  ⚠️ ทำไมต้องมี (6 ส.ค. 2569): เจ้าของแจ้งว่า "ตอบไม่ได้เรื่องเลยทุกด้าน
//  ใบเสนอราคาก็ไม่ออกให้" แต่เราไม่มีบันทึกบทสนทนาฝั่ง server เลย
//  (แชทเก็บใน localStorage ของเบราว์เซอร์ลูกค้าเท่านั้น) จึงเถียงกันด้วยความรู้สึก
//  ไม่ได้ด้วยหลักฐาน — ไฟล์นี้ทำให้ "AI ตอบดีขึ้นไหม" กลายเป็นตัวเลขที่วัดซ้ำได้
//
//  วิธีทำงาน: ส่ง system prompt + tools ชุดเดียวกับของจริงไปให้โมเดล
//  แล้วดูว่ามัน "ขอเรียก tool อะไร" — แต่ไม่รัน executeTool
//  จึงไม่มีเอกสาร ไม่มีบัญชี ไม่มีข้อมูลลูกค้าถูกแตะเลยแม้แต่แถวเดียว
//
//  วิธีใช้:  npx tsx scripts/assistant-dryrun.mjs [model ...]
//    ไม่ใส่ = เทียบ gemini-2.5-flash (ของจริงตอนนี้) กับ gemini-2.5-pro
// ============================================================
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { TOOLS, buildSystemPrompt } from "../src/app/dashboard/assistant/engine.ts";

// อ่าน .env.local เอง — สคริปต์นี้รันนอก Next.js
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: key } = await svc.rpc("get_ai_key", { p_provider: "google" });
if (!key) { console.error("ไม่พบคีย์ Google ใน Vault"); process.exit(1); }

// บริบทปลอม — ไม่มี shop จริง เพราะเราไม่รัน tool อยู่แล้ว
const ctx = { shopName: "ร้านทดสอบ", assistantName: "ผู้ช่วยบัญชี", history: [] };
const system = buildSystemPrompt(ctx);

// เคสที่เจ้าของบ่นตรง ๆ + เคสพื้นฐานที่ต้องผ่านให้ได้
const CASES = [
  { ชื่อ: "ออกใบเสนอราคา (ครบถ้วน)", ถาม: "ออกใบเสนอราคาค่าออกแบบเว็บไซต์ 25,000 บาท ให้บริษัท สยามเทรด บวก VAT ด้วย",
    ต้องเรียก: ["create_sales_doc"] },
  { ชื่อ: "ออกใบเสนอราคา (สั้นมาก)", ถาม: "ทำใบเสนอราคาให้หน่อย ค่าติดตั้งแอร์ 12,000 ให้คุณสมชาย",
    ต้องเรียก: ["create_sales_doc"] },
  { ชื่อ: "ออกใบแจ้งหนี้", ถาม: "ออกใบแจ้งหนี้ค่าบริการรายเดือน 8,000 บาท ให้ร้านกาแฟดี บวก VAT หัก ณ ที่จ่าย 3%",
    ต้องเรียก: ["create_sales_doc"] },
  { ชื่อ: "ถามยอดค้าง (อ่านอย่างเดียว)", ถาม: "ตอนนี้ใครค้างจ่ายเราอยู่บ้าง",
    ต้องเรียก: ["get_aging", "list_docs", "get_overview"] },   // get_aging คือคำตอบที่ถูกที่สุด — คำเฉลยเดิมลืมใส่
  { ชื่อ: "บันทึกค่าใช้จ่ายที่บอกชัดว่าจ่ายแล้ว", ถาม: "จ่ายค่าไฟไป 2,340 บาทแล้ววันนี้ บันทึกให้หน่อย",
    ต้องเรียก: ["create_expense"] },
  // ---- เคสของ tool ชุดใหม่ (8 ส.ค. 2569) ----
  // ⚠️ tool ที่เพิ่มเข้าไปแต่โมเดลไม่เคยเลือกใช้ = เท่ากับไม่ได้เพิ่ม
  // ต้องวัดว่าคำสั่งภาษาคนแบบที่ผู้ใช้พูดจริง ทำให้มันเลือกถูกตัวไหม
  { ชื่อ: "ขอลิงก์ส่งลูกค้า", ถาม: "ขอลิงก์ใบแจ้งหนี้ INV-2026-0001 ส่งให้ลูกค้าหน่อย",
    ต้องเรียก: ["get_doc_links", "get_doc"] },
  { ชื่อ: "ขอ PDF", ถาม: "ขอไฟล์ PDF ใบเสร็จ RC-2026-0004",
    ต้องเรียก: ["get_doc_links", "get_doc"] },
  { ชื่อ: "ใบลดหนี้", ถาม: "ลูกค้าคืนเก้าอี้สำนักงาน 2 ตัว ตัวละ 500 จากใบแจ้งหนี้ INV-2026-0001 ออกใบลดหนี้ให้หน่อย",
    ต้องเรียก: ["issue_credit_note"] },
  { ชื่อ: "ลงสมุดรายวันเอง", ถาม: "ลงรายวันปรับปรุง เดบิตค่าเช่า 5000 เครดิตค่าเช่าค้างจ่าย 5000",
    ต้องเรียก: ["add_journal_entry"] },
  { ชื่อ: "เพิ่มทรัพย์สิน", ถาม: "ซื้อโน้ตบุ๊ก Dell มา 45,000 บาท วันนี้ อายุใช้งาน 3 ปี บันทึกเข้าทะเบียนทรัพย์สินให้หน่อย",
    ต้องเรียก: ["add_fixed_asset"] },
  { ชื่อ: "ขอไฟล์ส่งนักบัญชี", ถาม: "ขอไฟล์ Excel ส่งสำนักงานบัญชีเดือนนี้",
    ต้องเรียก: ["get_report_files"] },
];

const models = process.argv.slice(2).length ? process.argv.slice(2) : ["gemini-2.5-flash", "gemini-2.5-pro"];
const tools = [{ functionDeclarations: TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }];

async function ask(model, text) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text }] }],
      // ⚠️ ต้องเท่ากับของจริงใน runGemini (8000) — ไม่งั้นชุดทดสอบวัดคนละอย่างกับที่ผู้ใช้เจอ
      // ที่ 4000 เคส "เพิ่มทรัพย์สิน" กับ "ใบลดหนี้" ตกทั้งที่ของจริงผ่าน (โมเดลคิดจนหมดโควตา)
      tools, generationConfig: { temperature: 0.3, maxOutputTokens: 8000 },
    }),
  });
  if (!res.ok) return { error: `${res.status} ${(await res.text()).slice(0, 200)}` };
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return {
    // ⚠️ ต้องรู้ finishReason ด้วย ไม่งั้นแยกไม่ออกระหว่าง "เลือก tool ไม่เป็น"
    // กับ "ตอบไม่ทันเพราะ token หมด" ซึ่งแก้คนละทางกันคนละเรื่อง
    finish: data.candidates?.[0]?.finishReason ?? "?",
    thought: data.usageMetadata?.thoughtsTokenCount ?? 0,
    calls: parts.filter((p) => p.functionCall).map((p) => p.functionCall.name),
    args: parts.filter((p) => p.functionCall).map((p) => p.functionCall.args),
    text: parts.filter((p) => typeof p.text === "string").map((p) => p.text).join(" ").trim(),
    inTok: data.usageMetadata?.promptTokenCount ?? 0,
    outTok: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

console.log(`\nทดสอบ ${CASES.length} เคส × ${models.length} โมเดล — ไม่มีการเขียนข้อมูลใด ๆ\n`);
const score = {};
for (const model of models) {
  score[model] = 0;
  console.log(`\n===== ${model} =====`);
  for (const c of CASES) {
    // ⚠️ ต้องลองซ้ำเหมือน production ไม่งั้นชุดทดสอบวัดสิ่งที่ผู้ใช้ไม่เคยเจอ
    // (engine ลองซ้ำได้ถึง 2 ครั้งเมื่อโมเดลตอบว่าง — ดูหมายเหตุใน runAssistant)
    let r = await ask(model, c.ถาม);
    let retries = 0;
    while (!r.error && !r.calls.length && !r.text && retries < 2) { r = await ask(model, c.ถาม); retries++; }
    if (r.error) { console.log(`  พัง  ${c.ชื่อ}: ${r.error}`); continue; }
    const ok = r.calls.some((n) => c.ต้องเรียก.includes(n));
    if (ok) score[model]++;
    console.log(`  ${ok ? "ผ่าน" : "ตก  "} ${c.ชื่อ}`);
    console.log(`        เรียก: ${r.calls.length ? r.calls.join(", ") : "(ไม่เรียก tool เลย)"}`);
    if (!ok) console.log(`        ควรเรียก: ${c.ต้องเรียก.join(" หรือ ")}`);
    if (r.text) console.log(`        ตอบ: ${r.text.slice(0, 160).replace(/\n/g, " ")}`);
    console.log(`        token: เข้า ${r.inTok} ออก ${r.outTok} คิด ${r.thought} · จบเพราะ ${r.finish}${retries ? ` · ลองซ้ำ ${retries} ครั้ง` : ""}`);
  }
}
console.log("\n===== สรุป =====");
for (const m of models) console.log(`  ${m}: ผ่าน ${score[m]}/${CASES.length} เคส`);
console.log("");
