// ============================================================
//  แกะแถวธุรกรรมจากข้อความ statement ธนาคาร (ตรรกะล้วน ไม่แตะ PDF/สิทธิ์/ฐานข้อมูล)
//
//  ⚠️ ปรัชญาที่ห้ามเปลี่ยน: ที่นี่ "อ่านมาเสนอ" เท่านั้น ไม่บันทึกอะไรลงบัญชี
//  ผู้ใช้กดยืนยันเป็นรายแถวเสมอ — อ่านเพี้ยนจึงไม่ทำให้บัญชีเสีย
//  แต่ "เสนอผิด" ยังกินเวลาคนตรวจ และที่แย่กว่านั้นคือเสนอ *เงินออก* เป็น *เงินเข้า*
//  ซึ่งถ้าคนกดผ่านเร็ว ๆ จะได้รายได้ปลอมเข้าบัญชี — จึงต้องระวังเรื่องคอลัมน์เป็นพิเศษ
//
//  ⚠️ บั๊กที่แก้รอบนี้ (29 ส.ค. 2569) — เจ้าของแคปหน้าจอ "หาแถวเงินเข้าไม่เจอ" มาให้ดู
//  1. เดิมเดาว่า "เลขตัวสุดท้ายคือยอดคงเหลือ ตัวรองสุดท้ายคือยอดธุรกรรม"
//     แต่ statement ไทยส่วนใหญ่มี 3 คอลัมน์ตัวเลข: ถอน · ฝาก · คงเหลือ
//     แถวที่เป็นการถอน ช่องฝากจะว่าง ทำให้สกัดเลขได้แค่ 2 ตัว (ถอน, คงเหลือ)
//     สูตรเดิมจึงหยิบ "ยอดถอน" มาเสนอเป็นเงินเข้า = เสนอผิดทิศทางเงิน
//  2. ตัวแยกเงินเข้า/ออกดูจากคำในบรรทัดอย่างเดียว แต่ statement จำนวนมากไม่มีคำพวกนั้นเลย
//     (ใช้ตำแหน่งคอลัมน์แทน) พอไม่มีคำ ระบบก็เดาว่าเป็นเงินเข้าทั้งหมด
//  3. บาง PDF สกัดข้อความออกมาแล้ววันที่กับยอดเงินคนละบรรทัด ทำให้ไม่เจอแถวเลยสักแถว
//     ทั้งที่ไฟล์อ่านออกปกติ — เป็นที่มาของข้อความ "อ่าน PDF ได้ แต่หาแถวเงินเข้าไม่เจอ"
// ============================================================

export interface ParsedStmtRow { date: string; desc: string; amount: number }

export interface ParseTextResult {
  rows: ParsedStmtRow[];
  /** บรรทัดที่มีวันที่แต่ไม่ได้ถูกใช้ — เอาไว้บอกผู้ใช้ว่าทำไมถึงไม่เจอ ไม่ใช่ปล่อยให้เดา */
  datedLines: number;
  skippedAsOutgoing: number;
  /** จับได้ว่าเรียงคอลัมน์แบบ ถอน-ฝาก-คงเหลือ จากหัวตารางในไฟล์ */
  layout: "withdraw-deposit-balance" | "single-amount" | "unknown";
}

const MAX_ROWS = 200;

/** คำที่บอกว่าเป็น "เงินออก" — statement ไทยใช้คำพวกนี้ เราสนใจเฉพาะเงินเข้า */
const OUT_WORDS = /ถอน|โอนออก|ชำระ(ค่า|บิล)|ค่าธรรมเนียม|ดอกเบี้ยจ่าย|หักบัญชี|debit|withdraw|payment|fee|transfer out/i;
/** คำที่ยืนยันว่าเป็นเงินเข้า */
const IN_WORDS = /เงินเข้า|โอนเข้า|รับโอน|ฝาก|รับเงิน|เข้าบัญชี|deposit|credit|transfer in|received/i;

/** dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd (พ.ศ. ก็จับได้ เพราะเก็บเป็นข้อความไว้ให้คนอ่านตรวจ) */
const DATE_RE = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/;
const DATE_RE_G = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/g;
/** จำนวนเงินต้องมีทศนิยม 2 ตำแหน่ง — กันไปจับเลขที่บัญชี/เลขอ้างอิงมาเป็นยอดเงิน */
const MONEY_RE = /-?\d{1,3}(?:,\d{3})*\.\d{2}\b/g;

/** หัวตารางที่บอกว่ามีคอลัมน์ถอนกับฝากแยกกัน */
const HDR_WITHDRAW = /ถอนเงิน|ถอน|debit|withdrawal/i;
const HDR_DEPOSIT = /ฝากเงิน|ฝาก|credit|deposit/i;
const HDR_BALANCE = /คงเหลือ|ยอดคงเหลือ|balance/i;

function toNumber(s: string) {
  return Math.round(Number(s.replace(/,/g, "")) * 100) / 100;
}

/**
 * ดูหัวตารางเพื่อรู้ว่าไฟล์นี้เรียงคอลัมน์ตัวเลขยังไง
 * รู้แล้วจะเลิกเดาว่า "ตัวรองสุดท้ายคือยอดธุรกรรม" ซึ่งเป็นต้นเหตุของการเสนอผิดทิศ
 */
function detectLayout(lines: string[]): ParseTextResult["layout"] {
  for (const l of lines.slice(0, 60)) {
    if (HDR_BALANCE.test(l) && HDR_WITHDRAW.test(l) && HDR_DEPOSIT.test(l)) return "withdraw-deposit-balance";
  }
  return "unknown";
}

/**
 * บาง PDF สกัดข้อความแล้ววันที่กับยอดเงินตกคนละบรรทัด
 * ถ้าอ่านทีละบรรทัดตรง ๆ จะไม่เจอแถวไหนเลย ทั้งที่ข้อมูลครบ
 * จึงต่อบรรทัดสั้น ๆ ที่ยังไม่มีตัวเลขเข้ากับบรรทัดถัดไป จนกว่าจะได้ทั้งวันที่และยอด
 */
function stitchLines(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (DATE_RE.test(line) && !MONEY_RE.test(line)) {
      MONEY_RE.lastIndex = 0;
      // มองไปข้างหน้าไม่เกิน 3 บรรทัด — ไกลกว่านั้นมักเป็นคนละแถวแล้ว
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        line += " " + lines[j];
        MONEY_RE.lastIndex = 0;
        if (MONEY_RE.test(lines[j])) { i = j; break; }
        // เจอวันที่ใหม่ = ขึ้นแถวใหม่แล้ว หยุดต่อ
        if (DATE_RE.test(lines[j])) break;
      }
    }
    MONEY_RE.lastIndex = 0;
    out.push(line);
  }
  return out;
}

/** เลือก "ยอดเงินเข้า" จากตัวเลขในแถว — คืน null เมื่อไม่มั่นใจว่าเป็นเงินเข้า */
function pickIncome(nums: number[], layout: ParseTextResult["layout"], hasIn: boolean): number | null {
  if (!nums.length) return null;

  // มี 3 ตัวเลขขึ้นไป + รู้ว่าเรียง ถอน-ฝาก-คงเหลือ => ช่องกลางคือเงินเข้า
  // ถ้าช่องกลางเป็น 0 แปลว่าแถวนี้เป็นการถอน ไม่ใช่เงินเข้า
  if (nums.length >= 3 && layout === "withdraw-deposit-balance") {
    const deposit = nums[nums.length - 2];
    return deposit > 0 ? deposit : null;
  }

  // เหลือ 2 ตัวเลข (ยอด + คงเหลือ) ในไฟล์ที่มีคอลัมน์ถอน/ฝากแยกกัน
  // = ช่องใดช่องหนึ่งว่าง ซึ่งบอกไม่ได้ว่าเป็นถอนหรือฝาก
  // ⚠️ เดิมตรงนี้เดาว่าเป็นเงินเข้าเสมอ ทำให้ "ยอดถอน" ถูกเสนอเป็นรายได้
  // ต้องมีคำยืนยันว่าเป็นเงินเข้าเท่านั้นจึงรับ ไม่งั้นข้ามไป ให้คนกรอกเอง
  if (nums.length === 2 && layout === "withdraw-deposit-balance") {
    return hasIn ? nums[0] : null;
  }

  // รูปแบบทั่วไป: ตัวสุดท้ายคือยอดคงเหลือ ตัวก่อนหน้าคือยอดธุรกรรม
  const amt = nums.length >= 2 ? nums[nums.length - 2] : nums[0];
  return amt > 0 ? amt : null;
}

export function parseStatementText(text: string): ParseTextResult {
  const rawLines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const layout = detectLayout(rawLines);
  const lines = stitchLines(rawLines);

  const rows: ParsedStmtRow[] = [];
  let datedLines = 0;
  let skippedAsOutgoing = 0;

  for (const line of lines) {
    if (line.length < 8 || rows.length >= MAX_ROWS) continue;

    const dateM = line.match(DATE_RE);
    if (!dateM) continue;
    datedLines++;

    MONEY_RE.lastIndex = 0;
    const amounts = line.match(MONEY_RE);
    if (!amounts?.length) continue;

    const hasOut = OUT_WORDS.test(line);
    const hasIn = IN_WORDS.test(line);
    if (hasOut && !hasIn) { skippedAsOutgoing++; continue; }

    const amt = pickIncome(amounts.map(toNumber), layout, hasIn);
    if (amt === null || !(amt > 0)) { skippedAsOutgoing++; continue; }

    const desc = line
      .replace(DATE_RE_G, "")
      .replace(MONEY_RE, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);

    rows.push({ date: dateM[1], desc: desc || "รายการจาก statement", amount: amt });
  }

  return { rows, datedLines, skippedAsOutgoing, layout };
}

/**
 * ข้อความบอกผู้ใช้ตอนหาแถวไม่เจอ — ต้องบอก "ทำไม" ที่วัดได้จริง ไม่ใช่ขอโทษลอย ๆ
 * เจ้าของเจอข้อความเดิมแล้วไปต่อไม่ถูก เพราะมันไม่บอกว่าไฟล์มีปัญหาตรงไหน
 */
export function explainNoRows(r: ParseTextResult): string {
  if (r.datedLines === 0) {
    return "อ่าน PDF ได้ แต่ไม่เจอบรรทัดที่มีวันที่เลย — ไฟล์นี้อาจเป็นใบสรุปยอด ไม่ใช่รายการเดินบัญชี "
      + "ให้โหลดไฟล์ CSV/Excel จากแอปธนาคารแทน (แม่นกว่ามาก)";
  }
  if (r.skippedAsOutgoing > 0) {
    return `อ่านได้ ${r.datedLines} แถว แต่ทุกแถวเป็นเงินออกหรือแยกไม่ได้ว่าเข้าหรือออก จึงไม่มีอะไรให้เสนอ `
      + "(ระบบนำเข้าเฉพาะเงินเข้า) — ถ้าเดือนนี้มีเงินเข้าจริง ให้โหลดเป็น CSV/Excel จากแอปธนาคารจะแม่นกว่า";
  }
  return `อ่านได้ ${r.datedLines} แถวที่มีวันที่ แต่ไม่เจอยอดเงินรูปแบบ 1,234.56 ในแถวเหล่านั้น `
    + "— รูปแบบ statement ของแต่ละธนาคารต่างกันมาก แนะนำโหลดเป็น CSV/Excel จากแอปธนาคารจะแม่นกว่า";
}
