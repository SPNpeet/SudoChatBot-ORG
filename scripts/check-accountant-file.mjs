// ============================================================
//  ตรวจ "ชุดส่งสำนักงานบัญชี" ด้วยการโหลดไฟล์จริงออกมาเปิดดู
//
//  ⚠️ ทำไมต้องมี (9 ส.ค. 2569)
//  เจ้าของส่งไฟล์ที่ถูกสำนักงานบัญชีตีกลับมาให้ดู เปิดไฟล์จริงแล้วเจอ 4 อย่าง
//  ที่ typecheck/build มองไม่เห็นเลยสักข้อ เพราะมันไม่ใช่เรื่องโค้ดพัง
//  แต่เป็นเรื่อง "ไฟล์ที่ออกไปใช้งานต่อไม่ได้":
//    คอลัมน์ที่มาเป็นค่าดิบภาษาอังกฤษ · วันที่เป็นข้อความจึงกรองไม่ได้ ·
//    แถวรวมปนอยู่ในข้อมูลและอยู่ในขอบเขต AutoFilter · ไม่มีเลขผู้เสียภาษีแต่ไฟล์ออกไปเงียบ ๆ
//
//  ไฟล์นี้ทำให้ทั้ง 4 ข้อกลายเป็นสิ่งที่วัดซ้ำได้ ไม่ใช่สิ่งที่ต้องรอปลายทางทักกลับมา
//
//  วิธีใช้:  npm run check:accountant [งวด] [ไฟล์ที่จะบันทึกไว้ดู]
//    ตัวอย่าง:  npm run check:accountant 2026-08
//  ต้องมี TEST_EMAIL / TEST_PASSWORD ใน .env.local (บัญชีทดสอบ ห้ามใช้บัญชีที่มีข้อมูลลูกค้าจริง)
//  ตั้ง CHECK_BASE_URL ได้ถ้าอยากยิงใส่เครื่อง dev แทน production
// ============================================================
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import ExcelJS from "exceljs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const BASE = process.env.CHECK_BASE_URL || "https://sudochatbot.online";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const period = process.argv[2] || new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
const saveTo = process.argv[3];

console.log("\n== ตรวจไฟล์ชุดส่งสำนักงานบัญชี ==");
if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
  console.log("  ข้าม — ยังไม่มี TEST_EMAIL / TEST_PASSWORD ใน .env.local");
  console.log("  ⚠️ ตราบใดที่ยังข้าม ไฟล์ที่ลูกค้าส่งให้สำนักงานบัญชียังไม่เคยถูกเปิดตรวจเลย");
  process.exit(0);   // ด่านเสริม ไม่บล็อกการ deploy
}

const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: ANON },
  body: JSON.stringify({ email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }),
});
if (!auth.ok) { console.log(`  เข้าสู่ระบบไม่สำเร็จ (${auth.status}) — เช็ค TEST_EMAIL/TEST_PASSWORD`); process.exit(1); }

// รูปแบบ cookie ของ @supabase/ssr 0.6.x — เหมือนกับใน check-logged-in-ui.mjs
// (เขียนผิดรูปแบบแล้ว middleware อ่านไม่ออก ทุกหน้าจะเด้ง login แล้วรายงานผิดว่าระบบพัง)
const s = await auth.json();
const ref = SUPABASE_URL.replace(/^https:\/\//, "").split(".")[0];
const raw = "base64-" + Buffer.from(JSON.stringify({
  access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at,
  expires_in: s.expires_in, token_type: s.token_type, user: s.user,
}), "utf8").toString("base64url");
const CHUNK = 3180;
const cookie = raw.length <= CHUNK
  ? `sb-${ref}-auth-token=${raw}`
  : Array.from({ length: Math.ceil(raw.length / CHUNK) },
      (_, i) => `sb-${ref}-auth-token.${i}=${raw.slice(i * CHUNK, (i + 1) * CHUNK)}`).join("; ");

const res = await fetch(`${BASE}/api/sheet/accountant?period=${encodeURIComponent(period)}`, { headers: { Cookie: cookie } });
if (!res.ok) {
  const body = await res.text();
  // 400 = งวดนั้นไม่มีข้อมูลเลย ซึ่งเป็นคำตอบที่ถูกต้อง ไม่ใช่ความผิดพลาด
  if (res.status === 400) { console.log(`  ข้าม — ${body.slice(0, 160)}`); process.exit(0); }
  console.log(`  โหลดไฟล์ไม่สำเร็จ (${res.status}) ${body.slice(0, 200)}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
if (saveTo) writeFileSync(saveTo, buf);

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buf);

const CELL_TYPE = { 0: "ว่าง", 2: "ตัวเลข", 3: "ข้อความ", 4: "วันที่", 6: "สูตร" };
let bad = 0;
const ok = (m) => console.log(`  ถูก  ${m}`);
const no = (m) => { bad++; console.log(`  ผิด  ${m}`); };

console.log(`  ฐาน: ${BASE} · งวด ${period}`);
console.log(`  แผ่น: ${wb.worksheets.map((w) => w.name).join(" · ")}`);

const DATE_HEADERS = new Set(["วันที่", "วันที่จ่าย", "ครบกำหนด"]);

for (const ws of wb.worksheets) {
  if (ws.rowCount < 2 || ws.columnCount < 2) continue;   // แผ่นที่ไม่มีข้อมูลในงวด ข้ามไป
  const head = ws.getRow(1);
  const headers = [];
  for (let c = 1; c <= ws.columnCount; c++) headers.push(String(head.getCell(c).value ?? ""));

  // 1. คอลัมน์วันที่ต้องเป็นวันที่จริง ไม่งั้นปลายทางกรองและทำ PivotTable ต่อไม่ได้
  for (let c = 1; c <= ws.columnCount; c++) {
    if (!DATE_HEADERS.has(headers[c - 1])) continue;
    const cell = ws.getRow(2).getCell(c);
    if (cell.value == null || cell.value === "") continue;
    if (cell.type === 4) ok(`${ws.name}/${headers[c - 1]} เป็นวันที่จริง (${cell.numFmt})`);
    else no(`${ws.name}/${headers[c - 1]} เป็น${CELL_TYPE[cell.type] ?? cell.type} ไม่ใช่วันที่`);
  }

  // 2. ห้ามมีค่าดิบภาษาอังกฤษหลุดลงไฟล์ภาษาไทย
  const srcCol = headers.indexOf("ที่มา") + 1;
  if (srcCol > 0) {
    const vals = new Set();
    ws.eachRow((row, r) => { if (r > 1) { const v = row.getCell(srcCol).value; if (v) vals.add(String(v)); } });
    const eng = [...vals].filter((v) => /^[a-z_]+$/i.test(v));
    if (eng.length) no(`${ws.name}/ที่มา มีค่าดิบภาษาอังกฤษ: ${eng.join(", ")}`);
    else ok(`${ws.name}/ที่มา เป็นภาษาไทยทั้งหมด (${[...vals].join(" · ")})`);
  }

  // 3. แถวรวมต้องแยกออกจากข้อมูลให้เห็น ไม่งั้นกดเรียง/กรองแล้วไหลไปแทรกกลางตาราง
  const last = ws.getRow(ws.rowCount);
  if (String(last.getCell(1).value ?? "") === "รวม") {
    const bold = !!last.getCell(1).font?.bold;
    const border = !!last.getCell(1).border?.top;
    if (bold && border) ok(`${ws.name} แถวรวมตัวหนา + มีเส้นคั่น`);
    else no(`${ws.name} แถวรวมยังเป็นแถวข้อมูลธรรมดา (ตัวหนา=${bold} เส้นคั่น=${border})`);
  }
}

// 4. ไม่มีเลขผู้เสียภาษี = ปลายทางยื่นต่อไม่ได้ ต้องเตือนบนหน้าปก ห้ามปล่อยไฟล์ออกไปเงียบ ๆ
const cover = wb.worksheets[0];
let taxLine = "", warned = false;
cover.eachRow((row) => {
  const a = String(row.getCell(1).value ?? ""), b = String(row.getCell(2).value ?? "");
  // ต้องเทียบชื่อฟิลด์แบบตรงตัว — แถวเตือนก็มีคำว่า "เลขประจำตัวผู้เสียภาษี" อยู่ด้วย
  // ใช้ includes จะจับแถวเตือนมาเป็นค่าของฟิลด์ แล้วรายงานว่ามีเลขแล้วทั้งที่ไม่มี
  if (a.trim() === "เลขประจำตัวผู้เสียภาษี" && b) taxLine = b.trim();
  if (a.includes("ยังไม่ได้กรอกเลขประจำตัวผู้เสียภาษี")) warned = true;
});
if (taxLine === "ยังไม่ได้กรอก") {
  if (warned) ok("ไม่มีเลขผู้เสียภาษี และหน้าปกขึ้นแถบเตือนแล้ว");
  else no("ไม่มีเลขผู้เสียภาษี แต่หน้าปกไม่เตือนอะไรเลย");
} else ok(`หน้าปกมีเลขผู้เสียภาษี (${taxLine})`);

console.log(bad ? `\n  พบปัญหา ${bad} ข้อ\n` : "\n  ผ่านทุกข้อ\n");
process.exit(bad ? 1 : 0);
