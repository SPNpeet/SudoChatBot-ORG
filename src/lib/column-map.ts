// ============================================================
//  จับคู่หัวคอลัมน์ของไฟล์ที่ลูกค้าเอามาเอง กับช่องที่ระบบต้องการ
//
//  ⚠️ ทำไมต้องมีไฟล์นี้ (8 ส.ค. 2569)
//  ไฟล์ที่ลูกค้าส่งมาไม่มีวันหน้าตาเหมือนกัน — statement ของแต่ละธนาคาร
//  ไฟล์สินค้าที่ export จากระบบเดิม ไฟล์ที่พิมพ์เองใน Excel
//  หัวคอลัมน์เดียวกันเขียนได้สิบแบบ: "จำนวนเงิน" · "ยอด" · "Amount" · "Amount (THB)"
//  · "เงินเข้า" · "ฝาก" · "Deposit" · "รับเงิน" ยังไม่นับเว้นวรรค/วงเล็บ/ตัวพิมพ์
//
//  ของเดิมที่หน้ารายการเดินบัญชีทำคือ "เดาแล้วถ้าไม่เจอให้ใช้คอลัมน์ที่ 0 กับ 1"
//  ซึ่งเป็นพฤติกรรมที่อันตรายที่สุดเท่าที่จะเป็นไปได้ในงานเงิน:
//  เดาผิด = ยอดเงินไปอ่านจากคอลัมน์ผิด แล้ว "นำเข้าสำเร็จ" โดยไม่มี error ให้เห็น
//  ตัวเลขแค่ผิด ซึ่งกว่าจะรู้คือตอนกระทบยอดไม่ลงหรือตอนยื่นภาษี
//
//  กติกาของไฟล์นี้:
//   1. เดาให้เก่งที่สุด แต่ **ไม่เดาแบบมั่ว** — ไม่มั่นใจให้คืน -1 ไปเลย
//   2. ช่องที่ขาดไม่ได้ (เช่น ยอดเงิน) ถ้าจับคู่ไม่ได้ ต้องให้คนเลือกเอง ห้ามใช้ค่า default
//   3. ให้คะแนนความมั่นใจกลับไปด้วย หน้าจอจะได้บอกได้ว่า "เดาให้แล้ว ตรวจหน่อย"
// ============================================================

/** ตัดสิ่งที่ทำให้หัวคอลัมน์เดียวกันดูไม่เหมือนกัน: ช่องว่าง วงเล็บ จุด ขีด ตัวพิมพ์ */
export function normalizeHeader(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/ /g, " ")               // no-break space ที่ Excel ชอบใส่มา
    .replace(/[()[\]{}."'`,:;/\\|_-]/g, " ")
    .replace(/\s+/g, "")
    .trim();
}

export interface FieldSpec {
  /** ชื่อช่องในระบบเรา */
  key: string;
  /** ชื่อที่โชว์ให้ผู้ใช้เลือก */
  label: string;
  /** ขาดไม่ได้ — จับคู่ไม่ได้ต้องหยุดแล้วให้คนเลือก */
  required?: boolean;
  /** คำที่ตรงเป๊ะแล้วมั่นใจสุด */
  exact: string[];
  /** คำที่ถ้าโผล่อยู่ในหัวคอลัมน์ก็นับว่าใช่ */
  contains?: string[];
  /** คำที่ถ้าเจอแปลว่า "ไม่ใช่แน่นอน" — กันจับผิดฝั่ง เช่น เงินออกไปโดนเงินเข้า */
  exclude?: string[];
}

export interface MatchResult {
  /** ดัชนีคอลัมน์ที่จับคู่ได้ · -1 = จับคู่ไม่ได้ ต้องให้คนเลือก */
  index: number;
  /** exact = ตรงเป๊ะ · partial = เจอคำอยู่ข้างใน · none = ไม่เจอ */
  confidence: "exact" | "partial" | "none";
}

/**
 * จับคู่ทีละช่อง — คืนดัชนีคอลัมน์ + ความมั่นใจ
 *
 * ให้คะแนนแบบ "ตรงเป๊ะชนะเสมอ" เพราะไฟล์จริงมีหัวคอลัมน์ที่กินกันเอง
 * เช่น ไฟล์มีทั้ง "ยอดเงิน" กับ "ยอดคงเหลือ" — ถ้าใช้ contains อย่างเดียว
 * "ยอดคงเหลือ" อาจถูกเลือกก่อนเพราะอยู่คอลัมน์ซ้ายกว่า แล้วยอดที่นำเข้าจะกลายเป็นยอดคงเหลือ
 */
export function matchColumn(headers: unknown[], spec: FieldSpec, used: Set<number> = new Set()): MatchResult {
  const norm = headers.map(normalizeHeader);
  const bad = (h: string) => (spec.exclude ?? []).some((x) => h.includes(normalizeHeader(x)));

  for (let i = 0; i < norm.length; i++) {
    if (used.has(i) || !norm[i] || bad(norm[i])) continue;
    if (spec.exact.some((e) => norm[i] === normalizeHeader(e))) return { index: i, confidence: "exact" };
  }
  const parts = [...spec.exact, ...(spec.contains ?? [])].map(normalizeHeader).filter(Boolean);
  for (let i = 0; i < norm.length; i++) {
    if (used.has(i) || !norm[i] || bad(norm[i])) continue;
    if (parts.some((p) => norm[i].includes(p))) return { index: i, confidence: "partial" };
  }
  return { index: -1, confidence: "none" };
}

/**
 * จับคู่ทั้งชุด — ช่องที่จับได้แล้วจะไม่ถูกใช้ซ้ำโดยช่องถัดไป
 * เรียงลำดับ spec ตามความสำคัญ (ช่องที่ห้ามผิดที่สุดไว้บนสุด)
 */
export function matchColumns(headers: unknown[], specs: FieldSpec[]): Record<string, MatchResult> {
  const used = new Set<number>();
  const out: Record<string, MatchResult> = {};
  for (const spec of specs) {
    const r = matchColumn(headers, spec, used);
    if (r.index >= 0) used.add(r.index);
    out[spec.key] = r;
  }
  return out;
}

/** ช่องบังคับที่ยังจับคู่ไม่ได้ — หน้าจอต้องหยุดแล้วให้คนเลือกก่อนนำเข้า */
export function missingRequired(specs: FieldSpec[], m: Record<string, MatchResult>): FieldSpec[] {
  return specs.filter((s) => s.required && (m[s.key]?.index ?? -1) < 0);
}

// ---------- ชุดคำสำหรับไฟล์รายการเดินบัญชีธนาคาร ----------
//
// เรียง "เงินเข้า" ไว้ก่อน "จำนวนเงิน" โดยตั้งใจ: ไฟล์ธนาคารไทยส่วนใหญ่มีคอลัมน์
// ฝาก/ถอน แยกกัน ถ้าไปจับ "จำนวนเงิน" ก่อนอาจได้ยอดถอนมาเป็นเงินเข้า
export const STATEMENT_FIELDS: FieldSpec[] = [
  {
    key: "date", label: "วันที่", required: true,
    exact: ["วันที่", "date", "วันเดือนปี", "transactiondate", "วันที่ทำรายการ", "postingdate"],
    contains: ["วันที่", "date"],
    exclude: ["duedate", "วันครบกำหนด"],
  },
  {
    key: "amountIn", label: "เงินเข้า / ฝาก", required: true,
    exact: ["เงินเข้า", "ฝาก", "deposit", "credit", "รับเงิน", "เงินฝาก", "จำนวนเงินเข้า", "creditamount"],
    contains: ["เงินเข้า", "ฝาก", "deposit", "credit", "รับ"],
    // ห้ามไปโดนคอลัมน์ยอดคงเหลือ/เงินออก
    exclude: ["คงเหลือ", "balance", "ถอน", "withdraw", "debit", "เงินออก", "จ่าย"],
  },
  {
    key: "amountOut", label: "เงินออก / ถอน (ถ้ามี)",
    exact: ["เงินออก", "ถอน", "withdraw", "withdrawal", "debit", "จ่ายเงิน", "เงินถอน"],
    contains: ["ถอน", "withdraw", "เงินออก"],
    exclude: ["คงเหลือ", "balance", "ฝาก", "deposit"],
  },
  {
    key: "desc", label: "รายละเอียด",
    exact: ["รายละเอียด", "รายการ", "description", "detail", "memo", "หมายเหตุ", "channel", "ช่องทาง", "คำอธิบาย"],
    contains: ["รายละเอียด", "รายการ", "desc", "detail", "memo", "หมายเหตุ"],
  },
  {
    key: "amount", label: "จำนวนเงิน (ไฟล์ที่มีคอลัมน์เดียว)",
    exact: ["จำนวนเงิน", "ยอดเงิน", "amount", "ยอด", "amountthb", "จำนวน"],
    contains: ["จำนวนเงิน", "amount"],
    exclude: ["คงเหลือ", "balance", "ยอดยกมา"],
  },
];
