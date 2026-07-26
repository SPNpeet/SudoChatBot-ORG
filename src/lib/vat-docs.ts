// ============================================================
//  กฎกลาง: เอกสารใบไหนนับเป็น "ภาษีขาย" / "ภาษีซื้อ" ของงวด
//
//  ทำไมต้องมีไฟล์นี้: เดิมกฎเลือกเอกสารเขียนซ้ำ 2 ที่ (หน้ารายงาน กับ ชุดส่งสำนักงานบัญชี)
//  แล้วเขียนไม่เหมือนกัน ผลคือตัวเลขบนจอกับตัวเลขในไฟล์ที่ส่งให้นักบัญชีไม่ตรงกัน
//  ซึ่งเป็นความผิดพลาดที่แพงที่สุดแบบหนึ่ง เพราะคนเอาไฟล์ไปกรอก ภ.พ.30 จริง
//
//  ── หลักที่ยึด: รายงานต้องตรงกับสมุดรายวันเสมอ ──────────────────
//  สมุดรายวันเครดิต "ภาษีขาย" ตอนออกใบแจ้งหนี้ (ดู finance/actions.ts saveDoc)
//  ส่วนใบเสร็จที่แปลงมาจากใบแจ้งหนี้ "ไม่ลงบัญชีขายซ้ำ" — ลงแค่การรับเงิน
//  ดังนั้นรายงานภาษีขายต้องนับที่ "ใบแจ้งหนี้" ไม่ใช่ "ใบเสร็จ" มิฉะนั้น
//  งบทดลองกับ ภ.พ.30 จะไม่ตรงกัน ซึ่งผู้สอบบัญชีจับได้ทันที
//
//  บั๊กที่แก้ด้วยกฎนี้ (พบจากการตรวจซ้ำ 26 ก.ค. 2569):
//   1) ใบแจ้งหนี้ออกเดือน มิ.ย. แล้วออกใบเสร็จเดือน ก.ค.
//      เดิมนับ VAT ทั้งสองเดือน = ยื่นภาษีขายเกินจริงหนึ่งเท่า
//   2) ชุดส่งสำนักงานบัญชีเอา "ใบเสนอราคา" มารวมในแท็บภาษีขายด้วย
//      ทั้งที่ใบเสนอราคาไม่ใช่ใบกำกับภาษีและไม่ก่อความรับผิด VAT
//   3) หน้ารายงานนับเอกสาร "ร่าง" ด้วย ทั้งที่ร่างยังไม่ลงบัญชี
//
//  ⚠️ ข้อจำกัดที่ยังเหลือ (แจ้งผู้ใช้แล้วในเอกสาร CPA-REVIEW):
//  ระบบยังไม่แยกบรรทัด "สินค้า" กับ "บริการ" จึงยึดจุดความรับผิดแบบสินค้า
//  (ม.78 — ส่งมอบ/ออกใบกำกับภาษี) กับทุกใบ ธุรกิจบริการล้วนที่ต้องการ
//  จุดความรับผิดตอนรับเงิน (ม.78/1) ให้ออกใบเสร็จรับเงินโดยไม่ต้องออกใบแจ้งหนี้ก่อน
// ============================================================

/** ฟิลด์ขั้นต่ำที่กฎนี้ต้องใช้ — ใครจะส่ง type อะไรเข้ามาก็ได้ ขอแค่มีเท่านี้ */
export interface VatDocLike {
  doc_type: string;
  status: string;
  vat_amount: number | string | null;
  ref_doc_id?: string | null;
  vat_mode?: string | null;
}

/** เอกสารที่ "มีผลทางบัญชีแล้ว" — ร่างยังไม่ลงบัญชี ยกเลิกกลับรายการไปแล้ว */
export function isPostedDoc(d: VatDocLike): boolean {
  return d.status !== "draft" && d.status !== "void";
}

function hasVat(d: VatDocLike): boolean {
  return d.vat_mode !== "none" && Number(d.vat_amount ?? 0) > 0;
}

/**
 * เอกสารที่นับเป็นภาษีขายของงวด (ใช้กรอก ภ.พ.30 ฝั่งขาย)
 *
 * นับ: ใบแจ้งหนี้ทุกใบ + ใบเสร็จที่เป็นการขายสด (ไม่ได้แปลงมาจากใบแจ้งหนี้)
 * ไม่นับ: ใบเสนอราคา · ค่าใช้จ่าย · ร่าง · ยกเลิก · ใบที่ไม่มี VAT
 *        · ใบเสร็จที่แปลงมาจากใบแจ้งหนี้ (นับที่ใบแจ้งหนี้ไปแล้ว)
 *
 * กฎนี้ตัดสินจากตัวเอกสารล้วน ๆ ไม่ต้องรู้ว่างวดไหน จึงกันการนับซ้ำข้ามเดือนได้
 * โดยไม่ทำให้รายงานของงวดที่ยื่นไปแล้วเปลี่ยนตัวเลขย้อนหลัง
 */
export function selectVatSalesDocs<T extends VatDocLike>(docs: T[]): T[] {
  return docs.filter((d) => {
    if (!isPostedDoc(d) || !hasVat(d)) return false;
    if (d.doc_type === "invoice") return true;
    if (d.doc_type === "receipt") return !d.ref_doc_id; // ขายสดเท่านั้น
    // ใบลดหนี้/ใบเพิ่มหนี้เข้า ภ.พ.30 ของเดือนที่ออก (ม.86/10, 86/9)
    // ใบลดหนี้ไปหักภาษีขาย ใบเพิ่มหนี้ไปบวก — ใช้ vatSign() คุมเครื่องหมาย
    if (d.doc_type === "credit_note" || d.doc_type === "debit_note") return true;
    return false;                                        // quotation / expense
  });
}

/**
 * เครื่องหมายของเอกสารในรายงานภาษี
 * เก็บยอดในฐานข้อมูลเป็นบวกเสมอ เพื่อให้ตัวเอกสารที่พิมพ์ออกมาอ่านได้ตรงไปตรงมา
 * แล้วค่อยใส่เครื่องหมายตอนรวมยอด — ใบลดหนี้ = -1
 */
export function vatSign(d: Pick<VatDocLike, "doc_type">): 1 | -1 {
  return d.doc_type === "credit_note" ? -1 : 1;
}

/** รวมภาษีขายของงวดโดยคิดเครื่องหมายใบลดหนี้/ใบเพิ่มหนี้ให้ถูก */
export function sumVat<T extends VatDocLike>(docs: T[]): number {
  return Math.round(docs.reduce((a, d) => a + vatSign(d) * Number(d.vat_amount ?? 0), 0) * 100) / 100;
}

/** รวมมูลค่าฐาน (ก่อน VAT) ของงวด คิดเครื่องหมายเช่นเดียวกัน */
export function sumBase<T extends VatDocLike & { total: number | string }>(docs: T[]): number {
  return Math.round(
    docs.reduce((a, d) => a + vatSign(d) * (Number(d.total) - Number(d.vat_amount ?? 0)), 0) * 100,
  ) / 100;
}

/** เอกสารที่นับเป็นภาษีซื้อของงวด (ใช้กรอก ภ.พ.30 ฝั่งซื้อ) */
export function selectVatPurchaseDocs<T extends VatDocLike>(docs: T[]): T[] {
  return docs.filter((d) => d.doc_type === "expense" && isPostedDoc(d) && hasVat(d));
}

/** รายการหัก ณ ที่จ่ายที่เรา "หักไว้และต้องนำส่ง" (ฝั่งจ่าย = ค่าใช้จ่าย) */
export function selectWhtPayableDocs<T extends VatDocLike & { wht_amount?: number | string | null }>(docs: T[]): T[] {
  return docs.filter((d) => d.doc_type === "expense" && isPostedDoc(d) && Number(d.wht_amount ?? 0) > 0);
}

/** รายการที่ "ลูกค้าหักเราไว้" — ใช้ตามเก็บหนังสือ 50 ทวิ */
export function selectWhtReceivableDocs<T extends VatDocLike & { wht_amount?: number | string | null }>(docs: T[]): T[] {
  return docs.filter((d) => {
    if (d.doc_type === "expense" || !isPostedDoc(d)) return false;
    if (Number(d.wht_amount ?? 0) <= 0) return false;
    if (d.doc_type === "receipt") return !d.ref_doc_id;
    return d.doc_type === "invoice";
  });
}
