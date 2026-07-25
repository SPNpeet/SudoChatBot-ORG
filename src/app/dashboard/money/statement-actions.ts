"use server";
// ============================================================
//  แกะ statement ธนาคารจากไฟล์ PDF (ฝั่งเซิร์ฟเวอร์)
//
//  ทำไมต้องทำฝั่งเซิร์ฟเวอร์: pdf.js ในเบราว์เซอร์ต้องตั้ง worker เอง ซึ่งพังง่ายเวลา build
//  unpdf เป็น build ที่ทำมาสำหรับ serverless โดยเฉพาะ ไม่ต้องมีไฟล์ worker เลย
//
//  ⚠ ปรัชญาสำคัญ: ฟังก์ชันนี้ "อ่านมาเสนอ" เท่านั้น ไม่บันทึกอะไรลงบัญชีทั้งสิ้น
//  ผู้ใช้ต้องกดยืนยันเป็นรายแถวเองเสมอ (เหมือน CSV/Excel เดิม) — อ่านเพี้ยนจึงไม่ทำให้บัญชีเสีย
// ============================================================
import { assertMember } from "@/lib/shop";

export interface ParsedStmtRow { date: string; desc: string; amount: number }
export type ParseResult =
  | { ok: true; rows: ParsedStmtRow[]; pages: number; note?: string }
  | { ok: false; error: string };

const MAX_BYTES = 10 * 1024 * 1024;   // 10MB — statement ปกติไม่กี่ร้อย KB
const MAX_ROWS = 200;

/** คำที่บอกว่าเป็น "เงินออก" — statement ไทยใช้คำพวกนี้ เราสนใจเฉพาะเงินเข้า */
const OUT_WORDS = /ถอน|โอนออก|ชำระ(ค่า|บิล)|ค่าธรรมเนียม|ดอกเบี้ยจ่าย|หักบัญชี|debit|withdraw|payment|fee|transfer out/i;
/** คำที่ยืนยันว่าเป็นเงินเข้า */
const IN_WORDS = /เงินเข้า|โอนเข้า|รับโอน|ฝาก|รับเงิน|เข้าบัญชี|deposit|credit|transfer in|received/i;

/** dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd (พ.ศ. ก็จับได้ เพราะเก็บเป็นข้อความไว้ให้คนอ่านตรวจ) */
const DATE_RE = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/;
/** จำนวนเงินต้องมีทศนิยม 2 ตำแหน่ง — กันไปจับเลขที่บัญชี/เลขอ้างอิงมาเป็นยอดเงิน */
const MONEY_RE = /-?\d{1,3}(?:,\d{3})*\.\d{2}\b/g;

function toNumber(s: string) {
  return Math.round(Number(s.replace(/,/g, "")) * 100) / 100;
}

export async function parseStatementPdf(shopId: string, form: FormData): Promise<ParseResult> {
  try {
    await assertMember(shopId, ["owner", "admin", "agent"]);

    const file = form.get("file");
    if (!(file instanceof File)) return { ok: false, error: "ไม่พบไฟล์" };
    if (file.size > MAX_BYTES) return { ok: false, error: "ไฟล์ใหญ่เกิน 10MB — ลองแยกเป็นรายเดือน" };

    const buf = new Uint8Array(await file.arrayBuffer());
    // ตรวจ magic number จริง ไม่เชื่อนามสกุลไฟล์
    if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) {
      return { ok: false, error: "ไฟล์นี้ไม่ใช่ PDF" };
    }

    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buf);
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const full = Array.isArray(text) ? text.join("\n") : text;

    if (!full || full.replace(/\s/g, "").length < 40) {
      return {
        ok: false,
        error: "PDF นี้เป็นไฟล์รูปสแกน ไม่มีตัวหนังสือให้อ่าน — ให้โหลดไฟล์ CSV/Excel จากแอปธนาคารแทน (แม่นกว่ามาก) หรือถ่ายรูปสลิปทีละใบให้ผู้ช่วย AI อ่านก็ได้",
      };
    }

    const rows: ParsedStmtRow[] = [];
    for (const rawLine of full.split(/\r?\n/)) {
      const line = rawLine.replace(/\s+/g, " ").trim();
      if (line.length < 8 || rows.length >= MAX_ROWS) continue;

      const dateM = line.match(DATE_RE);
      if (!dateM) continue;                              // ไม่มีวันที่ = ไม่ใช่แถวธุรกรรม

      const amounts = line.match(MONEY_RE);
      if (!amounts?.length) continue;

      const hasOut = OUT_WORDS.test(line);
      const hasIn = IN_WORDS.test(line);
      if (hasOut && !hasIn) continue;                    // เงินออกชัดเจน ข้าม

      // statement ส่วนใหญ่ปิดท้ายบรรทัดด้วย "ยอดคงเหลือ" — ตัวก่อนหน้าคือยอดธุรกรรม
      const amt = amounts.length >= 2 ? toNumber(amounts[amounts.length - 2]) : toNumber(amounts[0]);
      if (!(amt > 0)) continue;

      const desc = line
        .replace(DATE_RE, "")
        .replace(MONEY_RE, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);

      rows.push({ date: dateM[1], desc: desc || "รายการจาก statement", amount: amt });
    }

    if (!rows.length) {
      return {
        ok: false,
        error: "อ่าน PDF ได้ แต่หาแถวเงินเข้าไม่เจอ — รูปแบบ statement ของแต่ละธนาคารต่างกันมาก แนะนำโหลดเป็น CSV/Excel จากแอปธนาคารจะแม่นกว่า",
      };
    }

    return {
      ok: true,
      rows,
      pages: totalPages,
      note: "อ่านจาก PDF เป็นการเดารูปแบบ — กรุณาตรวจวันที่และยอดทุกแถวก่อนกดบันทึก",
    };
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (msg.startsWith("forbidden")) return { ok: false, error: "ไม่มีสิทธิ์ในกิจการนี้" };
    console.error("parseStatementPdf", msg);
    return { ok: false, error: "อ่านไฟล์ PDF ไม่สำเร็จ — ไฟล์อาจเสียหายหรือมีรหัสผ่านล็อกอยู่" };
  }
}
