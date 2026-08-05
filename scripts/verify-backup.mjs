// ============================================================
//  ตรวจว่าไฟล์สำรอง "ใช้กู้ได้จริง" ไม่ใช่แค่มีไฟล์
//
//  ⚠️ ทำไมต้องมี: สำรองที่ไม่เคยตรวจ = ไม่ใช่สำรอง
//  ความล้มเหลวที่พบบ่อยที่สุดของ backup ไม่ใช่ "ไม่มีไฟล์" แต่คือ
//  ไฟล์มีจริงแต่ว่างเปล่า / JSON เสีย / ขาดตารางสำคัญไปเงียบ ๆ
//  แล้วมารู้ตอนที่ต้องกู้ ซึ่งสายไปแล้ว
//
//  ตรวจ 4 อย่าง: ไฟล์ครบทุกตาราง · JSON อ่านออก · จำนวนแถวเทียบกับฐานจริง
//  · ตารางแกนของบัญชีต้องไม่ว่าง (ถ้าฐานจริงมีข้อมูล)
//
//  ใช้: npm run backup:verify        (ตรวจโฟลเดอร์ล่าสุดใน backups/)
//       npm run backup:verify 2026-08-05   (ระบุวันเอง)
// ============================================================
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { BACKUP_TABLES, SECRET_TABLES } from "../src/lib/backup-tables.mjs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("ยังไม่มีค่าเชื่อมต่อใน .env.local — ดูวิธีตั้งที่ scripts/backup-data.mjs");
  process.exit(1);
}

// ตารางที่ถ้าหาย = กู้บัญชีลูกค้าไม่ได้ (ไม่ใช่แค่ไม่สะดวก)
const CRITICAL = [
  "shops", "shop_members", "fin_docs", "fin_doc_items", "fin_payments",
  "journal_entries", "journal_lines", "chart_of_accounts", "wallets",
];

const arg = process.argv[2];
const dir = arg ? join("backups", arg)
  : join("backups", readdirSync("backups").filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().pop() ?? "");
if (!existsSync(dir)) {
  console.error(`ไม่พบโฟลเดอร์สำรอง ${dir} — รัน npm run backup ก่อน`);
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const problems = [];
const warnings = [];
let checked = 0;

console.log(`\nตรวจไฟล์สำรองใน ${dir}\n`);

for (const table of [...BACKUP_TABLES, ...SECRET_TABLES]) {
  const file = join(dir, `${table}.json`);
  if (!existsSync(file)) {
    (CRITICAL.includes(table) ? problems : warnings).push(`${table}: ไม่มีไฟล์`);
    continue;
  }
  let rows;
  try {
    rows = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(rows)) throw new Error("ไม่ใช่อาร์เรย์");
  } catch (e) {
    problems.push(`${table}: ไฟล์เสีย อ่านไม่ออก (${e.message})`);
    continue;
  }

  const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
  checked++;
  if (error) { warnings.push(`${table}: เทียบกับฐานจริงไม่ได้ (${error.message})`); continue; }

  const live = count ?? 0;
  const diff = live - rows.length;
  const label = `${table.padEnd(26)} ไฟล์ ${String(rows.length).padStart(6)} / ฐานจริง ${String(live).padStart(6)}`;

  if (rows.length === 0 && live > 0) {
    problems.push(`${table}: ไฟล์ว่างทั้งที่ฐานจริงมี ${live} แถว`);
    console.log(`  พัง  ${label}`);
  } else if (diff > 0) {
    // ฐานจริงโตขึ้นหลังสำรองเป็นเรื่องปกติ — เตือนเมื่อห่างมากผิดปกติเท่านั้น
    const msg = `${table}: ไฟล์เก่ากว่าฐานจริง ${diff} แถว`;
    (live > 0 && rows.length / live < 0.5 ? problems : warnings).push(msg);
    console.log(`  เตือน ${label}`);
  } else {
    console.log(`  ผ่าน  ${label}`);
  }
}

console.log("");
for (const w of warnings) console.log(`  หมายเหตุ: ${w}`);
if (problems.length) {
  console.error(`\n❌ สำรองชุดนี้ใช้กู้ไม่ได้ครบ — ${problems.length} ปัญหา`);
  for (const p of problems) console.error(`   · ${p}`);
  console.error(`\nแก้: รัน npm run backup ใหม่ แล้วตรวจซ้ำ\n`);
  process.exit(1);
}
console.log(`\n✅ ตรวจ ${checked} ตาราง — สำรองชุดนี้ครบและใช้กู้ได้`);
console.log(`   อย่าลืมก๊อป ${dir} ออกนอกเครื่องนี้ด้วย (ดู docs/DISASTER-RECOVERY.md)\n`);
