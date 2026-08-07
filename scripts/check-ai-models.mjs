// ============================================================
//  ตรวจว่าโมเดล AI ที่ระบบตั้งไว้ "ยังมีอยู่จริงและตอบได้" (เพิ่ม 8 ส.ค. 2569)
//
//  ⚠️ ทำไมต้องมี — เจอจริงวันนี้ 2 อย่างพร้อมกัน:
//   1. purpose "chat" ตั้งไว้เป็น gemini-2.5-flash-lite ซึ่ง Google ยกเลิกไปแล้ว
//      ยิงจริงได้ 404 "no longer available to new users"
//      = ผู้ช่วย AI บนหน้าแรกที่คนแปลกหน้าคุยด้วย ตายสนิททุกครั้งที่มีคนพิมพ์
//      และไม่มีใครรู้ เพราะฝั่งผู้ใช้เห็นแค่ข้อความขอโทษ ไม่ได้เห็น 404
//   2. purpose "assistant" ตั้งไว้เป็น gemini-2.5-flash ซึ่งคืนคำตอบว่างเปล่า
//      (finishReason STOP · output 0 token) กับคำถามปกติหลายแบบแบบซ้ำได้ทุกครั้ง
//
//  ผู้ให้บริการโมเดลปลดโมเดลเก่าออกได้ตลอดเวลาโดยไม่แจ้งเรา
//  ของที่พังแบบนี้จะไม่มีใครรู้จนกว่าจะมีลูกค้ามาบ่น — ต้องมีคนถามแทนเราทุกครั้งก่อน deploy
//
//  วิธีใช้:  npm run check:models     (ต้องมี .env.local ที่มี service role key)
// ============================================================
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("\n== โมเดล AI ==\n  ข้าม (ไม่มี service role key ในเครื่องนี้)\n");
  process.exit(0);
}

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let failures = 0;
console.log("\n== โมเดล AI ที่ระบบตั้งไว้ ==");

const [{ data: purposeRows }, { data: settingRows }] = await Promise.all([
  svc.from("ai_purpose_keys").select("purpose,provider,model"),
  svc.from("ai_settings").select("purpose,tier,provider,model,enabled"),
]);

// รวมทุกที่ที่ตั้งชื่อโมเดลไว้ — ตัวไหนตายก็พังหมดไม่ว่าจะตั้งไว้ตรงไหน
const wanted = [
  ...(purposeRows ?? []).map((r) => ({ where: `ai_purpose_keys/${r.purpose}`, ...r })),
  ...(settingRows ?? []).filter((r) => r.enabled).map((r) => ({ where: `ai_settings/${r.purpose}:${r.tier}`, ...r })),
];

const googleModels = new Set();
const { data: gkey } = await svc.rpc("get_ai_key", { p_provider: "google" });
if (gkey) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${gkey}`);
  if (res.ok) {
    const j = await res.json();
    for (const m of j.models ?? []) googleModels.add(String(m.name).replace("models/", ""));
  }
}

for (const w of wanted) {
  if (w.provider !== "google") { console.log(`  ข้าม  ${w.where}: ${w.provider}/${w.model} (ตรวจได้เฉพาะ Google ตอนนี้)`); continue; }
  if (!gkey) { console.log(`  ข้าม  ${w.where}: ไม่มีคีย์ Google ใน Vault`); continue; }

  // ⚠️ อยู่ในรายการ ListModels ไม่พอ — flash-lite ยังโผล่ในรายการทั้งที่ยิงจริงได้ 404
  // ต้องยิงของจริงเท่านั้นถึงจะรู้ว่าใช้ได้
  //
  // ⚠️ โมเดลฝังเวกเตอร์ (embedding) ใช้คำสั่ง :embedContent ไม่ใช่ :generateContent
  // ยิงผิดคำสั่งจะได้ 404 แล้วรายงานว่าโมเดลตาย ทั้งที่มันปกติดี
  // (ตัวตรวจนี้เคยรายงานผิดแบบนั้นตอนเขียนครั้งแรก — คำเตือนที่ผิดทำลายความเชื่อถือของด่านทั้งชุด)
  const isEmbedding = w.purpose === "embedding";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${w.model}:${isEmbedding ? "embedContent" : "generateContent"}?key=${gkey}`;
  const body = isEmbedding
    ? { model: `models/${w.model}`, content: { parts: [{ text: "ok" }] } }
    : { contents: [{ role: "user", parts: [{ text: "ok" }] }], generationConfig: { maxOutputTokens: 16 } };
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (res.ok) {
    console.log(`  ถูก  ${w.where}: ${w.model}`);
  } else {
    failures++;
    const msg = (await res.text()).replace(/\s+/g, " ").slice(0, 120);
    console.log(`  ผิด  ${w.where}: ${w.model} ใช้ไม่ได้ (${res.status}) ${msg}`);
    if (!googleModels.has(w.model)) console.log(`        และไม่อยู่ในรายการโมเดลของบัญชีนี้ด้วย`);
  }
}

console.log(failures === 0
  ? "  ถูก  ทุกโมเดลที่ตั้งไว้ยิงจริงแล้วตอบได้\n"
  : `\nสรุป: ${failures} โมเดลใช้ไม่ได้ — ฟีเจอร์ที่ใช้โมเดลนั้นตายอยู่ตอนนี้ ต้องเปลี่ยนทันที\n`);
process.exit(failures === 0 ? 0 : 1);
