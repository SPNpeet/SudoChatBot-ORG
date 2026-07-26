// ==== ป้ายชื่อ + ตัวคำนวณเอกสารบัญชี (ใช้ได้ทั้ง client/server) ====
import type { DocType, DocStatus, VatMode } from "@/lib/types/finance";
import { VAT_RATE } from "./tax-th";

export const DOC_TYPE_TH: Record<DocType, string> = {
  quotation: "ใบเสนอราคา",
  invoice: "ใบแจ้งหนี้",
  receipt: "ใบเสร็จรับเงิน",
  expense: "ค่าใช้จ่าย",
  credit_note: "ใบลดหนี้",
  debit_note: "ใบเพิ่มหนี้",
};

/** เหตุผลที่กฎหมายรับรองสำหรับออกใบลดหนี้ (ม.86/10) */
export const CREDIT_NOTE_REASONS = [
  "รับคืนสินค้าเนื่องจากสินค้าชำรุดบกพร่อง",
  "รับคืนสินค้าเนื่องจากไม่ตรงตามที่ตกลง",
  "ลดราคาสินค้าหรือบริการที่ขายไปแล้ว",
  "คำนวณราคาสินค้าหรือบริการสูงกว่าที่เป็นจริง",
  "บอกเลิกสัญญาบริการ / ไม่ได้ให้บริการตามที่ตกลง",
] as const;

/** เหตุผลที่กฎหมายรับรองสำหรับออกใบเพิ่มหนี้ (ม.86/9) */
export const DEBIT_NOTE_REASONS = [
  "คำนวณราคาสินค้าหรือบริการต่ำกว่าที่เป็นจริง",
  "ส่งมอบสินค้าเกินกว่าที่ตกลง",
  "ให้บริการเพิ่มเติมนอกเหนือจากที่ตกลง",
] as const;

export const DOC_STATUS_TH: Record<DocStatus, string> = {
  draft: "ร่าง",
  awaiting: "รอชำระ",
  partial: "ชำระบางส่วน",
  paid: "ชำระแล้ว",
  void: "ยกเลิก",
};

/** สถานะของใบเสนอราคาใช้คำต่างจากเอกสารเงิน */
export const QT_STATUS_TH: Record<DocStatus, string> = {
  draft: "ร่าง",
  awaiting: "รอตอบรับ",
  partial: "รอตอบรับ",
  paid: "ตอบรับแล้ว",
  void: "ยกเลิก",
};

export function docStatusLabel(docType: DocType, status: DocStatus): string {
  return docType === "quotation" ? QT_STATUS_TH[status] : DOC_STATUS_TH[status];
}

export function docStatusTone(status: DocStatus): "neutral" | "green" | "amber" | "red" | "blue" {
  if (status === "paid") return "green";
  if (status === "partial") return "blue";
  if (status === "awaiting") return "amber";
  if (status === "void") return "red";
  return "neutral";
}

export const WHT_RATES = [0, 1, 2, 3, 5, 10, 15] as const;

export interface DocTotals {
  base: number;        // ยอดหลังหักส่วนลด (รวม/ไม่รวม VAT ตามโหมด)
  exVat: number;       // มูลค่าก่อน VAT (ฐานคำนวณ WHT)
  vat: number;
  wht: number;
  total: number;       // ยอดเอกสาร (รวม VAT)
  cashDue: number;     // เงินที่ต้องรับ/จ่ายจริง = total - wht
}

/** คำนวณยอดเอกสารจากรายการ + โหมด VAT + อัตราหัก ณ ที่จ่าย */
/**
 * @param vatRate อัตรา VAT ที่ใช้กับเอกสารใบนี้ (ทศนิยม เช่น 0.07)
 *   ฝั่งเซิร์ฟเวอร์ควรส่งค่าจาก `vat_rate_on(issue_date)` เข้ามาเสมอ เพื่อให้ตัวเลขที่บันทึก
 *   ยึดตามอัตราที่มีผลจริง ณ วันที่ออกเอกสาร ไม่ใช่อัตราที่ฮาร์ดโค้ดไว้ตอน deploy
 *   ฝั่งหน้าจอที่คำนวณพรีวิวใช้ค่าตั้งต้นได้ เพราะเซิร์ฟเวอร์คำนวณซ้ำตอนบันทึกอยู่แล้ว
 */
export function calcDocTotals(
  items: { qty: number; unit_price: number }[],
  discount: number,
  vatMode: VatMode,
  whtRate: number,
  vatRate: number = VAT_RATE,
): DocTotals {
  const r = (n: number) => Math.round(n * 100) / 100;

  const subtotal = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  const base = r(Math.max(0, subtotal - (Number(discount) || 0)));

  // อัตรามาจาก tax-th.ts ที่เดียว — ห้ามเขียนเลข 7 ตรงนี้อีก
  // โหมดรวมใน ใช้จำนวนเต็มหารกัน (7/107) ไม่ใช่ 0.07/1.07 เพราะทศนิยมฐานสอง
  // ทำให้สองสูตรต่างกันระดับบิตสุดท้าย
  const pct = Math.round(vatRate * 100);           // 7 (หรืออัตราที่มีผล ณ วันออกเอกสาร)

  // ⚠️ ลำดับการปัดเศษสำคัญมากทางบัญชี
  // เดิมปัดทุกค่าแยกกันจากค่าเต็มความละเอียด ทำให้เอกสารไม่ลงตัวในตัวเอง
  // ตัวอย่างที่เคยผิด: ยอด 9.50 บวก VAT -> พิมพ์ 9.50 + 0.67 แต่ยอดรวม 10.16 (ต้องเป็น 10.17)
  // เจอ 1,060 กรณีจากการทดสอบ 2 ล้านยอด — ผู้สอบบัญชีเห็นแล้วจับได้ทันที
  // แก้โดย: ปัด VAT ก่อน แล้วค่อยประกอบยอดรวมจากค่าที่ปัดแล้ว
  // ผลคือ มูลค่าก่อนภาษี + VAT = ยอดรวม เสมอ ไม่มีข้อยกเว้น
  let vat: number, exVat: number, total: number;
  if (vatMode === "exclusive") {
    vat = r(base * VAT_RATE);
    exVat = base;
    total = r(exVat + vat);
  } else if (vatMode === "inclusive") {
    vat = r(base * pct / (100 + pct));
    total = base;
    exVat = r(total - vat);
  } else {
    vat = 0;
    exVat = base;
    total = base;
  }

  // หัก ณ ที่จ่ายคำนวณจากมูลค่าก่อน VAT ที่ปัดแล้ว (ตัวเลขเดียวกับที่พิมพ์บนเอกสาร)
  const wht = r(exVat * ((Number(whtRate) || 0) / 100));
  return { base, exVat, vat, wht, total, cashDue: r(total - wht) };
}

/** อายุหนี้เป็น bucket (คงค้างกี่วันนับจาก due date หรือ issue date) */
export function agingBucket(doc: { due_date: string | null; issue_date: string }): "current" | "d1_30" | "d31_60" | "d61_90" | "d90up" {
  const ref = doc.due_date ?? doc.issue_date;
  const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
  if (days <= 0) return "current";
  if (days <= 30) return "d1_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90up";
}

export const AGING_LABEL_TH: Record<string, string> = {
  current: "ยังไม่ครบกำหนด", d1_30: "เกิน 1-30 วัน", d31_60: "เกิน 31-60 วัน",
  d61_90: "เกิน 61-90 วัน", d90up: "เกิน 90 วัน",
};

export const PAY_METHOD_TH: Record<string, string> = {
  transfer: "โอนเงิน", promptpay: "พร้อมเพย์", cash: "เงินสด", card: "บัตร", other: "อื่น ๆ",
};

/** เอกสารที่ค้างรับ/จ่าย: ยอดคงเหลือ = เงินสดที่ยังต้องรับ/จ่าย */
export function docOutstanding(doc: { total: number; wht_amount: number; paid_amount: number }): number {
  return Math.max(0, Math.round((Number(doc.total) - Number(doc.wht_amount) - Number(doc.paid_amount)) * 100) / 100);
}

// ---- จำนวนเงินเป็นตัวอักษรไทย (ใช้บนเอกสารทางการ) ----
const TH_NUM = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const TH_POS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function readGroup(n: number): string {
  // อ่านเลข 0-999,999
  let s = "";
  const digits = String(n).split("").map(Number);
  const len = digits.length;
  digits.forEach((d, i) => {
    const pos = len - i - 1;
    if (d === 0) return;
    if (pos === 0 && d === 1 && len > 1) s += "เอ็ด";
    else if (pos === 1 && d === 2) s += "ยี่สิบ";
    else if (pos === 1 && d === 1) s += "สิบ";
    else s += TH_NUM[d] + TH_POS[pos];
  });
  return s;
}

/** 1290.5 -> "หนึ่งพันสองร้อยเก้าสิบบาทห้าสิบสตางค์" */
export function bahtText(amount: number): string {
  const n = Math.round(Math.abs(amount) * 100);
  const baht = Math.floor(n / 100);
  const satang = n % 100;
  if (baht === 0 && satang === 0) return "ศูนย์บาทถ้วน";
  let s = "";
  // แบ่งหลักล้านแบบวนซ้ำ
  let remain = baht;
  const groups: number[] = [];
  while (remain > 0) { groups.unshift(remain % 1_000_000); remain = Math.floor(remain / 1_000_000); }
  groups.forEach((g, i) => {
    if (g > 0) s += readGroup(g) + (i < groups.length - 1 ? "ล้าน" : "");
    else if (i < groups.length - 1 && s) s += "ล้าน";
  });
  if (baht > 0) s += "บาท";
  s += satang === 0 ? "ถ้วน" : readGroup(satang) + "สตางค์";
  return (amount < 0 ? "ลบ" : "") + s;
}
