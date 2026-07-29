// ============================================================
//  สำรองข้อมูลลูกค้าออกมาเก็บไว้เอง
//
//  ⚠️ ทำไมเรื่องนี้สำคัญกว่าโควตา
//  แพ็กฟรีของ Supabase "ไม่มีระบบสำรองข้อมูลอัตโนมัติเลย"
//  เอกสารทางการของ Supabase เขียนไว้เองว่าโปรเจกต์แพ็กฟรีควร db dump
//  ออกมาเก็บนอกระบบเป็นประจำ (guides/platform/backups)
//
//  แปลว่าตอนนี้ถ้าฐานข้อมูลหาย = สมุดบัญชีของลูกค้าทุกรายหายพร้อมกัน
//  และลูกค้าจะทำตามหน้าที่เก็บเอกสาร 5 ปี (พ.ร.บ.การบัญชี ม.14) ไม่ได้
//  ซึ่งเป็นข้อที่เราเพิ่งเขียนใส่ข้อกำหนดการใช้งานเองว่าเป็นหน้าที่ของเขา
//
//  สคริปต์นี้ดึงข้อมูลทุกตารางออกมาเป็น JSON ลงโฟลเดอร์ backups/
//  โครงสร้างตาราง (schema) อยู่ใน migrations ในกิตอยู่แล้ว
//  ข้อมูล + migrations = กู้คืนได้ครบ
//
//  วิธีใช้
//    1. สร้างไฟล์ .env.local ที่โฟลเดอร์โปรเจกต์ (กิตไม่เก็บไฟล์นี้อยู่แล้ว)
//         NEXT_PUBLIC_SUPABASE_URL=...
//         SUPABASE_SERVICE_ROLE_KEY=...
//       ⚠️ ห้ามวางคีย์นี้ในแชทหรือที่ไหนก็ตามที่ไม่ใช่เครื่องตัวเอง
//    2. npm run backup
//    3. ก๊อปโฟลเดอร์ backups/<วันที่> ไปเก็บที่อื่นด้วย (Google Drive / ฮาร์ดดิสก์)
//       เก็บไว้ในเครื่องเดียวไม่นับว่าสำรอง เพราะเครื่องพังก็หายพร้อมกัน
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// อ่าน .env.local เอง — สคริปต์นี้รันนอก Next จึงไม่มีใครโหลดให้
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(`
ยังไม่มีค่าเชื่อมต่อ — สร้างไฟล์ .env.local ที่โฟลเดอร์นี้แล้วใส่

  NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=xxxx

ค่าทั้งสองอยู่ที่ Supabase Dashboard -> Project Settings -> API
ห้ามวาง service role key ในแชทหรือส่งให้ใครเด็ดขาด มันเปิดข้อมูลได้ทั้งฐาน
`);
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

// ตารางที่ต้องสำรอง — เรียงตามลำดับที่กู้คืนได้ (ตารางแม่มาก่อนตารางลูก)
const TABLES = [
  "shops", "profiles", "shop_members", "shop_settings", "shop_notify_settings",
  "contacts", "products", "expense_categories", "chart_of_accounts",
  "fin_docs", "fin_doc_items", "fin_doc_files", "fin_payments", "fin_doc_counters",
  "journal_entries", "journal_lines", "assets", "period_locks",
  "plans", "topups", "wallet_transactions", "audit_logs",
  "vat_rates", "rd_filing_extensions", "th_public_holidays",
];

const stamp = new Date().toISOString().slice(0, 10);
const dir = join("backups", stamp);
mkdirSync(dir, { recursive: true });

console.log(`\nสำรองข้อมูลลงโฟลเดอร์ ${dir}\n`);

let totalRows = 0;
let missing = 0;
const summary = [];

for (const table of TABLES) {
  // ดึงเป็นหน้า ๆ กันโดนเพดานแถวของ PostgREST ตอนข้อมูลโตขึ้น
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select("*").range(from, from + PAGE - 1);
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        console.log(`  ข้าม  ${table} (ไม่มีตารางนี้)`);
        missing++;
      } else {
        console.log(`  ผิด   ${table} — ${error.message}`);
      }
      break;
    }
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  if (rows.length === 0 && missing) { missing--; }   // นับข้ามไปแล้ว
  writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 2), "utf8");
  totalRows += rows.length;
  summary.push({ table, rows: rows.length });
  console.log(`  เก็บ  ${table.padEnd(24)} ${String(rows.length).padStart(6)} แถว`);
}

writeFileSync(join(dir, "_summary.json"), JSON.stringify({
  backed_up_at: new Date().toISOString(),
  project_url: url,
  total_rows: totalRows,
  tables: summary,
  note: "โครงสร้างตารางอยู่ใน supabase migrations ในกิต — ข้อมูลชุดนี้ + migrations = กู้คืนได้ครบ",
}, null, 2), "utf8");

console.log(`
เสร็จแล้ว — ${summary.length} ตาราง รวม ${totalRows.toLocaleString("th-TH")} แถว

⚠️ ยังไม่นับว่าสำรองจนกว่าจะเอาไฟล์ออกจากเครื่องนี้
   ก๊อป ${dir} ไปไว้อีกที่ (Google Drive / ฮาร์ดดิสก์แยก) ด้วย
   เครื่องพังทีเดียวหายทั้งต้นฉบับและสำเนา = ไม่ได้สำรองอะไรเลย
`);
