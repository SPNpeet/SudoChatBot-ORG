// ============================================================
//  มาตรฐานไฟล์โอนย้ายข้อมูลกรมสรรพากร (RD Prep)
//  - คั่นคอลัมน์ด้วย pipe | เท่านั้น
//  - ล้างอักขระต้องห้ามในข้อมูล (| ขึ้นบรรทัด แท็บ) กันคอลัมน์เพี้ยน
//  - วันที่ DD/MM/YYYY พุทธศักราช
//  - เข้ารหัสไฟล์ TIS-620 (มาตรฐานภาษาไทยของโปรแกรมสรรพากร)
// ============================================================

/** ล้างข้อความก่อนลงไฟล์ RD: ตัด pipe/ขึ้นบรรทัด/แท็บ + ยุบช่องว่างซ้ำ */
export function rdClean(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/[|\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** "2026-07-23" -> "23/07/2569" (พ.ศ.) */
export function rdDateBE(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear() + 543;
  return `${dd}/${mm}/${yyyy}`;
}

/** จำนวนเงินบนไฟล์ RD: ทศนิยม 2 ตำแหน่ง ไม่มีคอมมา */
export function rdAmount(n: number | string | null | undefined): string {
  return (Math.round(Number(n ?? 0) * 100) / 100).toFixed(2);
}

// ============================================================
//  ตรวจข้อมูลก่อนโหลดไฟล์ยื่น
//
//  ทำไมต้องมี: คนโหลดไฟล์ตอนดึก ๆ ของวันที่ 6-7 แล้วเปิด RD Prep
//  ถึงเพิ่งรู้ว่าข้อมูลไม่ครบ ต้องกลับมาไล่แก้ทีละใบตอนใกล้หมดเวลา
//  ระบบรู้ตั้งแต่ก่อนโหลดอยู่แล้วว่าแถวไหนมีปัญหา จึงต้องบอกก่อน ไม่ใช่ปล่อยไป
//
//  ตรวจเฉพาะสิ่งที่ "รู้แน่ว่าผิด" ไม่เดา — ถ้าไม่แน่ใจปล่อยผ่านดีกว่าเตือนผิด
// ============================================================

export interface RdRowIssue {
  docNumber: string;
  contactName: string;
  problems: string[];
}

interface RdCheckable {
  doc_number: string;
  contact_name: string | null;
  contact_tax_id: string | null;
  contact_address: string | null;
  wht_income_type: string | null;
  wht_rate: number | string;
  wht_amount: number | string;
  total: number | string;
  vat_amount: number | string;
}

/** เลข 13 หลักผ่านสูตร check digit ของกรมสรรพากรไหม */
function taxIdOk(raw: string | null | undefined): boolean {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
}

/** มีตัวอักษรที่ TIS-620 เก็บไม่ได้ไหม (จะกลายเป็นช่องว่างในไฟล์) */
function hasUnencodable(s: string | null | undefined): boolean {
  for (const ch of String(s ?? "")) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x80 && !(cp >= 0x0e01 && cp <= 0x0e5b)) return true;
  }
  return false;
}

/** ตรวจทุกแถวที่จะลงไฟล์ ภ.ง.ด. — คืนเฉพาะแถวที่มีปัญหา */
export function checkRdWhtRows(rows: RdCheckable[]): RdRowIssue[] {
  const out: RdRowIssue[] = [];
  for (const r of rows) {
    const p: string[] = [];
    const digits = (r.contact_tax_id ?? "").replace(/\D/g, "");

    if (!digits) p.push("ไม่มีเลขประจำตัวผู้เสียภาษี");
    else if (digits.length !== 13) p.push(`เลขผู้เสียภาษีมี ${digits.length} หลัก (ต้องครบ 13)`);
    else if (!taxIdOk(digits)) p.push("เลขผู้เสียภาษีไม่ผ่านการตรวจหลักสุดท้าย น่าจะพิมพ์ผิด");

    if (!String(r.contact_name ?? "").trim()) p.push("ไม่มีชื่อผู้ถูกหัก");
    if (!String(r.contact_address ?? "").trim()) p.push("ไม่มีที่อยู่ผู้ถูกหัก");
    if (!r.wht_income_type) p.push("ไม่ได้ระบุประเภทเงินได้ตามมาตรา 40");
    if (!(Number(r.wht_rate) > 0)) p.push("อัตราหัก ณ ที่จ่ายเป็น 0");
    if (!(Number(r.wht_amount) > 0)) p.push("ยอดภาษีที่หักเป็น 0");
    if (!(Number(r.total) - Number(r.vat_amount) > 0)) p.push("ยอดเงินที่จ่าย (ก่อน VAT) เป็น 0");

    // ชื่อ/ที่อยู่ที่มีตัวอักษรนอกภาษาไทยและอังกฤษจะกลายเป็นช่องว่างในไฟล์
    if (hasUnencodable(r.contact_name)) p.push("ชื่อมีตัวอักษรที่ไฟล์สรรพากรเก็บไม่ได้ (เช่น อิโมจิ หรือภาษาอื่น)");
    if (hasUnencodable(r.contact_address)) p.push("ที่อยู่มีตัวอักษรที่ไฟล์สรรพากรเก็บไม่ได้");

    if (p.length) out.push({ docNumber: r.doc_number, contactName: r.contact_name ?? "(ไม่มีชื่อ)", problems: p });
  }
  return out;
}

/**
 * กำหนดยื่น ภ.ง.ด.3/53 ของเดือนที่จ่ายเงิน
 * ม.52 — ภายใน 7 วันนับแต่วันสิ้นเดือน · ยื่นออนไลน์ได้ขยายเพิ่มอีก 8 วัน
 * คืนวันกระดาษกับวันออนไลน์ให้แสดงคู่กัน ผู้ใช้จะได้ไม่พลาดเพราะจำผิดว่าใช้วันไหน
 */
export function whtDueDates(periodMonth: string): { paper: string; online: string } | null {
  if (!/^\d{4}-\d{2}$/.test(periodMonth)) return null;
  const y = Number(periodMonth.slice(0, 4));
  const m = Number(periodMonth.slice(5, 7));
  const paper = new Date(Date.UTC(y, m, 7));         // วันที่ 7 ของเดือนถัดไป
  const online = new Date(Date.UTC(y, m, 15));       // +8 วัน
  return { paper: paper.toISOString().slice(0, 10), online: online.toISOString().slice(0, 10) };
}

/**
 * เข้ารหัสข้อความเป็น TIS-620 (single-byte):
 * ASCII < 0x80 ตรงตัว · อักษรไทย U+0E01–U+0E5B -> 0xA1–0xFB · อื่น ๆ แทนด้วยช่องว่าง
 */
export function encodeTis620(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out[n++] = cp;
    else if (cp >= 0x0e01 && cp <= 0x0e5b) out[n++] = cp - 0x0e01 + 0xa1;
    else out[n++] = 0x20;
  }
  return out.slice(0, n);
}
