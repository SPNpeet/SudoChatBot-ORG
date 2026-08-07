// ============================================================
//  ตรวจตัวจับคู่หัวคอลัมน์ของไฟล์ที่ลูกค้านำเข้า (เพิ่ม 8 ส.ค. 2569)
//
//  ⚠️ ทำไมต้องมี
//  ก่อนหน้านี้หน้ารายการเดินบัญชี "เดาคอลัมน์ แล้วถ้าไม่เจอให้ใช้คอลัมน์ที่ 0 กับ 1"
//  เดาผิด = อ่านยอดเงินจากคอลัมน์ผิด แล้วขึ้นว่านำเข้าสำเร็จ ไม่มี error ให้เห็นเลย
//  ตัวเลขแค่ผิด กว่าจะรู้คือตอนกระทบยอดไม่ลงหรือตอนยื่นภาษี
//
//  เคสในไฟล์นี้เอามาจากหัวตารางจริงที่ธนาคารไทยกับ Excel ของ SME ใช้กัน
//  ข้อที่อันตรายที่สุดคือ "ยอดคงเหลือ" ถูกจับเป็นยอดเงิน — ยอดจะเพี้ยนทั้งไฟล์
// ============================================================
import { matchColumns, missingRequired, STATEMENT_FIELDS, normalizeHeader } from "../src/lib/column-map.ts";

let failures = 0;
const ok = (cond, name, detail = "") => {
  if (!cond) { failures++; console.log(`  ผิด  ${name}${detail ? " — " + detail : ""}`); }
};

console.log("\n== จับคู่หัวคอลัมน์ไฟล์ที่ลูกค้านำเข้า ==");

// ---- ตัดรูปแบบที่ทำให้หัวเดียวกันดูต่างกัน ----
ok(normalizeHeader(" จำนวนเงิน (บาท) ") === "จำนวนเงินบาท", "ตัดช่องว่าง/วงเล็บ", normalizeHeader(" จำนวนเงิน (บาท) "));
ok(normalizeHeader("Amount_THB") === "amountthb", "ตัดขีดล่าง + ตัวพิมพ์ใหญ่", normalizeHeader("Amount_THB"));
ok(normalizeHeader("วันที่ ทำรายการ") === "วันที่ทำรายการ", "no-break space ของ Excel");

// ---- ธนาคารที่แยกคอลัมน์ฝาก/ถอน + มียอดคงเหลือ (เคสที่พังง่ายสุด) ----
{
  const h = ["วันที่", "รายการ", "ถอนเงิน", "ฝากเงิน", "ยอดคงเหลือ"];
  const m = matchColumns(h, STATEMENT_FIELDS);
  ok(m.date.index === 0, "วันที่", String(m.date.index));
  ok(m.desc.index === 1, "รายละเอียด", String(m.desc.index));
  ok(m.amountIn.index === 3, "เงินเข้าต้องเป็น 'ฝากเงิน' ไม่ใช่ 'ถอนเงิน'/'ยอดคงเหลือ'", String(m.amountIn.index));
  ok(m.amountOut.index === 2, "เงินออกต้องเป็น 'ถอนเงิน'", String(m.amountOut.index));
  ok(!missingRequired(STATEMENT_FIELDS, m).length, "ช่องบังคับครบ");
}

// ---- หัวตารางอังกฤษ ----
{
  const h = ["Date", "Description", "Withdrawal", "Deposit", "Balance"];
  const m = matchColumns(h, STATEMENT_FIELDS);
  ok(m.amountIn.index === 3, "Deposit = เงินเข้า", String(m.amountIn.index));
  ok(m.amountOut.index === 2, "Withdrawal = เงินออก", String(m.amountOut.index));
}

// ---- ไฟล์คอลัมน์เดียว (มีแต่ 'จำนวนเงิน') ----
{
  const h = ["วันที่", "รายละเอียด", "จำนวนเงิน"];
  const m = matchColumns(h, STATEMENT_FIELDS);
  ok(m.amount.index === 2, "จำนวนเงินคอลัมน์เดียว", String(m.amount.index));
  ok(m.amountIn.index === -1, "ไม่มีคอลัมน์เงินเข้า ต้องคืน -1 ไม่ใช่เดามั่ว", String(m.amountIn.index));
  ok(missingRequired(STATEMENT_FIELDS, m).some((f) => f.key === "amountIn"), "ต้องรายงานว่าช่องบังคับขาด");
}

// ---- ห้ามจับ 'ยอดคงเหลือ' มาเป็นยอดเงิน (บั๊กที่แพงที่สุด) ----
{
  const h = ["วันที่", "รายการ", "ยอดคงเหลือ"];
  const m = matchColumns(h, STATEMENT_FIELDS);
  ok(m.amount.index === -1, "'ยอดคงเหลือ' ห้ามถูกจับเป็นจำนวนเงิน", String(m.amount.index));
  ok(m.amountIn.index === -1, "'ยอดคงเหลือ' ห้ามถูกจับเป็นเงินเข้า", String(m.amountIn.index));
}

// ---- ห้ามใช้คอลัมน์เดียวซ้ำสองช่อง ----
{
  const h = ["วันที่", "เงินเข้า"];
  const m = matchColumns(h, STATEMENT_FIELDS);
  ok(m.amountIn.index === 1, "เงินเข้าจับได้", String(m.amountIn.index));
  ok(m.amount.index !== 1, "คอลัมน์เดียวห้ามถูกใช้ซ้ำโดยช่องอื่น", String(m.amount.index));
}

// ---- หัวคอลัมน์ว่าง/ไฟล์ไม่มีหัว ----
{
  const m = matchColumns(["", "", ""], STATEMENT_FIELDS);
  ok(m.date.index === -1 && m.amountIn.index === -1, "ไฟล์ไม่มีหัวคอลัมน์ = คืน -1 ทุกช่อง ห้ามเดา");
  ok(missingRequired(STATEMENT_FIELDS, m).length === 2, "ต้องบอกว่าขาดช่องบังคับ 2 ช่อง");
}

// ---- ห้ามให้ 'วันครบกำหนด' มาเป็นวันที่ทำรายการ ----
{
  const h = ["วันครบกำหนด", "วันที่ทำรายการ", "ฝาก"];
  const m = matchColumns(h, STATEMENT_FIELDS);
  ok(m.date.index === 1, "'วันครบกำหนด' ห้ามถูกจับเป็นวันที่ทำรายการ", String(m.date.index));
}

console.log(failures === 0
  ? "  ถูก  ผ่านทุกเคส\n"
  : `\nสรุป: ไม่ผ่าน ${failures} ข้อ — ห้าม deploy จนกว่าจะแก้\n`);
process.exit(failures === 0 ? 0 : 1);
