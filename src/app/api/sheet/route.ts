// ============================================================
//  สร้าง/อ่านไฟล์ตาราง ฝั่งเซิร์ฟเวอร์
//
//  ทำไมไม่ทำในเบราว์เซอร์:
//   · exceljs ฝั่ง client ลากโค้ด zip ของ Node (archiver, zip-stream) ติดไปด้วย
//     วัดได้จริง 912 KB ต่อผู้ใช้ทุกคน และเป็นแพ็กเกจที่มี advisory ค้างอยู่
//   · ทำฝั่งเซิร์ฟเวอร์แล้ว: ผู้ใช้โหลด 0 KB เพิ่ม, โค้ดชุดนั้นไม่เคยไปอยู่บนเครื่องผู้ใช้,
//     และเช็คสิทธิ์ได้ก่อนปล่อยข้อมูลออก (ฝั่ง client เช็คไม่ได้จริง)
//
//  POST ?action=build  body: { fileName, sheets:[{name, rows}] }  -> ไฟล์ .xlsx
//  POST ?action=parse  multipart: file                            -> { rows: unknown[][] }
// ============================================================
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_UPLOAD = 8 * 1024 * 1024;
const MAX_ROWS = 20000;

interface SheetSpec { name: string; rows: Record<string, unknown>[] }

export async function POST(req: Request) {
  // ต้องล็อกอินเสมอ — ทั้งสองทางแตะข้อมูลของผู้ใช้
  try { await requireUser(); }
  catch { return NextResponse.json({ ok: false, error: "ต้องเข้าสู่ระบบก่อน" }, { status: 401 }); }

  const action = new URL(req.url).searchParams.get("action");

  // ---------- อ่านไฟล์ที่ผู้ใช้อัปโหลด ----------
  if (action === "parse") {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "ไม่พบไฟล์" }, { status: 400 });
    if (file.size > MAX_UPLOAD) return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกิน 8MB" }, { status: 400 });
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) return NextResponse.json({ ok: true, rows: [] });
      const rows: unknown[][] = [];
      ws.eachRow({ includeEmpty: false }, (r) => {
        if (rows.length >= MAX_ROWS) return;
        rows.push((r.values as unknown[]).slice(1).map(cellText));
      });
      return NextResponse.json({ ok: true, rows });
    } catch {
      return NextResponse.json({ ok: false, error: "อ่านไฟล์ Excel ไม่สำเร็จ — ไฟล์อาจเสียหายหรือมีรหัสผ่าน" }, { status: 400 });
    }
  }

  // ---------- สร้างไฟล์ .xlsx ----------
  if (action === "build") {
    let body: { fileName?: string; sheets?: SheetSpec[] };
    try { body = await req.json(); }
    catch { return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }

    const sheets = (body.sheets ?? []).filter((s) => Array.isArray(s.rows) && s.rows.length);
    if (!sheets.length) return NextResponse.json({ ok: false, error: "ไม่มีข้อมูลให้ส่งออก" }, { status: 400 });
    if (sheets.reduce((a, s) => a + s.rows.length, 0) > MAX_ROWS) {
      return NextResponse.json({ ok: false, error: "ข้อมูลเกิน 20,000 แถว — แบ่งเป็นช่วงเวลาย่อยแล้วโหลดใหม่" }, { status: 400 });
    }

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "SudoChatBot";
    wb.created = new Date();

    for (const spec of sheets) {
      // ชื่อ sheet: Excel ห้ามเกิน 31 ตัว และห้ามมี : \ / ? * [ ]
      const ws = wb.addWorksheet((spec.name || "รายงาน").replace(/[:\\/?*[\]]/g, "-").slice(0, 31));
      const headers = Object.keys(spec.rows[0]);
      ws.columns = headers.map((h) => ({
        header: h, key: h,
        width: Math.min(46, Math.max(12, h.length + 2, ...spec.rows.slice(0, 300).map((r) => String(r[h] ?? "").length + 2))),
      }));
      ws.addRows(spec.rows);

      const head = ws.getRow(1);
      head.font = { bold: true, color: { argb: "FF1F2937" } };
      head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
      head.alignment = { vertical: "middle" };
      ws.views = [{ state: "frozen", ySplit: 1 }];        // หัวตารางค้างไว้ตอนเลื่อน
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

      // คอลัมน์ที่เป็นตัวเลข = เงิน จัดรูปแบบให้พร้อมใช้ทันที ไม่ต้องมานั่งจัดเอง
      headers.forEach((h, i) => {
        if (spec.rows.some((r) => typeof r[h] === "number")) {
          const col = ws.getColumn(i + 1);
          col.numFmt = "#,##0.00";
          col.alignment = { horizontal: "right" };
        }
      });
    }

    const buf = await wb.xlsx.writeBuffer();
    const name = (body.fileName ?? "report.xlsx").replace(/[^\w.\-ก-๙ ]/g, "_");
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ ok: false, error: "action ไม่ถูกต้อง" }, { status: 400 });
}

/** ค่าจาก exceljs อาจเป็น object (สูตร/ลิงก์/rich text) ต้องดึงข้อความจริงออกมา */
function cellText(v: unknown): string | number {
  if (v == null) return "";
  if (typeof v === "number" || typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
  if (o.richText) return o.richText.map((t) => t.text).join("");
  if (o.result != null) return String(o.result);
  if (o.text != null) return String(o.text);
  return String(v);
}
