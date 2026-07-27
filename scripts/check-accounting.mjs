// ============================================================
//  ชุดตรวจตัวเลขบัญชี/ภาษี — รันด้วย `node scripts/check-accounting.mjs`
//
//  ทำไมต้องมี: โปรเจกต์นี้ไม่มี automated test เลย ทั้งที่ทุกตัวเลขที่ผิด
//  แปลว่าลูกค้ายื่นภาษีผิดจริง ไฟล์นี้ตรวจ "แกนคำนวณ" ที่พังแล้วเสียหายที่สุด
//  โดยไม่ต้องต่อฐานข้อมูล จึงรันได้ทุกที่และเร็วพอจะรันก่อน commit ทุกครั้ง
//
//  ครอบคลุม:
//   1. ลำดับการปัดเศษ — ก่อนภาษี + VAT ต้องเท่ายอดรวมเสมอ (สแกนหลายแสนเคส)
//   2. ค่าเสื่อมราคา — สะสมตลอดอายุต้องเหลือราคาซากพอดี ไม่ขาดไม่เกิน
//   3. รูปแบบไฟล์ยื่นสรรพากร — วันที่ พ.ศ. · จำนวนเงิน · TIS-620 · อักขระต้องห้าม
// ============================================================
import { calcDocTotals } from "../src/lib/finance.ts";

let failures = 0;
const ok = (cond, name, detail = "") => {
  if (!cond) { failures++; console.log(`  ผิด  ${name}${detail ? " — " + detail : ""}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

// ---------- 1. ลำดับการปัดเศษ ----------
// เคยพลาดจริง: ปัดทุกค่าแยกกันจากค่าเต็มความละเอียด ทำให้เอกสารไม่ลงตัวในตัวเอง
// เช่น พิมพ์ 9.50 + 0.67 แต่ยอดรวม 10.16 (ต้องเป็น 10.17) — ผู้สอบบัญชีจับได้ทันที
section("ลำดับการปัดเศษ: ก่อนภาษี + VAT = ยอดรวม");
let scanned = 0, bad = 0, worst = null;
for (const mode of ["exclusive", "inclusive"]) {
  for (let cents = 1; cents <= 200000; cents++) {
    const price = cents / 100;
    const t = calcDocTotals([{ qty: 1, unit_price: price }], 0, mode, 0);
    scanned++;
    const diff = Math.round((t.exVat + t.vat - t.total) * 100) / 100;
    if (diff !== 0) { bad++; if (!worst) worst = { mode, price, ...t, diff }; }
  }
}
ok(bad === 0, `สแกน ${scanned.toLocaleString()} เคส`, bad ? `ไม่ลงตัว ${bad} เคส เช่น ${JSON.stringify(worst)}` : "");
if (bad === 0) console.log(`  ถูก  สแกน ${scanned.toLocaleString()} เคส ลงตัวทุกเคส`);

// หลายบรรทัด + ส่วนลด
section("หลายบรรทัด + ส่วนลด + หัก ณ ที่จ่าย");
const cases = [
  { items: [{ qty: 3, unit_price: 35.69 }], disc: 0, mode: "inclusive", wht: 0, wantTotal: 107.07, wantVat: 7.00 },
  { items: [{ qty: 1, unit_price: 10000 }], disc: 0, mode: "exclusive", wht: 3, wantTotal: 10700, wantVat: 700, wantWht: 300 },
  { items: [{ qty: 1, unit_price: 10700 }], disc: 0, mode: "inclusive", wht: 3, wantTotal: 10700, wantVat: 700, wantWht: 300 },
  { items: [{ qty: 2, unit_price: 33.333 }, { qty: 1, unit_price: 0.01 }], disc: 5, mode: "exclusive", wht: 0 },
];
for (const c of cases) {
  const t = calcDocTotals(c.items, c.disc, c.mode, c.wht);
  const label = `${c.mode} ${JSON.stringify(c.items)} ลด ${c.disc} wht ${c.wht}%`;
  ok(Math.round((t.exVat + t.vat - t.total) * 100) / 100 === 0, label, "ก่อนภาษี+VAT ≠ ยอดรวม");
  if (c.wantTotal !== undefined) ok(t.total === c.wantTotal, label, `total ${t.total} ≠ ${c.wantTotal}`);
  if (c.wantVat !== undefined) ok(t.vat === c.wantVat, label, `vat ${t.vat} ≠ ${c.wantVat}`);
  if (c.wantWht !== undefined) ok(t.wht === c.wantWht, label, `wht ${t.wht} ≠ ${c.wantWht}`);
  ok(t.cashDue === Math.round((t.total - t.wht) * 100) / 100, label, "cashDue ไม่ตรง");
}
console.log("  ถูก  ทุกเคสตัวอย่าง");

// ฐานหัก ณ ที่จ่ายต้องเป็นยอดก่อน VAT เสมอ — กับดักที่พบบ่อยที่สุด
section("ฐานหัก ณ ที่จ่าย = ยอดก่อน VAT (ห้ามคิดจากยอดรวม)");
{
  const t = calcDocTotals([{ qty: 1, unit_price: 10700 }], 0, "inclusive", 3);
  ok(t.wht === 300, "10,700 รวม VAT หัก 3%", `ได้ ${t.wht} ควรได้ 300 (ถ้าได้ 321 คือคิดจากยอดรวม = ผิด)`);
  if (t.wht === 300) console.log("  ถูก  ได้ 300.00 ไม่ใช่ 321.00");
}

// ---------- 2. ค่าเสื่อมราคา ----------
section("ค่าเสื่อมราคา: สะสมตลอดอายุต้องเหลือราคาซากพอดี");
const { monthlyDepreciation } = await import("../src/lib/depreciation.ts");
const assets = [
  { name: "คอมพ์ กลางเดือน", cost: 60000, salvage: 1, acquired_on: "2026-03-15", life_years: 3, disposed_on: null },
  { name: "รถ ต้นปี",        cost: 800000, salvage: 1, acquired_on: "2026-01-01", life_years: 5, disposed_on: null },
  { name: "อาคาร วันสุดท้ายปี", cost: 5000000, salvage: 1, acquired_on: "2026-12-31", life_years: 20, disposed_on: null },
  { name: "ของถูก อายุสั้น",  cost: 1500, salvage: 1, acquired_on: "2026-02-29".replace("29", "28"), life_years: 1, disposed_on: null },
];
for (const a of assets) {
  let taken = 0, months = 0;
  for (let y = 2026; y <= 2050; y++) for (let m = 1; m <= 12; m++) {
    const v = monthlyDepreciation(a, `${y}-${String(m).padStart(2, "0")}-01`, taken);
    if (v > 0) { taken = Math.round((taken + v) * 100) / 100; months++; }
  }
  const want = Math.round((a.cost - a.salvage) * 100) / 100;
  ok(taken === want, a.name, `สะสม ${taken} ≠ ${want}`);
  if (taken === want) console.log(`  ถูก  ${a.name}: ${months} เดือน สะสม ${taken.toLocaleString()} เหลือซาก ${a.salvage}`);
}

// ---------- 3. ไฟล์ยื่นสรรพากร ----------
section("ไฟล์ยื่นสรรพากร (RD Prep)");
const { rdClean, rdDateBE, rdAmount, encodeTis620 } = await import("../src/lib/rd.ts");
ok(rdDateBE("2026-07-23") === "23/07/2569", "วันที่ พ.ศ.");
ok(rdDateBE("2028-02-29") === "29/02/2571", "ปีอธิกสุรทิน");
ok(rdAmount(1234.567) === "1234.57", "ปัด 2 ตำแหน่ง");
ok(rdAmount(1000000) === "1000000.00", "ไม่มีคอมมา");
ok(rdAmount(-140) === "-140.00", "ยอดติดลบของใบลดหนี้");
ok(!rdClean("บริษัท|ทดสอบ").includes("|"), "ตัด pipe ที่ทำคอลัมน์เพี้ยน");
ok(!rdClean("ก\nข").includes("\n"), "ตัดขึ้นบรรทัด");
for (const nm of ["บริษัท ก้าวหน้า จำกัด", "นายพีระพงษ์ ศรีสุข", "ห้างหุ้นส่วนสามัญ ธุ์เจริญ", "คุณณัฐฐ์ ญาณ์"]) {
  const b = encodeTis620(nm);
  const back = Array.from(b).map((v) => (v < 0x80 ? String.fromCharCode(v) : String.fromCodePoint(v - 0xa1 + 0x0e01))).join("");
  ok(back === nm, `TIS-620 "${nm}"`, `ถอดกลับได้ "${back}"`);
  ok(b.length === nm.length, `TIS-620 1 ตัวอักษร = 1 ไบต์ "${nm}"`);
}
console.log("  ถูก  วันที่ · จำนวนเงิน · อักขระต้องห้าม · TIS-620 พร้อมวรรณยุกต์/สระซ้อน");

// ---------- 4. ตรวจข้อมูลก่อนโหลดไฟล์ยื่น ----------
section("ตัวตรวจข้อมูลก่อนโหลดไฟล์ ภ.ง.ด.");
const { checkRdWhtRows, whtPaperDueDate } = await import("../src/lib/rd.ts");
const base = { doc_number: "EXP-1", contact_name: "บจ.ทดสอบ", contact_address: "1 ถ.สุขุมวิท กรุงเทพฯ",
  contact_tax_id: "0105569012345", wht_income_type: "40(8)", wht_rate: 3, wht_amount: 300, total: 10700, vat_amount: 700 };
const chk = (patch) => checkRdWhtRows([{ ...base, ...patch }]);
ok(checkRdWhtRows([base]).length === 0, "แถวที่ข้อมูลครบ ต้องไม่ถูกเตือน");
ok(chk({ contact_tax_id: "" }).length === 1, "จับได้: ไม่มีเลขผู้เสียภาษี");
ok(chk({ contact_tax_id: "010556901234" }).length === 1, "จับได้: เลขไม่ครบ 13 หลัก");
ok(chk({ contact_tax_id: "0105569012340" }).length === 1, "จับได้: check digit ผิด");
ok(chk({ contact_address: "" }).length === 1, "จับได้: ไม่มีที่อยู่");
ok(chk({ wht_income_type: null }).length === 1, "จับได้: ไม่ระบุประเภทเงินได้");
ok(chk({ wht_amount: 0 }).length === 1, "จับได้: ภาษีหักเป็น 0");
ok(chk({ contact_name: "บจ.ทดสอบ 🙂" }).length === 1, "จับได้: ชื่อมีอักขระที่ TIS-620 เก็บไม่ได้");
ok(chk({ contact_name: "บจ. ก้าวหน้า ABC" }).length === 0, "ไทย+อังกฤษปกติ ต้องไม่เตือนผิด");
// กำหนดกระดาษเป็นกฎหมาย (ม.52) จึงทดสอบในโค้ดได้
// ส่วนวันออนไลน์เป็นประกาศที่มีวันหมดอายุ อยู่ในตาราง rd_filing_extensions ไม่ทดสอบที่นี่
ok(whtPaperDueDate("2026-07") === "2026-08-07", "ม.52 ก.ค. 2569 = 7 ส.ค. 2569", String(whtPaperDueDate("2026-07")));
ok(whtPaperDueDate("2026-12") === "2027-01-07", "ข้ามปี ธ.ค. 2569 = 7 ม.ค. 2570", String(whtPaperDueDate("2026-12")));
ok(whtPaperDueDate("2028-01") === "2028-02-07", "ปีอธิกสุรทิน ม.ค. 2571 = 7 ก.พ. 2571", String(whtPaperDueDate("2028-01")));
ok(whtPaperDueDate("abc") === null, "รูปแบบผิดต้องคืน null");
console.log("  ถูก  ตรวจครบทุกกรณี");

console.log(failures === 0
  ? "\nสรุป: ผ่านทั้งหมด\n"
  : `\nสรุป: ไม่ผ่าน ${failures} ข้อ — ห้าม deploy จนกว่าจะแก้\n`);
process.exit(failures === 0 ? 0 : 1);
