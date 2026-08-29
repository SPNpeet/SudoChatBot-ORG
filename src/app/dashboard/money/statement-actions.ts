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
import { parseStatementText, explainNoRows, type ParsedStmtRow } from "@/lib/statement-parse";

export type { ParsedStmtRow };
export type ParseResult =
  | { ok: true; rows: ParsedStmtRow[]; pages: number; note?: string }
  | { ok: false; error: string };

const MAX_BYTES = 10 * 1024 * 1024;   // 10MB — statement ปกติไม่กี่ร้อย KB

/** จำนวนเงินต้องมีทศนิยม 2 ตำแหน่ง — กันไปจับเลขที่บัญชี/เลขอ้างอิงมาเป็นยอดเงิน */
const MONEY_RE = /-?\d{1,3}(?:,\d{3})*\.\d{2}\b/g;

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

    // ตรรกะแกะแถวอยู่ที่ src/lib/statement-parse.ts ที่เดียว (ด่านตรวจเรียกตัวเดียวกัน)
    const parsed = parseStatementText(full);
    const rows = parsed.rows;

    if (!rows.length) {
      return { ok: false, error: explainNoRows(parsed) };
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
