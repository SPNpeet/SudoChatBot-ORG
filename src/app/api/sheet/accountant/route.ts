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
import { docOutstanding, agingBucket, AGING_LABEL_TH, DOC_TYPE_TH } from "@/lib/finance";
import { branchCode, whtIncomeDesc, rdFormFor, formatTaxId, branchLabel } from "@/lib/tax-th";
import { selectVatSalesDocs, selectVatPurchaseDocs, selectWhtPayableDocs,
  vatSign, recognitionsAsDocs, type VatRecognitionRow } from "@/lib/vat-docs";
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

/** รูปแบบเงินบนหน้าปก — มีคำว่าบาทต่อท้ายให้อ่านรู้เรื่องโดยไม่ต้องมีหัวคอลัมน์ */
const MONEY_FMT = '#,##0.00 "บาท"';

/** ชื่อชีตห้ามมีอักขระต้องห้ามของ Excel และยาวไม่เกิน 31 ตัว */
const safeSheetName = (raw: string) => raw.replace(/[:\\/?*\[\]]/g, "-").slice(0, 31);

/** บรรทัดบนหน้าปก — แยกชนิดเพื่อจัดรูปแบบต่างกัน ไม่ใช่ตาราง key-value แบนๆ */
type CoverRow =
  | { kind: "title" | "sub" | "section" | "note" | "warn"; a: string }
  | { kind: "kv"; a: string; b: string }
  | { kind: "money" | "total"; a: string; n: number }
  | { kind: "blank" };

// จานสีเดียวกับหน้าเว็บ (emerald/neutral) ให้ไฟล์กับระบบเป็นชุดเดียวกัน
const C = {
  ink: "FF111827", sub: "FF6B7280", line: "FFE5E7EB",
  brand: "FF047857", brandBg: "FFECFDF5", headBg: "FFF3F4F6",
  warnBg: "FFFEF3C7", warnInk: "FF92400E", zebra: "FFFAFAFA",
} as const;

export async function GET(req: Request) {
  let shop, supabase;
  try { ({ shop, supabase } = await getCurrentShop()); }
  catch { return NextResponse.json({ ok: false, error: "ต้องเข้าสู่ระบบก่อน" }, { status: 401 }); }

  const p = parsePeriod(new URL(req.url).searchParams.get("period"));

  // เพดานจำนวนแถว — กันร้านที่ยุ่งมากดึงทั้งปีแล้วฟังก์ชันหมดเวลา/หน่วยความจำไม่พอ
  // ถ้าชนเพดานต้องบอกผู้ใช้ตรง ๆ ในไฟล์ ห้ามตัดข้อมูลเงียบ ๆ แล้วให้เขาเอาไปยื่นภาษี
  const MAX_DOCS = 5000;
  const MAX_ENTRIES = 5000;
  const MAX_LINES = 20000;

  const [{ data: docsRaw }, { data: entriesRaw }, { data: openRaw }, { data: tbRaw }, { data: recsRaw }] = await Promise.all([
    supabase.from("fin_docs").select("*, fin_doc_items(*)")
      .eq("shop_id", shop.id).neq("status", "draft")
      .gte("issue_date", p.start).lt("issue_date", p.end).order("issue_date").limit(MAX_DOCS),
    supabase.from("journal_entries")
      .select("entry_number, entry_date, memo, source_type, journal_lines(debit, credit, chart_of_accounts(code, name, type))")
      .eq("shop_id", shop.id).gte("entry_date", p.start).lt("entry_date", p.end).order("entry_date").limit(MAX_ENTRIES),
    supabase.from("fin_docs").select("*")
      .eq("shop_id", shop.id).in("status", ["awaiting", "partial"]).limit(MAX_DOCS),
    // งบทดลองต้องเป็น "ยอดสะสมถึงสิ้นงวด" ไม่ใช่ยอดเคลื่อนไหวเฉพาะในงวด
    // จึงต้องดึงทุกบรรทัดตั้งแต่เปิดกิจการจนถึงก่อนวันสิ้นงวด (ไม่มีขอบล่าง)
    // ใช้กติกาเดียวกับแท็บงบทดลองบนหน้าจอ ตัวเลขสองที่จึงตรงกันเสมอ
    supabase.from("journal_lines")
      .select("debit, credit, chart_of_accounts(code,name), journal_entries!inner(entry_date)")
      .eq("shop_id", shop.id).lt("journal_entries.entry_date", p.end).limit(MAX_LINES),
    // ภาษีขายงานบริการ (ม.78/1) เข้า ภ.พ.30 ตามเดือนที่รับเงิน ไม่ใช่เดือนที่ออกใบแจ้งหนี้
    supabase.from("vat_recognitions")
      .select("recognized_on,base_amount,vat_amount,fin_docs(doc_number,contact_name,contact_tax_id,contact_branch)")
      .eq("shop_id", shop.id).gte("recognized_on", p.start).lt("recognized_on", p.end)
      .order("recognized_on").limit(MAX_DOCS),
  ]);

  const truncated: string[] = [];
  if ((docsRaw ?? []).length >= MAX_DOCS) truncated.push(`เอกสารเกิน ${MAX_DOCS.toLocaleString()} ใบ`);
  if ((entriesRaw ?? []).length >= MAX_ENTRIES) truncated.push(`รายการบัญชีเกิน ${MAX_ENTRIES.toLocaleString()} รายการ`);
  if ((tbRaw ?? []).length >= MAX_LINES) truncated.push(`บรรทัดบัญชีสะสมเกิน ${MAX_LINES.toLocaleString()} บรรทัด (งบทดลองไม่ครบ)`);

  const docs = (docsRaw ?? []) as unknown as FinDoc[];
  const open = (openRaw ?? []) as unknown as FinDoc[];

  // ใช้กฎกลางตัวเดียวกับหน้ารายงานบนจอ (src/lib/vat-docs.ts)
  // เดิมที่นี่เขียนกฎเองว่า "ทุกอย่างที่ไม่ใช่ค่าใช้จ่าย" ซึ่งกวาดใบเสนอราคาเข้ามาด้วย
  // และนับทั้งใบแจ้งหนี้และใบเสร็จที่แปลงมาจากใบนั้น = ภาษีขายเกินจริงหนึ่งเท่า
  const sales = [
    ...selectVatSalesDocs(docs),
    ...(recognitionsAsDocs((recsRaw ?? []) as unknown as VatRecognitionRow[]) as unknown as FinDoc[]),
  ].sort((a, b) => a.issue_date.localeCompare(b.issue_date));
  const expenses = selectVatPurchaseDocs(docs);
  const wht = selectWhtPayableDocs(docs);

  // note = ข้อความอธิบายเมื่อไม่มีข้อมูล · sum = คอลัมน์ที่ต้องมีแถวรวมท้ายตาราง
  // ⚠️ ชีตที่ไม่มีข้อมูลต้องมีอยู่ พร้อมบอกว่า "ไม่มีในงวดนี้"
  // เดิมตัดทิ้งเงียบ ๆ นักบัญชีเปิดไฟล์แล้วแยกไม่ออกว่า "ไม่มีจริง" หรือ "ระบบลืมใส่"
  // ซึ่งเป็นคนละเรื่องกันโดยสิ้นเชิงตอนยื่นภาษี (เจ้าของเจอเอง: หน้าจอโฆษณา 6 อย่าง ได้ไฟล์ 3 ชีต)
  const sheets: { name: string; rows: Record<string, unknown>[]; note?: string; sum?: string[] }[] = [];

  sheets.push({
    name: "ภาษีขาย", note: "ไม่มีเอกสารขายที่คิด VAT ในงวดนี้",
    sum: ["มูลค่าสินค้า/บริการ", "ภาษีขาย", "ยอดรวม"],
    rows: sales.map((d, i) => ({
      "ลำดับ": i + 1, "วันที่": d.issue_date, "เลขที่เอกสาร": d.doc_number,
      "ชื่อผู้ซื้อ": d.contact_name ?? "", "เลขผู้เสียภาษี": d.contact_tax_id ?? "",
      "สาขา": branchCode(d.contact_branch),
      "ประเภท": DOC_TYPE_TH[d.doc_type],
      "มูลค่าสินค้า/บริการ": n2(vatSign(d) * (Number(d.total) - Number(d.vat_amount))),
      "ภาษีขาย": n2(vatSign(d) * Number(d.vat_amount)), "ยอดรวม": n2(vatSign(d) * Number(d.total)),
    })),
  });

  sheets.push({
    name: "ภาษีซื้อ", note: "ไม่มีค่าใช้จ่ายที่มีภาษีซื้อในงวดนี้",
    sum: ["มูลค่าสินค้า/บริการ", "ภาษีซื้อ", "ยอดรวม"],
    rows: expenses.map((d, i) => ({
      "ลำดับ": i + 1, "วันที่": d.issue_date, "เลขที่เอกสาร": d.doc_number,
      "ชื่อผู้ขาย": d.contact_name ?? "", "เลขผู้เสียภาษี": d.contact_tax_id ?? "",
      "สาขา": branchCode(d.contact_branch),
      "มูลค่าสินค้า/บริการ": n2(Number(d.total) - Number(d.vat_amount)),
      "ภาษีซื้อ": n2(d.vat_amount), "ยอดรวม": n2(d.total),
    })),
  });

  sheets.push({
    name: "หัก ณ ที่จ่าย", note: "ไม่มีการหักภาษี ณ ที่จ่ายในงวดนี้",
    sum: ["ยอดเงินที่จ่าย", "ภาษีที่หัก"],
    rows: wht.map((d, i) => ({
      "ลำดับ": i + 1, "แบบที่ยื่น": rdFormFor(d.contact_tax_id, d.wht_income_type, d.recipient_kind),
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
  for (const e of entries) {
    for (const l of e.journal_lines ?? []) {
      const a = l.chart_of_accounts;
      jRows.push({
        "วันที่": e.entry_date, "เลขที่": e.entry_number, "ที่มา": e.source_type,
        "คำอธิบาย": e.memo ?? "", "รหัสบัญชี": a?.code ?? "", "ชื่อบัญชี": a?.name ?? "",
        "เดบิต": n2(l.debit), "เครดิต": n2(l.credit),
      });
    }
  }
  sheets.push({ name: "สมุดรายวัน", rows: jRows, note: "ไม่มีรายการบัญชีในงวดนี้", sum: ["เดบิต", "เครดิต"] });

  // งบทดลอง = ยอดสะสมถึงสิ้นงวด แสดงเป็นด้านเดียวต่อบัญชี (เดบิตหรือเครดิต)
  // เดิมแท็บนี้รวมเฉพาะรายการในงวดแต่พาดหัวว่า "ยอดคงเหลือ" ซึ่งคนละความหมายกัน
  // นักบัญชีที่เอาไปทำงบต่อจะได้ตัวเลขผิดทั้งงบโดยไม่รู้ตัว
  type TbLine = { debit: number; credit: number; chart_of_accounts: { code: string; name: string } | null };
  const balance = new Map<string, { name: string; dr: number; cr: number }>();
  for (const l of (tbRaw ?? []) as unknown as TbLine[]) {
    const a = l.chart_of_accounts;
    if (!a?.code) continue;
    const cur = balance.get(a.code) ?? { name: a.name, dr: 0, cr: 0 };
    cur.dr += Number(l.debit); cur.cr += Number(l.credit);
    balance.set(a.code, cur);
  }

  const tbRows = [...balance.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, v]) => ({
      "รหัสบัญชี": code, "ชื่อบัญชี": v.name,
      "เดบิต": n2(Math.max(0, v.dr - v.cr)),
      "เครดิต": n2(Math.max(0, v.cr - v.dr)),
    }))
    .filter((r) => r["เดบิต"] !== 0 || r["เครดิต"] !== 0);

  {
    const drTotal = n2(tbRows.reduce((a, r) => a + r["เดบิต"], 0));
    const crTotal = n2(tbRows.reduce((a, r) => a + r["เครดิต"], 0));
    sheets.push({
      name: "งบทดลอง", note: "ยังไม่มียอดบัญชีสะสมถึงสิ้นงวดนี้",
      rows: tbRows.length ? [...tbRows, { "รหัสบัญชี": "", "ชื่อบัญชี": "รวม", "เดบิต": drTotal, "เครดิต": crTotal }] : [],
    });
    // เดบิตรวมต้องเท่าเครดิตรวมเสมอตามหลักบัญชีคู่ ถ้าไม่เท่าแปลว่าข้อมูลมีปัญหา
    // ต้องบอกในไฟล์ ห้ามปล่อยให้นักบัญชีไปเจอเองตอนทำงบ
    if (Math.abs(drTotal - crTotal) > 0.004) {
      truncated.push(`งบทดลองไม่สมดุล (เดบิต ${drTotal.toLocaleString()} · เครดิต ${crTotal.toLocaleString()})`);
    }
  }

  sheets.push({
    name: "ลูกหนี้-เจ้าหนี้ค้าง", note: "ไม่มียอดค้างรับ-ค้างจ่าย ณ ตอนนี้",
    sum: ["ยอดเอกสาร", "ค้างอยู่"],
    rows: open.map((d, i) => ({
      "ลำดับ": i + 1, "ประเภท": d.doc_type === "expense" ? "เจ้าหนี้ (เราค้างจ่าย)" : "ลูกหนี้ (เขาค้างเรา)",
      "เลขที่เอกสาร": d.doc_number, "คู่ค้า": d.contact_name ?? "",
      "วันที่": d.issue_date, "ครบกำหนด": d.due_date ?? "",
      "อายุหนี้": AGING_LABEL_TH[agingBucket(d)] ?? "",
      "ยอดเอกสาร": n2(d.total), "ค้างอยู่": n2(docOutstanding(d)),
    })),
  });

  if (!sheets.some((x) => x.rows.length)) {
    return NextResponse.json({ ok: false, error: `${p.label} ยังไม่มีข้อมูลให้ส่งออก` }, { status: 400 });
  }

  // แท็บอธิบาย — นักบัญชีเปิดไฟล์มาต้องรู้ทันทีว่ามีอะไรบ้างและตัวเลขมาจากไหน
  // ต้องสร้าง "หลัง" ทุกแท็บ เพราะคำเตือนข้อมูลไม่ครบ/งบไม่สมดุล เพิ่งรู้ผลตอนคำนวณเสร็จ
  // (เดิมสร้างก่อน คำเตือนที่เกิดทีหลังจึงหายไปเงียบ ๆ)
  // ---- สรุปยอดสำหรับหน้าปก ----
  // ตัวเลขชุดเดียวกับที่ใช้สร้างแต่ละชีต จึงตรงกันเสมอ ไม่ได้คำนวณใหม่คนละทาง
  const sumOf = (rows: Record<string, unknown>[], key: string) =>
    n2(rows.reduce((a, r) => a + (Number(r[key]) || 0), 0));
  const salesRows = sheets.find((x) => x.name === "ภาษีขาย")?.rows ?? [];
  const purchRows = sheets.find((x) => x.name === "ภาษีซื้อ")?.rows ?? [];
  const whtRows = sheets.find((x) => x.name === "หัก ณ ที่จ่าย")?.rows ?? [];
  const vatOut = sumOf(salesRows, "ภาษีขาย");
  const vatIn = sumOf(purchRows, "ภาษีซื้อ");
  const vatNet = n2(vatOut - vatIn);
  const whtTotal = sumOf(whtRows, "ภาษีที่หัก");

  const cover: CoverRow[] = [
    { kind: "title", a: "ชุดส่งสำนักงานบัญชี" },
    { kind: "sub", a: `${shop.billing_name || shop.name} · ${p.label}` },
    { kind: "blank" },

    { kind: "section", a: "ข้อมูลกิจการ" },
    { kind: "kv", a: "ชื่อกิจการ", b: shop.billing_name || shop.name },
    { kind: "kv", a: "เลขประจำตัวผู้เสียภาษี", b: formatTaxId(shop.tax_id) || "ยังไม่ได้กรอก" },
    { kind: "kv", a: "สาขา", b: branchLabel(shop.branch) },
    { kind: "kv", a: "งวดที่ส่ง", b: `${p.label} (${p.start} ถึงก่อน ${p.end})` },
    { kind: "kv", a: "วันที่ออกไฟล์", b: new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10) },
    { kind: "blank" },

    { kind: "section", a: "สรุปภาษีของงวด" },
    { kind: "money", a: "ภาษีขาย (VAT ขาย)", n: vatOut },
    { kind: "money", a: "ภาษีซื้อ (VAT ซื้อ)", n: vatIn },
    { kind: "total", a: vatNet >= 0 ? "ภาษีที่ต้องชำระ (ภ.พ.30)" : "ภาษีซื้อเกิน — ขอคืน/ยกไปงวดหน้า", n: Math.abs(vatNet) },
    { kind: "money", a: "ภาษีหัก ณ ที่จ่ายที่ต้องนำส่ง", n: whtTotal },
    { kind: "note", a: "ตัวเลขนี้เป็นผลรวมจากเอกสารที่บันทึกไว้ ใช้ทานกับแบบก่อนยื่น ไม่ใช่แบบยื่นภาษี" },
    { kind: "blank" },

    { kind: "section", a: "มีอะไรในไฟล์นี้" },
    ...sheets.filter((x) => x.name !== "อ่านก่อน").map((x): CoverRow => ({
      kind: "kv",
      a: x.name,
      b: x.rows.length ? `${x.rows.length.toLocaleString()} รายการ` : "ไม่มีข้อมูลในงวดนี้",
    })),
    { kind: "blank" },

    { kind: "section", a: "ที่มาของตัวเลขแต่ละชีต" },
    { kind: "kv", a: "ภาษีขาย", b: "ใบแจ้งหนี้ + ใบเสร็จขายสดที่คิด VAT ในงวด · ใบเสร็จที่ออกต่อจากใบแจ้งหนี้ไม่นับซ้ำ · ไม่รวมใบเสนอราคาและเอกสารร่าง" },
    { kind: "kv", a: "ภาษีซื้อ", b: "ค่าใช้จ่ายที่มีภาษีซื้อในงวด" },
    { kind: "kv", a: "หัก ณ ที่จ่าย", b: "ภาษีที่กิจการหักไว้และต้องนำส่ง · แบบที่ยื่นยึดประเภทผู้รับเงินที่ผู้ใช้ระบุ (คณะบุคคล/ห้างหุ้นส่วนสามัญไม่จดทะเบียน ยื่น ภ.ง.ด.3 แม้เลขผู้เสียภาษีขึ้นต้นด้วย 0)" },
    { kind: "kv", a: "สมุดรายวัน", b: "รายการบัญชีคู่ทุกรายการในงวด เดบิตรวม = เครดิตรวมเสมอ" },
    { kind: "kv", a: "งบทดลอง", b: `ยอดคงเหลือสะสมของทุกบัญชีตั้งแต่เปิดกิจการถึงก่อน ${p.end} (ไม่ใช่ยอดเคลื่อนไหวเฉพาะในงวด)` },
    { kind: "kv", a: "ลูกหนี้-เจ้าหนี้ค้าง", b: "ยอดค้าง ณ วันที่ดึงรายงาน (ไม่ใช่ ณ สิ้นงวด)" },
    { kind: "kv", a: "อัตรา VAT", b: "อัตราที่ใช้กับแต่ละใบยึดตามวันที่ออกเอกสาร ไม่ใช่อัตราวันที่ดึงรายงาน" },
    { kind: "blank" },

    { kind: "warn", a: "ตัวเลขทั้งหมดมาจากเอกสารที่ผู้ใช้บันทึกเอง ยังไม่ผ่านการตรวจสอบโดยผู้สอบบัญชี" },
    ...(truncated.length
      ? [{ kind: "warn" as const, a: `ตรวจก่อนใช้: ${truncated.join(" · ")} — ห้ามใช้ยื่นภาษีจนกว่าจะตรวจสอบ ถ้าเป็นเพราะข้อมูลเกินเพดาน ให้แบ่งดึงเป็นรายเดือนแทน` }]
      : []),
  ];

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "SudoChatBot";
  wb.created = new Date();

  // ============================================================
  //  หน้าปก — ไฟล์ที่ส่งให้คนอื่นต้องบอกตัวเองได้ว่าคืออะไรตั้งแต่บรรทัดแรก
  //  เดิมเป็นตาราง 2 คอลัมน์ (หัวข้อ/รายละเอียด) ซึ่งอ่านเหมือน log ไม่ใช่เอกสาร
  //  เจ้าของสรุปว่า "มันแค่นำเข้า" ซึ่งตรง — ไฟล์เดิมคือ dump ข้อมูล ไม่ใช่ของที่ส่งให้คนอื่น
  // ============================================================
  {
    const ws = wb.addWorksheet("อ่านก่อน");
    ws.columns = [{ width: 34 }, { width: 76 }];
    ws.views = [{ showGridLines: false }];

    for (const row of cover) {
      const r = ws.addRow([]);
      const A = r.getCell(1), B = r.getCell(2);
      switch (row.kind) {
        case "blank": r.height = 6; break;
        case "title":
          A.value = row.a;
          A.font = { bold: true, size: 20, color: { argb: C.brand } };
          ws.mergeCells(r.number, 1, r.number, 2);
          r.height = 30;
          break;
        case "sub":
          A.value = row.a;
          A.font = { size: 12, color: { argb: C.sub } };
          ws.mergeCells(r.number, 1, r.number, 2);
          r.height = 20;
          break;
        case "section":
          A.value = row.a;
          A.font = { bold: true, size: 12, color: { argb: C.ink } };
          ws.mergeCells(r.number, 1, r.number, 2);
          A.border = { bottom: { style: "medium", color: { argb: C.brand } } };
          B.border = { bottom: { style: "medium", color: { argb: C.brand } } };
          r.height = 22;
          break;
        case "kv":
          A.value = row.a; B.value = row.b;
          A.font = { bold: true, color: { argb: C.sub }, size: 10 };
          A.alignment = { vertical: "top" };
          B.alignment = { wrapText: true, vertical: "top" };
          break;
        case "money":
          A.value = row.a; B.value = row.n;
          B.numFmt = MONEY_FMT;
          B.alignment = { horizontal: "left" };
          break;
        case "total":
          A.value = row.a; B.value = row.n;
          A.font = { bold: true, color: { argb: C.brand } };
          B.font = { bold: true, size: 13, color: { argb: C.brand } };
          B.numFmt = MONEY_FMT;
          B.alignment = { horizontal: "left" };
          A.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.brandBg } };
          B.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.brandBg } };
          r.height = 22;
          break;
        case "note":
          A.value = row.a;
          A.font = { italic: true, size: 9, color: { argb: C.sub } };
          ws.mergeCells(r.number, 1, r.number, 2);
          break;
        case "warn":
          A.value = row.a;
          A.font = { bold: true, size: 10, color: { argb: C.warnInk } };
          A.alignment = { wrapText: true, vertical: "top" };
          ws.mergeCells(r.number, 1, r.number, 2);
          A.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.warnBg } };
          r.height = 28;
          break;
      }
    }
    ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }

  // ============================================================
  //  ชีตข้อมูล — ตารางที่นักบัญชีพิมพ์ออกมาแนบแฟ้มได้จริง
  //  หัวตารางสีแบรนด์ · เส้นตารางบาง · แถบสลับสี · แถวรวมตัวหนา
  //  ตั้งค่าพิมพ์: แนวนอน พอดีความกว้าง หัวตารางซ้ำทุกหน้า เลขหน้าท้ายกระดาษ
  // ============================================================
  for (const spec of sheets) {
    const ws = wb.addWorksheet(safeSheetName(spec.name));

    if (!spec.rows.length) {
      ws.columns = [{ width: 64 }];
      const t = ws.addRow([spec.name]);
      t.getCell(1).font = { bold: true, size: 14, color: { argb: C.ink } };
      ws.addRow([]);
      const m = ws.addRow([spec.note ?? "ไม่มีข้อมูลในงวดนี้"]);
      m.getCell(1).font = { color: { argb: C.sub } };
      ws.addRow([]);
      const w = ws.addRow(["ชีตนี้ใส่ไว้โดยตั้งใจ ให้เห็นว่าไม่มีรายการจริง ไม่ใช่ระบบส่งไฟล์ไม่ครบ"]);
      w.getCell(1).font = { italic: true, size: 9, color: { argb: C.sub } };
      ws.views = [{ showGridLines: false }];
      continue;
    }

    const headers = Object.keys(spec.rows[0]);
    ws.columns = headers.map((h) => ({
      header: h, key: h,
      width: Math.min(46, Math.max(11, h.length + 3, ...spec.rows.slice(0, 300).map((r) => String(r[h] ?? "").length + 3))),
    }));
    ws.addRows(spec.rows);

    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.brand } };
    head.alignment = { vertical: "middle", wrapText: true };
    head.height = 26;

    // แถวรวม — นักบัญชีต้องเห็นยอดรวมทันที ไม่ต้องลากเมาส์คลุมเอง
    let totalRowNo = 0;
    if (spec.sum?.length) {
      const totals: Record<string, unknown> = {};
      totals[headers[0]] = "รวม";
      for (const k of spec.sum) totals[k] = n2(spec.rows.reduce((a, r) => a + (Number(r[k]) || 0), 0));
      const tr = ws.addRow(totals);
      totalRowNo = tr.number;
      tr.font = { bold: true, color: { argb: C.ink } };
      tr.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.headBg } };
        c.border = { top: { style: "double", color: { argb: C.brand } } };
      });
    }

    const lastRow = ws.rowCount;
    for (let i = 2; i <= lastRow; i++) {
      const r = ws.getRow(i);
      const isTotal = i === totalRowNo;
      for (let c = 1; c <= headers.length; c++) {
        const cell = r.getCell(c);
        cell.border = {
          top: cell.border?.top,
          left: { style: "hair", color: { argb: C.line } },
          bottom: { style: "hair", color: { argb: C.line } },
          right: { style: "hair", color: { argb: C.line } },
        };
        // แถบสลับสี อ่านง่ายแม้พิมพ์ขาวดำ — ข้ามแถวรวมที่มีสีของตัวเอง
        if (!isTotal && i % 2 === 1) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.zebra } };
        }
      }
    }

    headers.forEach((h, i) => {
      const col = ws.getColumn(i + 1);
      if (spec.rows.some((r) => typeof r[h] === "number")) {
        col.numFmt = "#,##0.00";
        col.alignment = { horizontal: "right" };
      } else if (h === "วันที่" || h === "วันที่จ่าย" || h === "ครบกำหนด") {
        col.alignment = { horizontal: "center" };
      }
    });

    ws.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

    // ตั้งค่าพิมพ์ — รายงานพวกนี้ถูกพิมพ์แนบแฟ้มจริง ไม่ได้ดูบนจออย่างเดียว
    ws.pageSetup = {
      paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      printTitlesRow: "1:1",
    };
    ws.headerFooter = {
      oddHeader: "&L&\"-,Bold\"" + spec.name + "&R" + (shop.billing_name || shop.name) + " \u00B7 " + p.label,
      oddFooter: "&Lออกจากระบบ SudoChatBot&Rหน้า &P/&N",
    };
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
