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

/** ครอบสตริงเป็นลิเทอรัล SQL */
const q = (s) => `'${s.replace(/'/g, "''")}'`;

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

  out.push(`-- ${table} (${rows.length} แถว)`);
  // แบ่งเป็นก้อนละ 500 แถว — คำสั่งเดียวยาวเกินไปทำให้ SQL Editor ค้าง
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const json = JSON.stringify(chunk);
    // เลือกป้าย dollar-quote ที่ไม่ปรากฏในข้อมูล — ข้อมูลลูกค้ามีอะไรก็ได้
    let tag = "$j$";
    for (let n = 0; json.includes(tag); n++) tag = `$j${n}$`;

    // ⚠️ ทำไมต้องเป็น DO block + dynamic SQL แทน INSERT ... VALUES ตรง ๆ
    //
    // แผนกู้ระบบต้องใช้กับ "ไฟล์สำรองของเมื่อวาน" บน "โครงสร้างของวันนี้" ได้
    // ซึ่งแปลว่า schema สองฝั่งไม่ตรงกันเป็นเรื่องปกติ ไม่ใช่ข้อยกเว้น:
    //  · คอลัมน์ที่ถูกลบไปแล้ว ยังอยู่ในไฟล์สำรองเก่า
    //  · คอลัมน์ที่เพิ่งเพิ่ม ยังไม่มีในไฟล์สำรองเก่า
    // ทั้งไฟล์อยู่ใน transaction เดียว error แถวเดียวล้มทั้งชุด
    // (เจอจริง 5 ส.ค. 2569 ตอน drop คอลัมน์ omise_public_key — กู้ไม่ได้แม้แต่แถวเดียว)
    //
    // จึงคัดรายชื่อคอลัมน์ตอน "รันจริง" โดยเอาคีย์ใน JSON ∩ คอลัมน์ที่มีอยู่จริง
    //  · คอลัมน์ที่หายไปแล้ว -> ตัดทิ้ง ไม่พัง
    //  · คอลัมน์ที่ไม่มีในไฟล์ -> ไม่ถูกระบุ จึงได้ค่า default ของตาราง
    //    (สำคัญมาก: ถ้าใช้ select * จะยัด NULL ทับ default แล้วชน NOT NULL ทันที)
    //
    // overriding system value ต้องมีเสมอ: vat_rates กับ rd_filing_extensions
    // ใช้ generated always as identity ซึ่งปฏิเสธการใส่ id เองแล้วพังทั้งก้อน
    out.push(`do $restore$
declare v_cols text; v_data jsonb := ${tag}${json}${tag}::jsonb;
begin
  select string_agg(quote_ident(a.attname), ',')
    into v_cols
  from jsonb_object_keys(v_data -> 0) as k(name)
  join pg_attribute a on a.attrelid = 'public.${table}'::regclass
   and a.attname = k.name and a.attnum > 0 and not a.attisdropped;
  if v_cols is null then
    raise notice 'ข้าม ${table}: ไม่มีคอลัมน์ที่ตรงกันเลย';
    return;
  end if;
  execute format(
    'insert into public.${table} (%s) overriding system value select %s from jsonb_populate_recordset(null::public.${table}, $1) on conflict do nothing',
    v_cols, v_cols)
  using v_data;
end $restore$;`);
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
