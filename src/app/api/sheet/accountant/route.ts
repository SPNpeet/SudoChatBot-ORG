// ============================================================
//  ชุดส่งสำนักงานบัญชี — รวมทุกรายงานของงวดไว้ในไฟล์ Excel เดียว หลายแท็บ
//
//  ทำไมต้องมี: เดิมเจ้าของกิจการต้องเข้าไปทีละแท็บแล้วกดโหลดทีละไฟล์
//  แล้วส่งอีเมล 5 ไฟล์ให้นักบัญชี ซึ่งหลงง่ายและตกหล่นบ่อย
//  ตอนนี้กดปุ่มเดียวได้ครบทั้งงวด พร้อมแท็บ "อ่านก่อน" อธิบายว่าแต่ละแท็บคืออะไร
//
//  ประกอบข้อมูลฝั่งเซิร์ฟเวอร์ทั้งหมด — เช็คสิทธิ์ได้จริงและไม่ต้องส่งข้อมูลดิบ
//  ไปกลับผ่านเบราว์เซอร์
// ============================================================
import { NextResponse } from "next/server";
import { getCurrentShop } from "@/lib/shop";
import { docOutstanding, agingBucket, AGING_LABEL_TH } from "@/lib/finance";
import { branchCode, whtIncomeDesc, isJuristicPerson, formatTaxId, branchLabel } from "@/lib/tax-th";
import type { FinDoc } from "@/lib/types/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** แปลง "2026-07" | "2026-Q3" | "2026" -> ช่วงวันที่ [start, end) */
function parsePeriod(raw: string | null) {
  const now = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  if (raw && /^\d{4}$/.test(raw)) return { start: `${raw}-01-01`, end: `${+raw + 1}-01-01`, label: `ปี ${raw}` };
  if (raw && /^\d{4}-Q[1-4]$/.test(raw)) {
    const [y, q] = raw.split("-Q");
    const m0 = (+q - 1) * 3 + 1;
    const endM = m0 + 3;
    return {
      start: `${y}-${String(m0).padStart(2, "0")}-01`,
      end: endM > 12 ? `${+y + 1}-01-01` : `${y}-${String(endM).padStart(2, "0")}-01`,
      label: `ไตรมาส ${q}/${y}`,
    };
  }
  const m = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : now;
  const d = new Date(m + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  return { start: `${m}-01`, end: `${d.toISOString().slice(0, 7)}-01`, label: `เดือน ${m}` };
}

const n2 = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;

export async function GET(req: Request) {
  let shop, supabase;
  try { ({ shop, supabase } = await getCurrentShop()); }
  catch { return NextResponse.json({ ok: false, error: "ต้องเข้าสู่ระบบก่อน" }, { status: 401 }); }

  const p = parsePeriod(new URL(req.url).searchParams.get("period"));

  const [{ data: docsRaw }, { data: entriesRaw }, { data: openRaw }] = await Promise.all([
    supabase.from("fin_docs").select("*, fin_doc_items(*)")
      .eq("shop_id", shop.id).neq("status", "draft")
      .gte("issue_date", p.start).lt("issue_date", p.end).order("issue_date"),
    supabase.from("journal_entries")
      .select("entry_number, entry_date, memo, source_type, journal_lines(debit, credit, chart_of_accounts(code, name, type))")
      .eq("shop_id", shop.id).gte("entry_date", p.start).lt("entry_date", p.end).order("entry_date"),
    supabase.from("fin_docs").select("*")
      .eq("shop_id", shop.id).in("status", ["awaiting", "partial"]),
  ]);

  const docs = (docsRaw ?? []) as unknown as FinDoc[];
  const open = (openRaw ?? []) as unknown as FinDoc[];
  const sales = docs.filter((d) => d.doc_type !== "expense" && d.status !== "void");
  const expenses = docs.filter((d) => d.doc_type === "expense" && d.status !== "void");
  const wht = expenses.filter((d) => Number(d.wht_amount) > 0);

  const sheets: { name: string; rows: Record<string, unknown>[] }[] = [];

  // แท็บอธิบาย — นักบัญชีเปิดไฟล์มาต้องรู้ทันทีว่ามีอะไรบ้างและตัวเลขมาจากไหน
  sheets.push({
    name: "อ่านก่อน", rows: [
      { หัวข้อ: "กิจการ", รายละเอียด: shop.billing_name || shop.name },
      { หัวข้อ: "เลขประจำตัวผู้เสียภาษี", รายละเอียด: formatTaxId(shop.tax_id) || "ยังไม่ได้กรอก" },
      { หัวข้อ: "สาขา", รายละเอียด: branchLabel(shop.branch) },
      { หัวข้อ: "งวด", รายละเอียด: p.label },
      { หัวข้อ: "ช่วงวันที่", รายละเอียด: `${p.start} ถึงก่อน ${p.end}` },
      { หัวข้อ: "แท็บ ภาษีขาย", รายละเอียด: "เอกสารขายที่คิด VAT ในงวด — ใช้กรอก ภ.พ.30 ฝั่งภาษีขาย" },
      { หัวข้อ: "แท็บ ภาษีซื้อ", รายละเอียด: "ค่าใช้จ่ายที่มีภาษีซื้อในงวด — ใช้กรอก ภ.พ.30 ฝั่งภาษีซื้อ" },
      { หัวข้อ: "แท็บ หัก ณ ที่จ่าย", รายละเอียด: "ใช้ยื่น ภ.ง.ด.3 (บุคคลธรรมดา) และ ภ.ง.ด.53 (นิติบุคคล)" },
      { หัวข้อ: "แท็บ สมุดรายวัน", รายละเอียด: "รายการบัญชีคู่ทุกรายการในงวด เดบิตรวม = เครดิตรวมเสมอ" },
      { หัวข้อ: "แท็บ งบทดลอง", รายละเอียด: "ยอดคงเหลือแต่ละบัญชี ณ สิ้นงวด" },
      { หัวข้อ: "แท็บ ลูกหนี้/เจ้าหนี้ค้าง", รายละเอียด: "ยอดค้าง ณ วันที่ดึงรายงาน (ไม่ใช่ ณ สิ้นงวด)" },
      { หัวข้อ: "ข้อควรทราบ", รายละเอียด: "ตัวเลขทั้งหมดมาจากเอกสารที่ผู้ใช้บันทึกเอง ยังไม่ผ่านการตรวจสอบโดยผู้สอบบัญชี" },
    ],
  });

  if (sales.length) sheets.push({
    name: "ภาษีขาย", rows: sales.map((d, i) => ({
      "ลำดับ": i + 1, "วันที่": d.issue_date, "เลขที่เอกสาร": d.doc_number,
      "ชื่อผู้ซื้อ": d.contact_name ?? "", "เลขผู้เสียภาษี": d.contact_tax_id ?? "",
      "สาขา": branchCode(d.contact_branch),
      "มูลค่าสินค้า/บริการ": n2(Number(d.total) - Number(d.vat_amount)),
      "ภาษีขาย": n2(d.vat_amount), "ยอดรวม": n2(d.total),
    })),
  });

  if (expenses.length) sheets.push({
    name: "ภาษีซื้อ", rows: expenses.map((d, i) => ({
      "ลำดับ": i + 1, "วันที่": d.issue_date, "เลขที่เอกสาร": d.doc_number,
      "ชื่อผู้ขาย": d.contact_name ?? "", "เลขผู้เสียภาษี": d.contact_tax_id ?? "",
      "สาขา": branchCode(d.contact_branch),
      "มูลค่าสินค้า/บริการ": n2(Number(d.total) - Number(d.vat_amount)),
      "ภาษีซื้อ": n2(d.vat_amount), "ยอดรวม": n2(d.total),
    })),
  });

  if (wht.length) sheets.push({
    name: "หัก ณ ที่จ่าย", rows: wht.map((d, i) => ({
      "ลำดับ": i + 1, "แบบที่ยื่น": isJuristicPerson(d.contact_tax_id) ? "ภ.ง.ด.53" : "ภ.ง.ด.3",
      "วันที่จ่าย": d.issue_date, "เลขผู้เสียภาษี": d.contact_tax_id ?? "",
      "สาขา": branchCode(d.contact_branch), "ชื่อผู้ถูกหัก": d.contact_name ?? "",
      "ประเภทเงินได้": whtIncomeDesc(d.wht_income_type),
      "ยอดเงินที่จ่าย": n2(Number(d.total) - Number(d.vat_amount)),
      "อัตรา (%)": n2(d.wht_rate), "ภาษีที่หัก": n2(d.wht_amount),
      "เอกสารอ้างอิง": d.doc_number,
    })),
  });

  // สมุดรายวัน + งบทดลอง สร้างจากชุดข้อมูลเดียวกัน ตัวเลขจึงตรงกันเสมอ
  type Line = { debit: number; credit: number; chart_of_accounts: { code: string; name: string; type: string } | null };
  type Entry = { entry_number: string; entry_date: string; memo: string | null; source_type: string; journal_lines: Line[] };
  const entries = (entriesRaw ?? []) as unknown as Entry[];

  const jRows: Record<string, unknown>[] = [];
  const balance = new Map<string, { name: string; dr: number; cr: number }>();
  for (const e of entries) {
    for (const l of e.journal_lines ?? []) {
      const a = l.chart_of_accounts;
      jRows.push({
        "วันที่": e.entry_date, "เลขที่": e.entry_number, "ที่มา": e.source_type,
        "คำอธิบาย": e.memo ?? "", "รหัสบัญชี": a?.code ?? "", "ชื่อบัญชี": a?.name ?? "",
        "เดบิต": n2(l.debit), "เครดิต": n2(l.credit),
      });
      if (!a?.code) continue;
      const cur = balance.get(a.code) ?? { name: a.name, dr: 0, cr: 0 };
      cur.dr += Number(l.debit); cur.cr += Number(l.credit);
      balance.set(a.code, cur);
    }
  }
  if (jRows.length) sheets.push({ name: "สมุดรายวัน", rows: jRows });

  if (balance.size) sheets.push({
    name: "งบทดลอง",
    rows: [...balance.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([code, v]) => ({
      "รหัสบัญชี": code, "ชื่อบัญชี": v.name,
      "เดบิตรวม": n2(v.dr), "เครดิตรวม": n2(v.cr),
      "ยอดคงเหลือ": n2(v.dr - v.cr),
    })),
  });

  if (open.length) sheets.push({
    name: "ลูกหนี้-เจ้าหนี้ค้าง", rows: open.map((d, i) => ({
      "ลำดับ": i + 1, "ประเภท": d.doc_type === "expense" ? "เจ้าหนี้ (เราค้างจ่าย)" : "ลูกหนี้ (เขาค้างเรา)",
      "เลขที่เอกสาร": d.doc_number, "คู่ค้า": d.contact_name ?? "",
      "วันที่": d.issue_date, "ครบกำหนด": d.due_date ?? "",
      "อายุหนี้": AGING_LABEL_TH[agingBucket(d)] ?? "",
      "ยอดเอกสาร": n2(d.total), "ค้างอยู่": n2(docOutstanding(d)),
    })),
  });

  if (sheets.length <= 1) {
    return NextResponse.json({ ok: false, error: `${p.label} ยังไม่มีข้อมูลให้ส่งออก` }, { status: 400 });
  }

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "SudoChatBot";
  wb.created = new Date();

  for (const spec of sheets) {
    const ws = wb.addWorksheet(spec.name.replace(/[:\\/?*[\]]/g, "-").slice(0, 31));
    const headers = Object.keys(spec.rows[0]);
    ws.columns = headers.map((h) => ({
      header: h, key: h,
      width: Math.min(48, Math.max(12, h.length + 2, ...spec.rows.slice(0, 300).map((r) => String(r[h] ?? "").length + 2))),
    }));
    ws.addRows(spec.rows);
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FF1F2937" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
    headers.forEach((h, i) => {
      if (spec.rows.some((r) => typeof r[h] === "number")) {
        const col = ws.getColumn(i + 1);
        col.numFmt = "#,##0.00";
        col.alignment = { horizontal: "right" };
      }
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const fileName = `ชุดส่งสำนักงานบัญชี ${shop.billing_name || shop.name} ${p.label}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
