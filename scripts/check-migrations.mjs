// ============================================================
//  ด่านตรวจลำดับ migration — "clone ใหม่แล้วสร้างระบบขึ้นมาได้จริงไหม"
//
//  ⚠️ ทำไมต้องมี (บทเรียน 5 ส.ค. 2569)
//  พบว่า production มี 10 ตาราง + 11 ฟังก์ชันที่ไม่มี DDL อยู่ใน repo เลย
//  เพราะถูก apply ผ่านหน้า SQL Editor แล้วลืมเขียนกลับ
//  ผลคือ clone ใหม่ + รัน migration ครบทุกไฟล์ = ได้ฐานข้อมูลที่ขาดแกนระบบภาษีทั้งหมด
//  และมัน **ไม่พังดัง ๆ ตอน migrate** แต่ไปพังเงียบตอนใช้งาน ซึ่งอันตรายกว่ามาก
//
//  ด่านนี้ตรวจ 2 อย่างที่ตาคนมองข้ามง่ายที่สุด:
//   1. อ้างถึงตารางที่ยังไม่ถูกสร้างในไฟล์ก่อนหน้า (ลำดับผิด -> รันบน DB เปล่าแล้วตาย)
//   2. คำสั่งระดับบนสุดที่ raise exception เมื่อหาของไม่เจอ (ทำให้ migration ชุดตายกลางทาง)
//
//  หมายเหตุสำคัญ: เนื้อในฟังก์ชัน (ระหว่าง $function$ / $$) ไม่ถูกตรวจการอ้างอิง
//  เพราะ plpgsql ไม่ resolve ชื่อตอน create — อ้างถึงตารางที่ยังไม่มีได้ ไม่ทำให้ migrate พัง
// ============================================================
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASE_DIR = "supabase/baseline";
const MIG_DIR = "supabase/migrations";

/** ตัดเนื้อในฟังก์ชันออก เหลือเฉพาะคำสั่งระดับบนสุด */
function stripFunctionBodies(sql) {
  // รองรับ $function$ …  $$ … $tag$ … (dollar quoting ทุกแบบ)
  return sql.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, " /*body*/ ");
}

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

const files = [
  ...readdirSync(BASE_DIR).filter((f) => f.endsWith(".sql")).sort().map((f) => join(BASE_DIR, f)),
  ...readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort().map((f) => join(MIG_DIR, f)),
];

const known = new Set();          // ตาราง/วิวที่ถูกสร้างแล้ว
const problems = [];
const notes = [];

// ตารางของ Supabase เองที่มีอยู่ก่อนเสมอ — ไม่ต้องสร้าง
for (const t of ["users", "objects", "buckets", "job", "schemata", "columns", "tables"]) known.add(t);

for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const sql = stripComments(stripFunctionBodies(raw));

  // ---- เก็บของที่ไฟล์นี้สร้าง (เก็บก่อนตรวจ เพราะไฟล์เดียวอาจสร้างแล้วใช้ทันที) ----
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi)) known.add(m[1].toLowerCase());
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi)) known.add(m[1].toLowerCase());

  // ---- ตรวจการอ้างถึงตารางในคำสั่งระดับบนสุด ----
  const refs = [
    ...sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?(\w+)"?/gi),
    ...sql.matchAll(/create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?\w+\s+on\s+(?:public\.)?"?(\w+)"?/gi),
    ...sql.matchAll(/create\s+trigger\s+\w+\s+[\s\S]*?\bon\s+(?:public\.)?"?(\w+)"?/gi),
    ...sql.matchAll(/create\s+policy\s+\w+\s+on\s+(?:public\.)?"?(\w+)"?/gi),
    ...sql.matchAll(/insert\s+into\s+(?:public\.)?"?(\w+)"?/gi),
    ...sql.matchAll(/references\s+(?:public\.)?"?(\w+)"?\s*\(/gi),
  ];
  for (const m of refs) {
    const t = m[1].toLowerCase();
    if (t === "storage" || t === "cron" || t === "auth") continue;
    if (!known.has(t)) {
      problems.push(`${file}: อ้างถึงตาราง "${t}" ที่ยังไม่ถูกสร้างในไฟล์ก่อนหน้า`);
      known.add(t);   // รายงานครั้งเดียวพอ ไม่ต้องซ้ำทุกบรรทัด
    }
  }

  // ---- คำสั่งระดับบนสุดที่โยน exception = ทำให้ migration ชุดตายกลางทาง ----
  // (ในเนื้อฟังก์ชันไม่นับ เพราะโยนตอน runtime ไม่ใช่ตอน migrate)
  if (/raise\s+exception/i.test(sql)) {
    problems.push(`${file}: มี raise exception นอกเนื้อฟังก์ชัน — clone ใหม่จะตายกลางทางแล้วไฟล์ที่เหลือไม่ถูกรัน`);
  }
}

console.log(`\nตรวจลำดับ migration — ${files.length} ไฟล์ · ตาราง/วิวที่สร้างรวม ${known.size}\n`);
for (const n of notes) console.log(`  หมายเหตุ: ${n}`);

if (problems.length) {
  console.error(`❌ พบปัญหา ${problems.length} จุด — clone ใหม่อาจสร้างระบบขึ้นมาไม่ได้\n`);
  for (const p of problems) console.error(`   · ${p}`);
  console.error("");
  process.exit(1);
}
console.log("✅ ลำดับถูกต้อง ไม่มีไฟล์ไหนอ้างถึงของที่ยังไม่ถูกสร้าง และไม่มีคำสั่งที่ทำให้ชุด migration ตายกลางทาง\n");
