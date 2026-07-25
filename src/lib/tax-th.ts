// ============================================================
//  กติกาเอกสารภาษีไทย — รวมไว้ที่เดียว แก้ที่นี่ที่เดียวมีผลทั้งระบบ
//  อ้างอิง: ประมวลรัษฎากร ม.86/4 (ใบกำกับภาษีเต็มรูป), ม.50 ทวิ (หนังสือรับรองหัก ณ ที่จ่าย),
//           ประกาศอธิบดีกรมสรรพากรฯ ฉบับที่ 199 (บังคับระบุสำนักงานใหญ่/สาขา ตั้งแต่ 1 ม.ค. 2558)
//
//  ⚠️ ไฟล์นี้เป็นการตีความข้อกฎหมายเพื่อทำซอฟต์แวร์ ไม่ใช่คำแนะนำทางภาษี
//     ผู้ใช้ควรให้ผู้สอบบัญชี/ผู้ทำบัญชีของตัวเองตรวจก่อนยื่นจริง
// ============================================================

/** ประเภทเงินได้พึงประเมินตามมาตรา 40 — ใช้บน 50 ทวิ และไฟล์ยื่น ภ.ง.ด.3/53 */
export const WHT_INCOME_TYPES = [
  { code: "40(1)", label: "40(1) เงินเดือน ค่าจ้างแรงงาน", desc: "เงินเดือน ค่าจ้าง", form: "ภ.ง.ด.1" },
  { code: "40(2)", label: "40(2) ค่านายหน้า ค่ารับทำงานให้ ค่าตำแหน่งงาน", desc: "ค่านายหน้า/รับทำงานให้", form: "ภ.ง.ด.3/53" },
  { code: "40(3)", label: "40(3) ค่าแห่งกู๊ดวิลล์ ค่าลิขสิทธิ์ หรือสิทธิอย่างอื่น", desc: "ค่าลิขสิทธิ์/กู๊ดวิลล์", form: "ภ.ง.ด.3/53" },
  { code: "40(4)", label: "40(4) ดอกเบี้ย เงินปันผล", desc: "ดอกเบี้ย/เงินปันผล", form: "ภ.ง.ด.2" },
  { code: "40(5)", label: "40(5) ค่าเช่าทรัพย์สิน", desc: "ค่าเช่าทรัพย์สิน", form: "ภ.ง.ด.3/53" },
  { code: "40(6)", label: "40(6) วิชาชีพอิสระ — โรคศิลปะ กฎหมาย วิศวกรรม สถาปัตยกรรม บัญชี ประณีตศิลปกรรม", desc: "ค่าวิชาชีพอิสระ", form: "ภ.ง.ด.3/53" },
  { code: "40(7)", label: "40(7) รับเหมาที่ผู้รับเหมาต้องลงทุนจัดหาสัมภาระเอง", desc: "ค่าจ้างรับเหมา", form: "ภ.ง.ด.3/53" },
  { code: "40(8)", label: "40(8) ธุรกิจ พาณิชย์ ขนส่ง บริการอื่น ๆ (ใช้บ่อยที่สุด)", desc: "ค่าบริการ/ค่าจ้างทำของ", form: "ภ.ง.ด.3/53" },
] as const;

/** คำบรรยายสั้นสำหรับใส่ในไฟล์ยื่นสรรพากร — RD Prep รับเป็นข้อความ ไม่ใช่รหัสมาตรา */
export function whtIncomeDesc(code: string | null | undefined): string {
  return WHT_INCOME_TYPES.find((t) => t.code === code)?.desc ?? "ค่าบริการ/ค่าจ้างทำของ";
}

/**
 * อัตราหัก ณ ที่จ่ายที่ใช้บ่อยของแต่ละงาน (จ่ายในประเทศ)
 *
 * ⚠️ สำคัญ: นี่คือ "ตัวช่วยกรอก" ไม่ใช่คำวินิจฉัยทางภาษี
 * อัตราจริงขึ้นกับหลายปัจจัย เช่น ผู้รับเงินเป็นบุคคลธรรมดาหรือนิติบุคคล
 * เป็นการจ่ายในประเทศหรือต่างประเทศ และมีประกาศเฉพาะเรื่องหรือไม่
 * ระบบจึงแค่ "เติมให้ก่อน" แล้วให้ผู้ใช้/ผู้ทำบัญชียืนยันหรือแก้เองได้เสมอ
 */
export const WHT_PRESETS = [
  { key: "service", label: "ค่าบริการ / ค่าจ้างทำของ", rate: 3, income: "40(8)", note: "งานบริการทั่วไป จ้างทำของ รับเหมา" },
  { key: "transport", label: "ค่าขนส่ง", rate: 1, income: "40(8)", note: "ผู้ประกอบการขนส่งที่ขึ้นทะเบียน" },
  { key: "ads", label: "ค่าโฆษณา", rate: 2, income: "40(8)", note: "จ่ายค่าโฆษณาให้เอเจนซี/สื่อ" },
  { key: "rent", label: "ค่าเช่าทรัพย์สิน", rate: 5, income: "40(5)", note: "เช่าอาคาร ที่ดิน รถ อุปกรณ์" },
  { key: "profession", label: "ค่าวิชาชีพอิสระ", rate: 3, income: "40(6)", note: "แพทย์ ทนาย บัญชี วิศวกร สถาปนิก" },
  { key: "commission", label: "ค่านายหน้า", rate: 3, income: "40(2)", note: "จ่ายให้นิติบุคคล — ถ้าจ่ายให้บุคคลธรรมดาต้องดูอัตราก้าวหน้า" },
  { key: "royalty", label: "ค่าลิขสิทธิ์ / สิทธิอื่น", rate: 3, income: "40(3)", note: "จ่ายให้นิติบุคคลในประเทศ" },
  { key: "dividend", label: "เงินปันผล", rate: 10, income: "40(4)", note: "ยื่นด้วย ภ.ง.ด.2" },
  { key: "interest", label: "ดอกเบี้ย", rate: 1, income: "40(4)", note: "จ่ายให้นิติบุคคล 1% · บุคคลธรรมดา 15%" },
] as const;

/** อัตราที่แนะนำเมื่อผู้ใช้เลือกประเภทเงินได้ — ใช้เติมให้อัตโนมัติ ไม่ได้บังคับ */
export function suggestedWhtRate(incomeCode: string | null | undefined): number | null {
  const p = WHT_PRESETS.find((x) => x.income === incomeCode);
  return p ? p.rate : null;
}

export type WhtIncomeCode = (typeof WHT_INCOME_TYPES)[number]["code"];

/** ค่าตั้งต้นที่ปลอดภัยที่สุดสำหรับ SME — ค่าบริการทั่วไปเข้า 40(8) */
export const DEFAULT_WHT_INCOME = "40(8)";

export function whtIncomeLabel(code: string | null | undefined): string {
  if (!code) return "";
  return WHT_INCOME_TYPES.find((t) => t.code === code)?.label ?? code;
}

/**
 * สาขาให้แสดงบนเอกสาร — กฎหมายบังคับคำว่า "สำนักงานใหญ่" หรือ "สาขาที่ ....."
 * ผู้ใช้อาจกรอกมาแค่ "1" หรือ "00001" หรือเว้นว่าง จึงต้องแปลงให้เป็นรูปแบบที่ถูกต้องเสมอ
 */
export function branchLabel(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "สำนักงานใหญ่";
  if (/สำนักงานใหญ่|head\s*office/i.test(s)) return "สำนักงานใหญ่";
  const digits = s.match(/\d+/)?.[0];
  if (digits) return `สาขาที่ ${digits.padStart(5, "0")}`;
  return s;
}

/**
 * รหัสสาขา 5 หลักสำหรับไฟล์ยื่นสรรพากร — สำนักงานใหญ่ = 00000, สาขาที่ 1 = 00001
 * (คนละรูปแบบกับข้อความบนใบกำกับภาษี ซึ่งต้องเป็นคำว่า "สำนักงานใหญ่" เต็ม ๆ)
 */
export function branchCode(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s || /สำนักงานใหญ่|head\s*office/i.test(s)) return "00000";
  const digits = s.match(/\d+/)?.[0];
  return digits ? digits.padStart(5, "0").slice(-5) : "00000";
}

/**
 * ผู้ถูกหักเป็นนิติบุคคลไหม — ตัดสินจากเลข 13 หลัก
 *  · เลขทะเบียนนิติบุคคล ขึ้นต้นด้วย 0  -> ภ.ง.ด.53
 *  · เลขบัตรประชาชนบุคคลธรรมดา ขึ้นต้น 1-8 -> ภ.ง.ด.3
 * ⚠️ ต้องมีที่เดียวในระบบ ถ้าเขียนซ้ำหลายที่แล้วเพี้ยนกัน
 *    หนังสือ 50 ทวิ จะบอกแบบหนึ่ง แต่ไฟล์ที่ยื่นจริงเป็นอีกแบบ = ยื่นผิดแบบ
 */
export function isJuristicPerson(taxId: string | null | undefined): boolean {
  const d = (taxId ?? "").replace(/\D/g, "");
  return d.length === 13 && d.startsWith("0");
}

/** แบบยื่นที่ต้องใช้กับรายการหัก ณ ที่จ่ายรายนี้ */
export function rdFormFor(taxId: string | null | undefined, incomeCode: string | null | undefined): string {
  const t = WHT_INCOME_TYPES.find((x) => x.code === incomeCode);
  if (t?.form === "ภ.ง.ด.1") return "ภ.ง.ด.1";
  if (t?.form === "ภ.ง.ด.2") return "ภ.ง.ด.2";
  return isJuristicPerson(taxId) ? "ภ.ง.ด.53" : "ภ.ง.ด.3";
}

export interface TaxInvoiceIssue { field: string; why: string }

/**
 * ตรวจว่าเอกสารที่กำลังจะพิมพ์ "ใบกำกับภาษี" มีของครบตาม ม.86/4 ไหม
 * ขาดข้อไหน = ผู้ซื้อขอคืนภาษีซื้อไม่ได้ และผู้ขายเสี่ยงเบี้ยปรับ
 * จึงต้องเตือนบนหน้าจอก่อน ไม่ใช่ปล่อยพิมพ์ออกไปเงียบ ๆ
 */
export function checkTaxInvoice(input: {
  sellerName?: string | null; sellerAddress?: string | null; sellerTaxId?: string | null;
  buyerName?: string | null; buyerAddress?: string | null; buyerTaxId?: string | null;
  docNumber?: string | null; issueDate?: string | null; itemCount: number;
}): TaxInvoiceIssue[] {
  const out: TaxInvoiceIssue[] = [];
  const need = (ok: unknown, field: string, why: string) => { if (!ok) out.push({ field, why }); };

  need(input.sellerName?.trim(), "ชื่อผู้ขาย", "ม.86/4 (2) ต้องมีชื่อผู้ประกอบการจดทะเบียน — ตั้งที่ ตั้งค่า › ข้อมูลกิจการ");
  need(input.sellerAddress?.trim(), "ที่อยู่ผู้ขาย", "ม.86/4 (2) ต้องมีที่อยู่ผู้ประกอบการจดทะเบียน");
  need(/^\d{13}$/.test((input.sellerTaxId ?? "").replace(/\D/g, "")), "เลขผู้เสียภาษีผู้ขาย", "ม.86/4 (2) ต้องเป็นเลข 13 หลัก");
  need(input.buyerName?.trim(), "ชื่อผู้ซื้อ", "ม.86/4 (3) ต้องมีชื่อผู้ซื้อ/ผู้รับบริการ");
  need(input.buyerAddress?.trim(), "ที่อยู่ผู้ซื้อ", "ม.86/4 (3) ต้องมีที่อยู่ผู้ซื้อ — แก้ที่หน้าผู้ติดต่อ");
  need(input.docNumber?.trim(), "เลขที่เอกสาร", "ม.86/4 (4) ต้องมีหมายเลขลำดับ");
  need(input.issueDate, "วันที่", "ม.86/4 (7) ต้องมีวัน เดือน ปี ที่ออก");
  need(input.itemCount > 0, "รายการสินค้า/บริการ", "ม.86/4 (5) ต้องมีชื่อ ชนิด ปริมาณ และมูลค่า");
  return out;
}

/** เลขผู้เสียภาษี 13 หลัก แสดงแบบอ่านง่าย 1-2345-67890-12-3 */
export function formatTaxId(raw: string | null | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 13) return raw ?? "";
  return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
}
