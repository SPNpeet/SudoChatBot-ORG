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
import { quotaNotice } from "../src/lib/notice-rules.ts";
import { verifyStripeSignature } from "../src/lib/stripe.ts";
import { promptPayPayload } from "../src/lib/promptpay.ts";
import { bahtText } from "../src/lib/finance.ts";
import { selectVatSalesDocs, vatSign } from "../src/lib/vat-docs.ts";
import { createHmac } from "node:crypto";

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

// ---------- 3.1 ไฟล์ยื่นทั้งบรรทัด (snapshot) ----------
// ของเดิมตรวจแค่ฟังก์ชันย่อย แต่สิ่งที่ทำให้โปรแกรมสรรพากรอ่านไฟล์ไม่ได้จริง ๆ คือ
// "ลำดับคอลัมน์ · ตัวคั่น · จำนวนคอลัมน์ · การขึ้นบรรทัด" ซึ่งไม่เคยมีเทสต์แตะเลย
// สลับสองคอลัมน์แล้วเลขทุกบรรทัดไปผิดช่อง — build ผ่าน typecheck ผ่าน
// ไม่มีใครรู้จนเอาไฟล์เข้า RD Prep ตอนดึกของวันที่ 6
section("ไฟล์ยื่นทั้งบรรทัด (ลำดับคอลัมน์ + ตัวคั่น + CRLF)");
const { rdVatLine, rdWhtLine, rdFile } = await import("../src/lib/rd.ts");

// ภ.พ.30 — ลำดับ|วันที่(พ.ศ.)|เลขที่|ชื่อ|เลขผู้เสียภาษี|สาขา|มูลค่า|VAT
const vatLine = rdVatLine({
  seq: 1, issueDate: "2026-07-23", docNumber: "INV-2026-0042",
  contactName: "บริษัท สยามเทรด จำกัด", contactTaxId: "0105561000000", contactBranch: "สำนักงานใหญ่",
  base: 25000, vat: 1750,
});
ok(vatLine === "1|23/07/2569|INV-2026-0042|บริษัท สยามเทรด จำกัด|0105561000000|00000|25000.00|1750.00",
  "ภ.พ.30 ครบ 8 คอลัมน์ ลำดับถูก", `ได้ "${vatLine}"`);
ok(vatLine.split("|").length === 8, "ภ.พ.30 ต้องมี 8 คอลัมน์เสมอ");

// ใบลดหนี้ต้องติดลบ ไม่งั้นภาษีขายที่ยื่นเกินจริง
const cnLine = rdVatLine({
  seq: 2, issueDate: "2026-07-25", docNumber: "CN-2026-0001",
  contactName: "บริษัท สยามเทรด จำกัด", contactTaxId: "0105561000000", contactBranch: "1",
  base: -2000, vat: -140,
});
ok(cnLine.endsWith("|00001|-2000.00|-140.00"), "ใบลดหนี้ยอดติดลบ + สาขาที่ 1 เป็น 00001", `ได้ "${cnLine}"`);

// ภ.ง.ด. — ลำดับ|เลขผู้เสียภาษี|สาขา|ชื่อ|ที่อยู่|วันที่|ประเภทเงินได้|อัตรา|ยอดจ่าย|ภาษีหัก|เงื่อนไข
const whtLine = rdWhtLine({
  seq: 1, contactTaxId: "0105561000000", contactBranch: "สำนักงานใหญ่",
  contactName: "บริษัท รับเหมา จำกัด", contactAddress: "1 ถนนสุขุมวิท กรุงเทพฯ 10110",
  issueDate: "2026-07-23", whtIncomeType: "40(8)", whtRate: 3, base: 10000, whtAmount: 300,
});
const wf = whtLine.split("|");
ok(wf.length === 11, "ภ.ง.ด. ต้องมี 11 คอลัมน์เสมอ", `ได้ ${wf.length} คอลัมน์`);
ok(wf[0] === "1" && wf[1] === "0105561000000" && wf[2] === "00000", "3 คอลัมน์แรก: ลำดับ/เลขภาษี/สาขา");
ok(wf[5] === "23/07/2569", "คอลัมน์ 6 = วันที่ พ.ศ.", `ได้ "${wf[5]}"`);
ok(wf[7] === "3.00" && wf[8] === "10000.00" && wf[9] === "300.00", "อัตรา/ยอดจ่าย/ภาษีหัก อยู่ช่อง 8-10");
ok(wf[10] === "1", "คอลัมน์สุดท้าย = 1 (หัก ณ ที่จ่าย)");

// ข้อมูลที่มี pipe ปนมาต้องไม่ทำคอลัมน์เพี้ยน
const dirty = rdWhtLine({
  seq: 1, contactTaxId: "0105561000000", contactBranch: null,
  // ใช้ String.fromCharCode แทนการเขียน escape ตรง ๆ ให้อ่านง่ายและไม่พลาดตอนแก้ไฟล์
  contactName: "ร้าน|ก|ข", contactAddress: "ที่อยู่" + String.fromCharCode(10) + "บรรทัดสอง",
  issueDate: "2026-07-23", whtIncomeType: "40(8)", whtRate: 3, base: 100, whtAmount: 3,
});
ok(dirty.split("|").length === 11, "ชื่อที่มี pipe ปนมา ต้องยังได้ 11 คอลัมน์", `ได้ ${dirty.split("|").length}`);

// ไฟล์ต้องเป็น CRLF — RD Prep เป็นแอป Windows ถ้าใช้ LF บางเวอร์ชันอ่านเป็นบรรทัดเดียว
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
const file = rdFile([vatLine, cnLine]);
ok(file.includes(CRLF), "ขึ้นบรรทัดด้วย CRLF");
ok(!file.includes(String.fromCharCode(10) + String.fromCharCode(10)), "ไม่มีบรรทัดว่างคั่น");
ok(file.split(CRLF).length === 2, "2 รายการ = 2 บรรทัด ไม่มีบรรทัดว่างท้ายไฟล์");
console.log("  ถูก  ลำดับคอลัมน์ · จำนวนคอลัมน์ · ยอดติดลบใบลดหนี้ · pipe ปน · CRLF");

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

// ---------- 5. วันที่เอกสาร ----------
section("กันวันที่พิมพ์ผิด");
const { docDateTooFarFuture, docDateVeryOld } = await import("../src/lib/tax-th.ts");
const T = "2026-07-27";
ok(docDateTooFarFuture("2069-06-19", T), "จับได้: ปี 2069 (ของจริงที่หลุดเข้า production)");
ok(docDateTooFarFuture("2569-01-01", T), "จับได้: กรอก พ.ศ. ลงช่อง ค.ศ.");
ok(!docDateTooFarFuture("2026-07-27", T), "วันนี้ ต้องผ่าน");
ok(!docDateTooFarFuture("2026-10-20", T), "ล่วงหน้า 85 วัน ต้องผ่าน (ใบเสนอราคาลงวันล่วงหน้าได้)");
ok(docDateTooFarFuture("2026-11-01", T), "ล่วงหน้า 98 วัน ต้องถูกบล็อก");
ok(!docDateTooFarFuture("2020-01-01", T), "ย้อนหลัง ต้องไม่บล็อก (คีย์บิลเก่าเป็นเรื่องปกติ)");
ok(docDateVeryOld("2019-01-01", T), "เตือน: เก่าเกิน 5 ปี");
ok(!docDateVeryOld("2023-01-01", T), "3 ปีที่แล้ว ไม่ต้องเตือน");
console.log("  ถูก  ตรวจครบทุกกรณี");

// ---------- 6. อัตราหัก ณ ที่จ่าย เข้าคู่กับประเภทเงินได้ ----------
section("เตือนอัตราหัก ณ ที่จ่ายไม่เข้าคู่");
const { whtRateMismatch } = await import("../src/lib/tax-th.ts");
ok(whtRateMismatch("40(8)", 5) !== null, "จับได้: 40(8) ค่าบริการ + 5% (เคสจริงจากไฟล์ผู้ใช้)");
ok(whtRateMismatch("40(5)", 3) !== null, "จับได้: 40(5) ค่าเช่า + 3%");
ok(whtRateMismatch("40(4)", 3) !== null, "จับได้: 40(4) ดอกเบี้ย + 3%");
ok(whtRateMismatch("40(8)", 3) === null, "ปกติ: 40(8) + 3% ค่าบริการ");
ok(whtRateMismatch("40(8)", 1) === null, "ปกติ: 40(8) + 1% ค่าขนส่ง");
ok(whtRateMismatch("40(8)", 2) === null, "ปกติ: 40(8) + 2% ค่าโฆษณา");
ok(whtRateMismatch("40(5)", 5) === null, "ปกติ: 40(5) + 5% ค่าเช่า");
ok(whtRateMismatch("40(4)", 10) === null, "ปกติ: 40(4) + 10% เงินปันผล");
ok(whtRateMismatch(null, 3) === null, "ไม่ระบุประเภท ต้องไม่เตือนมั่ว");
ok(whtRateMismatch("40(8)", 0) === null, "อัตรา 0 = ไม่หัก ต้องไม่เตือน");
console.log("  ถูก  ตรวจครบทุกกรณี");

// ============================================================
//  เกณฑ์เตือนโควตา AI ในกล่องจดหมายระบบ
//
//  ทำไมต้องมีเทสต์: แถบโควตาในเมนูซ้ายเปลี่ยนสีที่ 80/95 แต่มือถือไม่เห็นแถบนั้นเลย
//  (render อยู่ใน sidebar เดสก์ท็อป และอยู่ใน {!collapsed && ...})
//  กระดิ่งจึงเป็นทางเดียวที่คนใช้มือถือจะรู้ตัวก่อนถูกตัด AI กลางงาน
//  ถ้าเกณฑ์เพี้ยนไปจากแถบ จะเกิดเคสที่แถบเหลืองแต่กระดิ่งเงียบ = ผู้ใช้ไม่รู้จะเชื่ออะไร
//
//  ที่สำคัญที่สุดคือ "กุญแจ" ต้องเป็นช่วง ไม่ใช่ตัวเลขเป๊ะ
//  ถ้าใส่ pct ตรง ๆ กุญแจจะเปลี่ยนทุกครั้งที่ถาม AI แล้วข้อความจะเด้งใหม่ทุกคำถาม
//  แม้ผู้ใช้กดอ่านไปแล้ว — เป็นบั๊กที่น่ารำคาญที่สุดและมองไม่เห็นจากการอ่านโค้ด
// ============================================================
section("เกณฑ์เตือนโควตา AI");
{
  const at = (pct, extra = {}) => quotaNotice({ allowed: true, pct, used_today: pct * 100, cap_today: 100, ...extra });

  ok(at(0.40) === null, "40% ไม่เตือน");
  ok(at(0.79) === null, "79% ไม่เตือน (ใต้เกณฑ์แถบสีเหลือง)");
  ok(at(0.80)?.tone === "warn", "80% เตือนระดับ warn (ตรงกับแถบเปลี่ยนเป็นเหลือง)");
  ok(at(0.94)?.tone === "warn", "94% ยัง warn");
  ok(at(0.95)?.tone === "critical", "95% ขึ้นเป็น critical (ตรงกับแถบเปลี่ยนเป็นแดง)");
  ok(at(1.00)?.tone === "critical", "100% critical");
  ok(quotaNotice(null) === null, "ไม่มีข้อมูลโควตา = ไม่เตือน (ห้ามเดาว่าเต็ม)");
  ok(quotaNotice(undefined) === null, "undefined = ไม่เตือน");

  // ถูกตัดแล้วต้อง critical ไม่ว่า pct จะเป็นเท่าไร — เพดานรายเดือนอาจตัดที่ pct ต่ำ
  ok(quotaNotice({ allowed: false, reason: "ถึงเพดานรายวัน", pct: 0.1 })?.tone === "critical",
    "ถูกตัด = critical แม้ pct แค่ 10% (เพดานคนละตัวกับที่ใช้คิด pct)");

  // กุญแจต้องเป็นช่วง ไม่ใช่ตัวเลขเป๊ะ
  ok(at(0.81).key === at(0.93).key, "81% กับ 93% ใช้กุญแจเดียวกัน (กดอ่านแล้วต้องไม่เด้งใหม่)");
  ok(at(0.96).key === at(0.99).key, "96% กับ 99% ใช้กุญแจเดียวกัน");
  ok(at(0.81).key !== at(0.96).key, "ข้ามจากเหลืองไปแดงต้องเป็นกุญแจใหม่ (เรื่องแย่ลงต้องเด้งอีกครั้ง)");
  ok(/^ai_quota:(80|95)$/.test(at(0.81).key), `กุญแจอยู่ในรูปแบบที่กำหนด (${at(0.81).key})`);

  // ต้องมีทางไปแก้ ไม่ใช่บอกว่ามีปัญหาแล้วจบ
  ok(at(0.85).href === "/dashboard/billing" && !!at(0.85).cta, "มีลิงก์ + ปุ่มไปหน้าแพ็กเกจ");
  ok(at(0.85).body.includes("80/100") || at(0.85).body.includes("85/100"),
    "บอกตัวเลขที่ใช้จริงในเนื้อความ ไม่ใช่แค่เปอร์เซ็นต์");
}

// ============================================================
//  ลายเซ็น webhook ของ Stripe — ด่านเดียวที่กั้นระหว่าง "คนแปลกหน้า" กับ "เครดิตเงินเข้ากระเป๋า"
//
//  ทำไมต้องอยู่ในชุดตรวจ: ถ้าฟังก์ชันนี้คืน true ผิดแม้ครั้งเดียว
//  ใครก็ยิง JSON เข้ามาเองแล้วได้แพ็กเกจฟรีไม่จำกัด โดยไม่มีร่องรอยว่าผิดปกติ
//  และมันพังแบบ "เงียบ" — ระบบยังทำงานปกติทุกอย่าง จับได้ตอนดูยอดเงินไม่ตรงเท่านั้น
//  จึงเป็นโค้ดประเภทที่ห้ามพึ่ง "อ่านแล้วดูถูก" เด็ดขาด ต้องมีเคสโจมตีจริงให้รันทุกครั้ง
// ============================================================
section("ลายเซ็น webhook Stripe (กันคนปลอม event มาเครดิตเงินให้ตัวเอง)");
{
  const secret = "whsec_testsecret";
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const sign = (ts, b = body, key = secret) => createHmac("sha256", key).update(`${ts}.${b}`).digest("hex");
  const now = Math.floor(Date.now() / 1000);
  const old = now - 400; // เกิน tolerance 5 นาทีของ Stripe

  ok(verifyStripeSignature(body, `t=${now},v1=${sign(now)}`, secret) === true, "ลายเซ็นถูกต้อง = ผ่าน");
  ok(verifyStripeSignature(body, `t=${now},v1=deadbeef,v1=${sign(now)}`, secret) === true,
    "มี v1 หลายตัวตอนหมุนคีย์ = ผ่านถ้ามีตัวใดตัวหนึ่งถูก");
  ok(verifyStripeSignature(body, `t=${now},v0=${sign(now)},v1=${sign(now)}`, secret) === true, "มี v0 ปนมาไม่รบกวนการตรวจ");
  // v0 คือลายเซ็นปลอมที่ Stripe แถมมากับ test event — รับเมื่อไหร่คือเปิดทาง downgrade attack
  ok(verifyStripeSignature(body, `t=${now},v0=${sign(now)}`, secret) === false, "มีแต่ v0 = ปฏิเสธ (กัน downgrade attack)");
  ok(verifyStripeSignature(body + " ", `t=${now},v1=${sign(now)}`, secret) === false, "body ถูกแก้แม้ 1 ตัวอักษร = ปฏิเสธ");
  ok(verifyStripeSignature(body, `t=${now},v1=${sign(now)}`, "whsec_wrong") === false, "คีย์ผิด = ปฏิเสธ");
  ok(verifyStripeSignature(body, `t=${old},v1=${sign(old)}`, secret) === false, "ลายเซ็นถูกแต่เก่าเกิน 5 นาที = ปฏิเสธ (กัน replay)");
  ok(verifyStripeSignature(body, null, secret) === false, "ไม่มี header = ปฏิเสธ");
  ok(verifyStripeSignature(body, "garbage", secret) === false, "header เพี้ยน = ปฏิเสธ");
  ok(verifyStripeSignature(body, `t=${now},v1=ab`, secret) === false, "ลายเซ็นสั้นกว่าจริง = ปฏิเสธ (ห้าม throw)");
  ok(verifyStripeSignature(body, `t=${now},v1=${sign(now)}`, "") === false, "ยังไม่ได้ตั้ง webhook secret = ปฏิเสธทุกกรณี (fail-closed)");
}

// ============================================================
//  QR พร้อมเพย์ — โครงสร้างตามมาตรฐาน EMVCo
//
//  ⚠️ ทำไมต้องอยู่ในชุดตรวจ (เพิ่ม 6 ส.ค. 2569 — ไม่เคยถูกตรวจเลยตั้งแต่ทำมา)
//  QR ใบนี้คือสิ่งที่ "ลูกค้าของลูกค้า" เอามือถือไปสแกนจ่ายเงินจริง
//  ถ้า payload เพี้ยนแม้แต่ไบต์เดียว แอปธนาคารจะขึ้นว่า QR ไม่ถูกต้อง
//  แล้วร้านจะเก็บเงินไม่ได้ทั้งระบบ โดยที่หน้าเว็บเราดูปกติทุกอย่าง
//  (รูป QR ยังขึ้นสวยเหมือนเดิม — ความผิดพลาดมองไม่เห็นด้วยตาเลย)
//
//  ที่พังง่ายที่สุดคือ CRC16: มันคำนวณจากทุกอักขระ *รวม* "6304" ที่ต่อท้าย
//  ใครแก้ลำดับ tag แล้วลืมคิด CRC ใหม่ = QR ตายทั้งใบ
//  ตัวถอด TLV ในนี้เขียนแยกจากตัวสร้างโดยตั้งใจ จะได้ไม่ผิดพร้อมกันสองที่
// ============================================================
section("QR พร้อมเพย์ (มาตรฐาน EMVCo)");
{
  const parseTLV = (str) => {
    const out = {};
    let i = 0;
    while (i + 4 <= str.length) {
      const id = str.slice(i, i + 2);
      const len = Number(str.slice(i + 2, i + 4));
      if (!Number.isFinite(len)) break;
      out[id] = str.slice(i + 4, i + 4 + len);
      i += 4 + len;
    }
    return out;
  };
  const crc = (str) => {
    let c = 0xffff;
    for (let i = 0; i < str.length; i++) { c ^= str.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = (c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1) & 0xffff; }
    return c.toString(16).toUpperCase().padStart(4, "0");
  };

  for (const [target, kind, tag] of [
    ["0812345678", "เบอร์ 10 หลัก", "01"],
    ["1234567890123", "บัตร ปชช. 13 หลัก", "02"],
    ["123456789012345", "e-wallet 15 หลัก", "03"],
  ]) {
    const p = promptPayPayload(target, 1234.5);
    const t = parseTLV(p);
    const m = parseTLV(t["29"] ?? "");
    ok(t["00"] === "01" && t["01"] === "12", `${kind}: header ถูก`);
    ok(t["53"] === "764" && t["58"] === "TH", `${kind}: สกุลเงินบาท + ประเทศไทย`);
    ok(t["54"] === "1234.50", `${kind}: ยอดเงินทศนิยม 2 ตำแหน่ง`, t["54"]);
    ok(m["00"] === "A000000677010111", `${kind}: AID พร้อมเพย์`, m["00"]);
    ok(tag in m, `${kind}: ใช้ tag ${tag} ตามชนิดเลข`, Object.keys(m).join(","));
    ok(p.slice(-8, -4) === "6304", `${kind}: มี tag 6304 ก่อน CRC`);
    ok(p.endsWith(crc(p.slice(0, -4))), `${kind}: CRC16 ถูกต้อง`, p.slice(-4));
  }

  // เบอร์มือถือต้องกลายเป็นรูปแบบสากล ไม่ว่าจะพิมพ์มาแบบไหน
  ok(parseTLV(parseTLV(promptPayPayload("0812345678", 1))["29"])["01"] === "0066812345678",
    "0812345678 -> 0066812345678");
  ok(parseTLV(parseTLV(promptPayPayload("081-234-5678", 1))["29"])["01"] === "0066812345678",
    "มีขีดคั่นก็ได้ผลเดียวกัน");

  // ยอดที่เสี่ยงปัดเศษ — ยอดใน QR ต้องตรงกับยอดบนเอกสารเป๊ะ ไม่งั้นลูกค้าโอนผิด
  for (const [amt, want] of [[0.01, "0.01"], [1, "1.00"], [1234.5, "1234.50"], [99999.99, "99999.99"], [2340.51, "2340.51"]]) {
    const p = promptPayPayload("0812345678", amt);
    ok(parseTLV(p)["54"] === want, `ยอด ${amt} -> "${want}"`, parseTLV(p)["54"]);
    ok(p.endsWith(crc(p.slice(0, -4))), `ยอด ${amt}: CRC ยังถูกหลังเปลี่ยนยอด`);
  }
}

// ============================================================
//  ตัวหนังสือกำกับยอดเงิน + กฎเลือกเอกสารเข้า ภ.พ.30
//  (เพิ่ม 6 ส.ค. 2569 — ทั้งสองอย่างไม่เคยถูกทดสอบเลยตั้งแต่ทำระบบมา)
//
//  ตัวหนังสือขึ้นบน "ทุกใบ" ที่ลูกค้าพิมพ์ออกไป ผิดเมื่อไหร่คือผิดทุกใบพร้อมกัน
//  และภาษาไทยมีเคสที่หลุดง่ายมาก: สิบเอ็ด (ไม่ใช่สิบหนึ่ง) · ยี่สิบ (ไม่ใช่สองสิบ)
//  · ร้อยเอ็ด · ข้ามหลักล้าน · สตางค์ล้วนที่ไม่มีบาท
//
//  ส่วนกฎเลือกเอกสารคือสิ่งที่ตัดสินว่ายอดไหนเข้า ภ.พ.30 — ผิดแล้วลูกค้ายื่นภาษีผิด
//  เคสที่เคยพังจริง (26 ก.ค. 2569) ถูกใส่ไว้เป็นเทสต์ตรงนี้ทั้งหมด
// ============================================================
section("ตัวหนังสือกำกับยอดเงินบนเอกสาร");
{
  const t = (n, want) => ok(bahtText(n) === want, `${n} -> ${want}`, bahtText(n));
  t(0, "ศูนย์บาทถ้วน");
  t(10, "สิบบาทถ้วน");            // ไม่ใช่ "หนึ่งสิบ"
  t(11, "สิบเอ็ดบาทถ้วน");        // ไม่ใช่ "สิบหนึ่ง"
  t(20, "ยี่สิบบาทถ้วน");          // ไม่ใช่ "สองสิบ"
  t(101, "หนึ่งร้อยเอ็ดบาทถ้วน");
  t(5350, "ห้าพันสามร้อยห้าสิบบาทถ้วน");
  t(1000001, "หนึ่งล้านหนึ่งบาทถ้วน");     // ข้ามหลักล้านมาหน่วย
  t(1000000000, "หนึ่งพันล้านบาทถ้วน");
  t(0.25, "ยี่สิบห้าสตางค์");              // สตางค์ล้วน ไม่มีคำว่าบาท
  t(2340.51, "สองพันสามร้อยสี่สิบบาทห้าสิบเอ็ดสตางค์");
  t(-100, "ลบหนึ่งร้อยบาทถ้วน");           // ใบลดหนี้
  t(1234567.89, "หนึ่งล้านสองแสนสามหมื่นสี่พันห้าร้อยหกสิบเจ็ดบาทแปดสิบเก้าสตางค์");
}

section("กฎเลือกเอกสารเข้า ภ.พ.30 (ฝั่งขาย)");
{
  const doc = (o) => ({ doc_type: "invoice", status: "paid", vat_amount: 70, vat_mode: "exclusive", ...o });
  const picked = (o) => selectVatSalesDocs([doc(o)]).length === 1;

  ok(picked({}), "ใบแจ้งหนี้ปกติ = นับ");
  ok(!picked({ status: "draft" }), "ร่าง = ไม่นับ (ยังไม่ลงบัญชี)");
  ok(!picked({ status: "void" }), "ยกเลิก = ไม่นับ (กลับรายการไปแล้ว)");
  ok(!picked({ vat_mode: "none" }), "ไม่มี VAT = ไม่นับ");
  ok(!picked({ vat_amount: 0 }), "VAT เป็น 0 = ไม่นับ");
  ok(!picked({ doc_type: "quotation" }), "ใบเสนอราคา = ไม่นับ (ไม่ใช่ใบกำกับภาษี)");
  ok(!picked({ doc_type: "expense" }), "ค่าใช้จ่าย = ไม่นับในฝั่งขาย");
  // เคสที่เคยทำให้ยื่นภาษีขายเกินจริงหนึ่งเท่า
  ok(picked({ doc_type: "receipt", ref_doc_id: null }), "ใบเสร็จขายสด = นับ");
  ok(!picked({ doc_type: "receipt", ref_doc_id: "abc" }), "ใบเสร็จที่แปลงจากใบแจ้งหนี้ = ไม่นับซ้ำ");
  // ม.78/1 บริการขายเชื่อ — ความรับผิดเกิดตอนรับเงิน ไม่ใช่วันออกใบ
  ok(!picked({ tax_point: "payment" }), "ใบแจ้งหนี้บริการ (ม.78/1) = ไม่นับในเดือนที่ออกใบ");
  ok(picked({ tax_point: "delivery" }), "ใบแจ้งหนี้สินค้า (ม.78) = นับวันออกใบ");
  ok(picked({ doc_type: "credit_note" }) && picked({ doc_type: "debit_note" }),
    "ใบลดหนี้/ใบเพิ่มหนี้ = นับในเดือนที่ออก (ม.86/10, 86/9)");
  // เครื่องหมาย: เก็บยอดบวกเสมอ แล้วใส่เครื่องหมายตอนรวม
  ok(vatSign({ doc_type: "credit_note" }) === -1, "ใบลดหนี้ = เครื่องหมายลบ", String(vatSign({ doc_type: "credit_note" })));
  ok(vatSign({ doc_type: "invoice" }) === 1, "ใบแจ้งหนี้ = เครื่องหมายบวก");
  ok(vatSign({ doc_type: "debit_note" }) === 1, "ใบเพิ่มหนี้ = เครื่องหมายบวก");
}

console.log(failures === 0
  ? "\nสรุป: ผ่านทั้งหมด\n"
  : `\nสรุป: ไม่ผ่าน ${failures} ข้อ — ห้าม deploy จนกว่าจะแก้\n`);
process.exit(failures === 0 ? 0 : 1);
