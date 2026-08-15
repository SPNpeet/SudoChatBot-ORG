// ============================================================
//  ตรวจว่า "ก้อนพื้น" ที่ส่งให้โมเดลทุกครั้ง ยัง cache ติดอยู่ (เพิ่ม 13 ส.ค. 2569)
//
//  ⚠️ ทำไมต้องมี
//  วัดจริง ส.ค. 2569: คำถามที่เล็กที่สุดในระบบยังใช้ input 4,386 โทเคน
//  เพราะ system prompt + schema ของ tool 26 ตัว ถูกส่งซ้ำทุกครั้ง และซ้ำทุกรอบของลูป agent
//  ก้อนซ้ำนี้คิดเป็นประมาณครึ่งหนึ่งของโทเคนทั้งเดือน
//
//  ทุกค่ายคิดราคาก้อนนี้ถูกลง (2-10 เท่า) **ถ้ามันเหมือนเดิมเป๊ะทุกตัวอักษร**
//  เติมอะไรที่เปลี่ยนทุกครั้งเข้าไปแม้ตัวเดียว เช่น เวลาเป็นวินาที เลขสุ่ม หรือ uuid
//  = cache ไม่ติดอีกเลย และ **ไม่มีอะไรพัง ไม่มี error ไม่มีใครรู้** จนกว่าจะไปเห็นบิล
//
//  กติกาข้อ 3 ของโปรเจกต์: "ถ้าต้องการให้ห้าม ให้ throw อย่าเขียน prompt ขอ"
//  คอมเมนต์เตือนในไฟล์ไม่พอ เพราะคนถัดไปจะไม่ได้อ่าน — ด่านนี้จึงหยุดที่ push
//
//  หมายเหตุ: วันที่แบบ YYYY-MM-DD (ไม่มีเวลา) อนุญาต — เปลี่ยนวันละครั้ง
//  cache ของทุกค่ายอายุสั้นกว่านั้นมาก จึงไม่กระทบ
// ============================================================
import { readFileSync } from "node:fs";

const SRC = "src/app/dashboard/assistant/engine.ts";
const code = readFileSync(SRC, "utf8");

let failures = 0;
const bad = (msg) => { failures++; console.log(`  ผิด  ${msg}`); };

console.log("\n== ก้อนพื้นที่ส่งให้โมเดลทุกครั้ง (cache ต้องติด) ==");

// ---- 1) ดึงตัวฟังก์ชัน buildSystemPrompt ออกมาทั้งก้อน ----
const start = code.indexOf("export function buildSystemPrompt");
if (start < 0) {
  bad("หา buildSystemPrompt ไม่เจอ — ตัวตรวจน่าจะพัง ไม่ใช่โค้ดถูก");
  console.log("\nสรุป: ไม่ผ่าน — ห้าม push\n");
  process.exit(1);
}
// นับวงเล็บปีกกาเพื่อหาจุดจบฟังก์ชัน (พอสำหรับไฟล์นี้ ไม่ต้องพึ่ง parser เต็ม)
let depth = 0, end = -1;
for (let i = code.indexOf("{", start); i < code.length; i++) {
  if (code[i] === "{") depth++;
  else if (code[i] === "}" && --depth === 0) { end = i + 1; break; }
}
const fn = code.slice(start, end > 0 ? end : code.length);

// ---- 2) ของที่เปลี่ยนทุกครั้ง = ห้ามอยู่ในก้อนพื้น ----
const BANNED = [
  [/Math\.random/, "Math.random() — เปลี่ยนทุกครั้ง cache ไม่มีวันติด"],
  [/randomUUID|crypto\.random/, "uuid สุ่ม — เปลี่ยนทุกครั้ง"],
  [/toISOString\(\)(?!\s*\.slice\(0,\s*10\))/, "toISOString() เต็มรูป (มีเวลาถึงมิลลิวินาที) — ถ้าต้องการวันที่ ให้ .slice(0, 10)"],
  [/toLocaleTimeString|getTime\(\)|Date\.now\(\)\s*\)/, "เวลาระดับวินาที — เปลี่ยนทุกครั้ง"],
  [/performance\.now/, "performance.now() — เปลี่ยนทุกครั้ง"],
];
for (const [re, why] of BANNED) {
  if (re.test(fn)) bad(`buildSystemPrompt มี ${why}`);
}

// ---- 3) ก้อนพื้นต้องมาก่อนเนื้อหาที่เปลี่ยนตลอด (ประวัติแชท) ----
// cache ของทุกค่ายจับจาก "ส่วนหน้าที่เหมือนกัน" ถ้าเอาประวัติขึ้นก่อน system/tools
// จะไม่มีส่วนหน้าที่เหมือนกันเลยสักคำขอเดียว
for (const [name, fnStart] of [["runGemini", code.indexOf("async function runGemini")],
                               ["runOpenAI", code.indexOf("async function runOpenAI")]]) {
  if (fnStart < 0) { bad(`หา ${name} ไม่เจอ — ตัวตรวจน่าจะพัง`); continue; }
  const body = code.slice(fnStart, fnStart + 4000);
  const sysAt = name === "runGemini" ? body.indexOf("systemInstruction") : body.search(/role:\s*"system"/);
  const histAt = body.indexOf("ctx.history");
  if (sysAt < 0) bad(`${name} ไม่พบจุดที่ใส่ system prompt`);
  else if (histAt >= 0 && histAt < sysAt && name === "runOpenAI") {
    bad(`${name} วางประวัติแชทไว้ก่อน system prompt — cache จะไม่ติด`);
  }
}

// ---- 4) ต้องยังบันทึก cached_tokens อยู่ ไม่งั้นเรามองไม่เห็นว่า cache ติดไหม ----
if (!/cached_tokens:\s*r\.cachedTok/.test(code)) {
  bad("ไม่ได้บันทึก cached_tokens ลง ai_usage_logs แล้ว — จะกลับไปมองไม่เห็นว่า cache ติดหรือไม่ (และเพดานเงินต่อวันจะประมาณเกินอีก)");
}
if (!/estimateAiCost\(`\$\{cfg\.provider\}\/\$\{cfg\.model\}`/.test(code)) {
  bad("estimateAiCost ไม่ได้รับ 'provider/model' — ส่วนลด cache แยกตามค่าย ส่งชื่อโมเดลล้วนจะตกไปคิดราคาเต็มเงียบ ๆ");
}

console.log(failures === 0
  ? "  ถูก  ก้อนพื้นยังเหมือนเดิมทุกคำขอ · บันทึกและคิดราคา cache ครบ\n"
  : `\nสรุป: ไม่ผ่าน ${failures} ข้อ — cache จะตายเงียบ ๆ แล้วบิลขึ้นโดยไม่มีใครรู้ ห้าม push\n`);
process.exit(failures === 0 ? 0 : 1);
