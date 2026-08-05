// ============================================================
//  แปลงไฟล์สำรอง JSON เป็นคำสั่ง SQL สำหรับกู้ข้อมูลกลับ
//
//  ⚠️ ทำไมต้องมี: เรามีไฟล์สำรองมาตลอด แต่ไม่เคยมีขั้นตอน "เอากลับเข้าไป"
//  แผนกู้ระบบที่พิสูจน์ได้แค่ครึ่งเดียว (สร้างโครงสร้างได้ แต่ใส่ข้อมูลกลับไม่เป็น)
//  คือแผนที่จะพังในวินาทีที่ต้องใช้จริง ซึ่งเป็นวินาทีที่แย่ที่สุดที่จะมาลองผิดลองถูก
//
//  ออกแบบให้ "ปลอดภัยโดยค่าเริ่มต้น":
//   · ไม่ต่อฐานข้อมูลเอง — พ่นเป็นไฟล์ .sql ให้คนอ่านตรวจก่อนแล้วค่อยรันเอง
//     (สคริปต์ที่เขียนทับฐานข้อมูลได้เองคืออาวุธที่วางทิ้งไว้ข้างทาง)
//   · on conflict do nothing — รันซ้ำได้ ไม่ทับข้อมูลที่มีอยู่
//   · เรียงตารางตามลำดับ FK จาก backup-tables.mjs (ตารางแม่ก่อนตารางลูก)
//
//  วิธีใช้:
//    node scripts/restore-sql.mjs backups/2026-08-05 > restore.sql
//    แล้วรัน restore.sql ด้วย psql หรือวางใน SQL Editor ของ Supabase
// ============================================================
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BACKUP_TABLES } from "../src/lib/backup-tables.mjs";

const dir = process.argv[2]
  ?? join("backups", readdirSync("backups").filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().pop() ?? "");
if (!existsSync(dir)) {
  console.error(`ไม่พบโฟลเดอร์สำรอง ${dir}`);
  process.exit(1);
}

/** แปลงค่า JS เป็นลิเทอรัล SQL — ต้องครอบคลุมทุกชนิดที่ Postgres คืนมาเป็น JSON */
function lit(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v) || typeof v === "object") {
    // jsonb / อาร์เรย์ — ส่งเป็นสตริง JSON แล้วให้ Postgres cast เอง
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

const out = [];
out.push("-- กู้ข้อมูลจากไฟล์สำรอง — ตรวจไฟล์นี้ก่อนรันเสมอ");
out.push(`-- ที่มา: ${dir}`);
out.push("-- ต้องมีโครงสร้างฐานข้อมูลอยู่แล้ว (รัน baseline + migrations ให้ครบก่อน)");
out.push("begin;");
// ปิด trigger/ตรวจ FK ระหว่างกู้ — ไม่งั้น trigger ปิดงวดและลำดับ FK จะขวางการนำเข้า
// ต้องเป็นสิทธิ์ระดับสูง ถ้าทำไม่ได้ให้ลบสองบรรทัดนี้ทิ้งแล้วพึ่งลำดับตารางแทน
out.push("set session_replication_role = replica;");
out.push("");

let totalRows = 0;
const summary = [];
for (const table of BACKUP_TABLES) {
  const file = join(dir, `${table}.json`);
  if (!existsSync(file)) { summary.push(`${table}: ไม่มีไฟล์`); continue; }
  let rows;
  try { rows = JSON.parse(readFileSync(file, "utf8")); } catch { summary.push(`${table}: อ่านไม่ได้`); continue; }
  if (!Array.isArray(rows) || rows.length === 0) { summary.push(`${table}: 0`); continue; }

  const cols = Object.keys(rows[0]);
  out.push(`-- ${table} (${rows.length} แถว)`);
  // แบ่งเป็นก้อนละ 500 แถว — คำสั่งเดียวยาวเกินไปทำให้ SQL Editor ค้าง
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = chunk.map((r) => `(${cols.map((c) => lit(r[c])).join(",")})`).join(",\n  ");
    // ⚠️ overriding system value ต้องมีเสมอ
    // บางตาราง (vat_rates, rd_filing_extensions) ใช้ generated always as identity
    // ซึ่งปฏิเสธการใส่ id เองแล้วทำให้การกู้ข้อมูลพังทั้งก้อน — จับได้ตอนทดสอบกู้จริง
    // ทดสอบแล้วว่าใส่กับตารางที่ไม่มี identity ก็ไม่ error
    out.push(`insert into public.${table} (${cols.join(",")}) overriding system value values\n  ${values}\non conflict do nothing;`);
  }
  out.push("");
  totalRows += rows.length;
  summary.push(`${table}: ${rows.length}`);
}

out.push("set session_replication_role = origin;");
out.push("commit;");
out.push("");
out.push(`-- รวม ${totalRows} แถว จาก ${summary.length} ตาราง`);

process.stdout.write(out.join("\n"));
console.error(`\nสร้างคำสั่งกู้ข้อมูลจาก ${dir} — รวม ${totalRows.toLocaleString("th-TH")} แถว\n`);
