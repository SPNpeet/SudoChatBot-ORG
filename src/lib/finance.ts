// ==== ป้ายชื่อ + ตัวคำนวณเอกสารบัญชี (ใช้ได้ทั้ง client/server) ====
import type { DocType, DocStatus, VatMode } from "@/lib/types/finance";

export const DOC_TYPE_TH: Record<DocType, string> = {
  quotation: "ใบเสนอราคา",
  invoice: "ใบแจ้งหนี้",
  receipt: "ใบเสร็จรับเงิน",
  expense: "ค่าใช้จ่าย",
};

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
export function calcDocTotals(
  items: { qty: number; unit_price: number }[],
  discount: number,
  vatMode: VatMode,
  whtRate: number,
): DocTotals {
  const subtotal = items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  const base = Math.max(0, subtotal - (Number(discount) || 0));
  let vat = 0, exVat = base, total = base;
  if (vatMode === "exclusive") { vat = base * 0.07; exVat = base; total = base + vat; }
  else if (vatMode === "inclusive") { vat = base * 7 / 107; exVat = base - vat; total = base; }
  const wht = exVat * ((Number(whtRate) || 0) / 100);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { base: r(base), exVat: r(exVat), vat: r(vat), wht: r(wht), total: r(total), cashDue: r(total - wht) };
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
