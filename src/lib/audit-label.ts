// ============================================================
//  แปลง audit log ให้คนอ่านรู้เรื่อง
//
//  ทำไมต้องมี: หน้า Audit Log เดิมโชว์ดิบ ๆ ว่า
//    fin_doc_created · fin_doc:857bffa8 · {"total":250,"status":"awaiting","doc_type":...}
//  ซึ่งอ่านไม่ออกว่าเกิดอะไรขึ้น ต้องแปล JSON ในหัวเองทุกแถว
//  เจ้าของบอกว่า "Log เหมือนไม่ตรงจริง ๆ เก็บอะไรบ้าง ต้องการสิ่งที่จำเป็นจริง ๆ พอ"
//
//  หลักที่ยึด: log มีไว้ตอบ 3 คำถามเท่านั้น — ใคร ทำอะไร กับอะไร
//  รายละเอียดที่เหลือ (uuid เต็ม ๆ · ฟิลด์ภายใน) ไม่ช่วยตอบ 3 ข้อนี้ จึงไม่ต้องโชว์
//  แต่ยังเก็บไว้ในฐานข้อมูลครบ ไม่ได้ลบทิ้ง (ต้องใช้ตอนสอบสวนย้อนหลัง)
// ============================================================

/** ชื่อเหตุการณ์ภาษาคน — ครอบคลุม action ที่เกิดจริงในระบบ */
export const AUDIT_ACTION_TH: Record<string, string> = {
  fin_doc_created: "ออกเอกสาร",
  fin_doc_voided: "ยกเลิกเอกสาร",
  fin_payment_recorded: "บันทึกรับ/จ่ายเงิน",
  expense_approved: "อนุมัติค่าใช้จ่าย",
  expense_rejected: "ไม่อนุมัติค่าใช้จ่าย",
  credit_note_issued: "ออกใบลดหนี้",
  debit_note_issued: "ออกใบเพิ่มหนี้",
  assistant_doc_created: "AI ออกเอกสารให้",
  assistant_expense_created: "AI บันทึกค่าใช้จ่ายให้",
  products_bulk_import: "นำเข้าสินค้า",
  period_locked: "ปิดงวดบัญชี",
  plan_changed: "เปลี่ยนแพ็กเกจ",
  admin_shop_plan_changed: "แอดมินเปลี่ยนแพ็กให้กิจการ",
  admin_shop_status_changed: "แอดมินเปลี่ยนสถานะกิจการ",
  ai_quota_override_set: "ตั้งเพดานโควตา AI",
  ai_key_updated: "อัปเดตคีย์ AI",
  ai_purpose_key_updated: "อัปเดตคีย์ AI ตามงาน",
  ai_routing_updated: "ปรับการเลือกใช้ AI",
  platform_admin_added: "เพิ่มผู้ดูแลแพลตฟอร์ม",
  topup_confirmed: "ยืนยันการเติมเงิน",
  topup_rejected: "ปฏิเสธการเติมเงิน",
  client_error: "ข้อผิดพลาดฝั่งผู้ใช้",
};

const baht = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("th-TH", { minimumFractionDigits: 2 }) + " บาท" : null;
};

const DOC_TH: Record<string, string> = {
  quotation: "ใบเสนอราคา", invoice: "ใบแจ้งหนี้", receipt: "ใบเสร็จ",
  expense: "ค่าใช้จ่าย", credit_note: "ใบลดหนี้", debit_note: "ใบเพิ่มหนี้",
};
const STATUS_TH: Record<string, string> = {
  draft: "ร่าง", awaiting: "รอชำระ", partial: "ชำระบางส่วน", paid: "ชำระครบ", void: "ยกเลิก",
};

/**
 * สรุปรายละเอียดเป็นข้อความสั้นภาษาคน — เลือกเฉพาะฟิลด์ที่ตอบว่า "กับอะไร"
 * คืน "" เมื่อไม่มีอะไรที่คนต้องรู้ (ดีกว่าโชว์ JSON เปล่า ๆ)
 */
export function auditSummary(action: string, d: Record<string, unknown> | null): string {
  if (!d) return "";
  const parts: string[] = [];
  const num = typeof d.doc_number === "string" ? d.doc_number : typeof d.doc === "string" ? d.doc : null;
  if (num) parts.push(num);
  if (typeof d.doc_type === "string" && DOC_TH[d.doc_type] && !num) parts.push(DOC_TH[d.doc_type]);

  const money = baht(d.total ?? d.amount);
  if (money) parts.push(money);

  if (d.direction === "in") parts.push("เงินเข้า");
  else if (d.direction === "out") parts.push("เงินออก");

  if (typeof d.status === "string" && STATUS_TH[d.status]) parts.push(STATUS_TH[d.status]);
  if (d.approval === true || d.approval === "pending") parts.push("รออนุมัติ");
  if (typeof d.reason === "string" && d.reason.trim()) parts.push(`เหตุผล: ${d.reason.trim().slice(0, 60)}`);
  if (typeof d.plan === "string") parts.push(`แพ็ก ${d.plan}`);
  if (typeof d.provider === "string") parts.push(d.provider);
  if (typeof d.last4 === "string") parts.push(`คีย์ลงท้าย ${d.last4}`);
  if (typeof d.locked_through === "string") parts.push(`ถึง ${d.locked_through}`);
  if (typeof d.override === "number") parts.push(`${d.override} งาน/วัน`);
  if (typeof d.imported === "number") parts.push(`นำเข้า ${d.imported} รายการ`);
  if (typeof d.skipped === "number" && d.skipped > 0) parts.push(`ข้าม ${d.skipped}`);
  if (typeof d.message === "string") parts.push(d.message.slice(0, 80));

  return parts.join(" · ");
}

/** ชื่อเหตุการณ์ที่อ่านได้ — ไม่รู้จักก็คืนชื่อดิบ ดีกว่าโชว์ว่าง */
export const auditActionLabel = (action: string) => AUDIT_ACTION_TH[action] ?? action;
