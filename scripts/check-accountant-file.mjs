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
const skipped = [];
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

// ============================================================
//  ตรวจว่า "ค่าไม่สลับคอลัมน์" — ข้อที่เจ้าของเน้นที่สุด
//
//  ⚠️ การสลับคอลัมน์เป็นความผิดพลาดที่มองด้วยตาไม่เห็น เพราะไฟล์ยังดูสวยเหมือนเดิม
//  แต่ปลายทางเอาไปยื่นภาษีผิดทั้งเดือน วิธีจับคือใช้ความสัมพันธ์ทางบัญชี
//  ที่ต้องเป็นจริงเสมอ ถ้าค่าสลับที่เมื่อไหร่ ความสัมพันธ์จะพังทันที
// ============================================================
const money = (v) => (typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, "")) || 0);
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

function colIndex(headers, name) { return headers.indexOf(name) + 1; }

function eachDataRow(ws, fn) {
  // แถวสุดท้ายที่ขึ้นต้นด้วย "รวม" คือแถวรวม ไม่ใช่ข้อมูล
  const last = ws.rowCount;
  const hasTotal = String(ws.getRow(last).getCell(1).value ?? "") === "รวม";
  for (let r = 2; r <= (hasTotal ? last - 1 : last); r++) fn(ws.getRow(r), r);
}

for (const ws of wb.worksheets) {
  if (ws.rowCount < 2 || ws.columnCount < 2) continue;
  const head = ws.getRow(1);
  const headers = [];
  for (let c = 1; c <= ws.columnCount; c++) headers.push(String(head.getCell(c).value ?? ""));

  // เลขผู้เสียภาษีต้องเป็นเลข 13 หลักเสมอ ถ้าเจอชื่อคนแปลว่าสลับกับคอลัมน์ชื่อ
  const taxCol = colIndex(headers, "เลขผู้เสียภาษี");
  if (taxCol > 0) {
    let wrong = 0;
    eachDataRow(ws, (row) => {
      const raw = String(row.getCell(taxCol).value ?? "").replace(/\D/g, "");
      const shown = String(row.getCell(taxCol).value ?? "").trim();
      if (shown && shown !== "-" && raw.length !== 13) wrong++;
    });
    wrong ? no(`${ws.name}/เลขผู้เสียภาษี มี ${wrong} แถวที่ไม่ใช่เลข 13 หลัก — สงสัยสลับคอลัมน์`)
          : ok(`${ws.name}/เลขผู้เสียภาษี เป็นเลข 13 หลักทุกแถว`);
  }

  // ภาษีขาย/ภาษีซื้อ: มูลค่า + ภาษี ต้องเท่ากับยอดรวมเสมอ
  const baseCol = colIndex(headers, "มูลค่าสินค้า/บริการ");
  const totalCol = colIndex(headers, "ยอดรวม");
  const vatCol = colIndex(headers, "ภาษีขาย") || colIndex(headers, "ภาษีซื้อ");
  if (baseCol > 0 && vatCol > 0 && totalCol > 0) {
    let wrong = 0, n = 0;
    eachDataRow(ws, (row) => {
      n++;
      const b = money(row.getCell(baseCol).value), v = money(row.getCell(vatCol).value), t = money(row.getCell(totalCol).value);
      if (!near(b + v, t)) wrong++;
    });
    wrong ? no(`${ws.name} มี ${wrong}/${n} แถวที่ มูลค่า + ภาษี ไม่เท่ายอดรวม — ค่าอาจสลับคอลัมน์`)
          : ok(`${ws.name} มูลค่า + ภาษี = ยอดรวม ครบทั้ง ${n} แถว`);
  }

  // หัก ณ ที่จ่าย: ยอดเงินที่จ่าย x อัตรา = ภาษีที่หัก · จับทั้งการสลับฐานกับยอดรวม และสลับอัตรากับจำนวนเงิน
  const payCol = colIndex(headers, "ยอดเงินที่จ่าย");
  const rateCol = colIndex(headers, "อัตรา (%)");
  const whtCol = colIndex(headers, "ภาษีที่หัก");
  if (payCol > 0 && rateCol > 0 && whtCol > 0) {
    let wrong = 0, badRate = 0, n = 0;
    eachDataRow(ws, (row) => {
      n++;
      const pay = money(row.getCell(payCol).value), rate = money(row.getCell(rateCol).value), wht = money(row.getCell(whtCol).value);
      if (rate < 0 || rate > 100) badRate++;
      if (!near(Math.round(pay * rate) / 100, wht, 0.02)) wrong++;
    });
    if (badRate) no(`${ws.name} มี ${badRate} แถวที่อัตราอยู่นอกช่วง 0-100 — สงสัยสลับกับคอลัมน์จำนวนเงิน`);
    wrong ? no(`${ws.name} มี ${wrong}/${n} แถวที่ ยอดจ่าย x อัตรา ไม่เท่าภาษีที่หัก`)
          : ok(`${ws.name} ยอดจ่าย x อัตรา = ภาษีที่หัก ครบทั้ง ${n} แถว`);
  }

  // แบบยื่นต้องเป็นแบบที่มีอยู่จริงเท่านั้น
  const formCol = colIndex(headers, "แบบที่ยื่น");
  if (formCol > 0) {
    const bad = new Set();
    eachDataRow(ws, (row) => {
      const v = String(row.getCell(formCol).value ?? "").trim();
      if (v && !["ภ.ง.ด.1", "ภ.ง.ด.2", "ภ.ง.ด.3", "ภ.ง.ด.53"].includes(v)) bad.add(v);
    });
    bad.size ? no(`${ws.name}/แบบที่ยื่น มีค่าที่ไม่ใช่แบบจริง: ${[...bad].join(", ")}`)
             : ok(`${ws.name}/แบบที่ยื่น เป็นแบบที่มีอยู่จริงทุกแถว`);
  }

  // เดบิตรวมต้องเท่าเครดิตรวมตามหลักบัญชีคู่
  const drCol = colIndex(headers, "เดบิต"), crCol = colIndex(headers, "เครดิต");
  if (drCol > 0 && crCol > 0) {
    let dr = 0, cr = 0, both = 0;
    eachDataRow(ws, (row) => {
      const d = money(row.getCell(drCol).value), c = money(row.getCell(crCol).value);
      dr += d; cr += c;
      if (d > 0 && c > 0) both++;
    });
    if (both) no(`${ws.name} มี ${both} แถวที่ลงทั้งเดบิตและเครดิตในบรรทัดเดียว`);
    near(Math.round(dr * 100) / 100, Math.round(cr * 100) / 100, 0.02)
      ? ok(`${ws.name} เดบิตรวม = เครดิตรวม (${dr.toLocaleString("th-TH")})`)
      : no(`${ws.name} เดบิตรวม ${dr.toLocaleString("th-TH")} ไม่เท่าเครดิตรวม ${cr.toLocaleString("th-TH")}`);
  }

  // ค้างอยู่ต้องไม่เกินยอดเอกสาร
  const docAmtCol = colIndex(headers, "ยอดเอกสาร"), openCol = colIndex(headers, "ค้างอยู่");
  if (docAmtCol > 0 && openCol > 0) {
    let wrong = 0, n = 0;
    eachDataRow(ws, (row) => {
      n++;
      if (money(row.getCell(openCol).value) > money(row.getCell(docAmtCol).value) + 0.02) wrong++;
    });
    wrong ? no(`${ws.name} มี ${wrong}/${n} แถวที่ยอดค้างมากกว่ายอดเอกสาร — สงสัยสลับคอลัมน์`)
          : ok(`${ws.name} ยอดค้างไม่เกินยอดเอกสาร ครบทั้ง ${n} แถว`);
  }
}

// ตัวเลขบนหน้าปกต้องตรงกับผลรวมในแผ่นจริง ถ้าสลับกันจะจับได้ตรงนี้
{
  const cover = wb.worksheets[0];
  const cov = {};
  cover.eachRow((row) => {
    const a = String(row.getCell(1).value ?? "").trim();
    const b = row.getCell(2).value;
    if (typeof b === "number") cov[a] = b;
  });
  const sheetTotal = (name, header) => {
    const ws = wb.getWorksheet(name);
    if (!ws || ws.rowCount < 2 || ws.columnCount < 2) return 0;
    const head = ws.getRow(1);
    const headers = [];
    for (let c = 1; c <= ws.columnCount; c++) headers.push(String(head.getCell(c).value ?? ""));
    const col = headers.indexOf(header) + 1;
    if (!col) return 0;
    let sum = 0;
    eachDataRow(ws, (row) => { sum += money(row.getCell(col).value); });
    return Math.round(sum * 100) / 100;
  };
  const pairs = [
    ["ภาษีขาย (VAT ขาย)", sheetTotal("ภาษีขาย", "ภาษีขาย")],
    ["ภาษีซื้อ (VAT ซื้อ)", sheetTotal("ภาษีซื้อ", "ภาษีซื้อ")],
    ["ภาษีหัก ณ ที่จ่ายที่ต้องนำส่ง", sheetTotal("หัก ณ ที่จ่าย", "ภาษีที่หัก")],
  ];
  for (const [label, fromSheet] of pairs) {
    if (!(label in cov)) continue;
    near(cov[label], fromSheet, 0.02)
      ? ok(`หน้าปก "${label}" ตรงกับผลรวมในแผ่น (${fromSheet.toLocaleString("th-TH")})`)
      : no(`หน้าปก "${label}" = ${cov[label].toLocaleString("th-TH")} แต่ผลรวมในแผ่นได้ ${fromSheet.toLocaleString("th-TH")} — ตัวเลขสองที่ไม่ตรงกัน`);
  }
  // ⚠️ หัวข้อบรรทัดสรุปเปลี่ยนตามเครื่องหมาย: ภาษีขายมากกว่า = "ต้องชำระ"
  // ภาษีซื้อมากกว่า = "ขอคืน/ยกไปงวดหน้า" เดิมด่านนี้มองหาแต่หัวข้อแรก
  // พอเจองวดที่ภาษีซื้อเกิน จึงข้ามไปเงียบ ๆ โดยไม่มีใครรู้ (แก้ 27 ส.ค. 2569)
  // และหัวข้อที่ขึ้นต้องตรงกับเครื่องหมายด้วย ถ้าสลับขาย/ซื้อกันเมื่อไหร่ หัวข้อจะกลับด้านทันที
  const sale = cov["ภาษีขาย (VAT ขาย)"], buy = cov["ภาษีซื้อ (VAT ซื้อ)"];
  const netLabel = Object.keys(cov).find((k) => k.includes("ภาษีที่ต้องชำระ") || k.includes("ขอคืน"));
  if (typeof sale === "number" && typeof buy === "number" && netLabel) {
    const net = cov[netLabel];
    const shouldPay = sale - buy >= 0;
    if (!near(Math.abs(sale - buy), Math.abs(net), 0.02)) {
      no(`หน้าปก ภาษีขาย ${sale} - ภาษีซื้อ ${buy} ไม่ตรงกับบรรทัดสรุป ${net} — สงสัยสลับขาย/ซื้อ`);
    } else if (shouldPay !== netLabel.includes("ภาษีที่ต้องชำระ")) {
      no(`หน้าปกขึ้นหัวข้อ "${netLabel}" ทั้งที่ ขาย ${sale} - ซื้อ ${buy} บอกตรงข้าม — สงสัยสลับขาย/ซื้อ`);
    } else {
      ok(`หน้าปก "${netLabel}" ตรงทั้งตัวเลขและเครื่องหมาย (${Math.abs(sale - buy).toLocaleString("th-TH")})`);
    }
  } else if (!netLabel) {
    no("หน้าปกไม่มีบรรทัดสรุป ภ.พ.30 เลย");
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

// ⚠️ แผ่นที่ไม่มีข้อมูลในงวด = กฎกันสลับคอลัมน์ของแผ่นนั้นไม่ได้ถูกใช้เลย
// ต้องพูดออกมาตรง ๆ ไม่งั้นอ่านผลแล้วเข้าใจว่าตรวจครบ
for (const name of ["ภาษีขาย", "ภาษีซื้อ", "หัก ณ ที่จ่าย", "ลูกหนี้-เจ้าหนี้ค้าง"]) {
  const ws = wb.getWorksheet(name);
  if (!ws || ws.rowCount < 2 || ws.columnCount < 2) skipped.push(name);
}
if (skipped.length) {
  console.log("");
  console.log("  ยังไม่ได้ตรวจ: " + skipped.join(" · ") + " — งวดนี้ไม่มีรายการ กฎกันสลับคอลัมน์ของแผ่นเหล่านี้จึงไม่ถูกใช้");
  console.log("  รันซ้ำกับงวดที่มีข้อมูลครบถึงจะพูดได้ว่าตรวจครบ");
}
console.log(bad ? `\n  พบปัญหา ${bad} ข้อ\n` : "\n  ผ่านเท่าที่ตรวจได้\n");
process.exit(bad ? 1 : 0);
