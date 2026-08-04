// ============================================================
//  รายงานบัญชี+ภาษี — ดูได้ราย เดือน / ไตรมาส / ปี
//  สรุปกำไร · ลูกหนี้/เจ้าหนี้ค้าง (Aging) · ภาษีซื้อ-ขาย (ภ.พ.30) ·
//  หัก ณ ที่จ่าย (ภ.ง.ด.3/53 + ไฟล์ยื่น) · งบทดลอง
// ============================================================
import { getCurrentShop, isPlatformAdmin } from "@/lib/shop";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Table, Th, Td, Badge, PageHeader } from "@/components/ui";
import { baht, bahtDoc, dateOnlyTH, cn } from "@/lib/utils";
import { agingBucket, AGING_LABEL_TH, docOutstanding, DOC_TYPE_TH } from "@/lib/finance";
import { rdClean, rdDateBE, rdAmount, checkRdWhtRows, rdVatLine, rdWhtLine, rdFile } from "@/lib/rd";
import type { FinDoc } from "@/lib/types/finance";
import Link from "next/link";
import { LineChart, CheckCircle2, FileText, FileSpreadsheet, BookOpenText } from "lucide-react";
import ExportButtons from "./export-buttons";
import PeriodPicker from "./period-picker";
import AccountantPackage from "./accountant-package";
import { whtIncomeLabel, whtIncomeDesc, branchCode, rdFormFor } from "@/lib/tax-th";
import { selectVatSalesDocs, selectVatPurchaseDocs, selectWhtPayableDocs, selectWhtReceivableDocs,
  vatSign, sumVat, sumBase, recognitionsAsDocs, type VatRecognitionRow } from "@/lib/vat-docs";
import IntegrityCard from "../admin/integrity-card";
import { track } from "@/lib/track";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "summary", label: "สรุปธุรกิจ" },
  { id: "aging", label: "ลูกหนี้/เจ้าหนี้ค้าง" },
  { id: "vat", label: "ภาษีซื้อ-ขาย (ภ.พ.30)" },
  { id: "wht", label: "หัก ณ ที่จ่าย (ภ.ง.ด.)" },
  { id: "trial", label: "งบทดลอง" },
] as const;

interface Period { start: string; end: string; label: string; key: string; months: string[] }

/** แปลง "2026-07" | "2026-Q3" | "2026" -> ช่วงวันที่ [start, end) + รายชื่อเดือนในงวด */
function parsePeriod(raw: string | undefined): Period {
  const nowMonth = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  const monthsBetween = (start: string, count: number) => {
    const out: string[] = [];
    const d = new Date(start + "-01T00:00:00Z");
    for (let i = 0; i < count; i++) {
      out.push(d.toISOString().slice(0, 7));
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return out;
  };
  if (raw && /^\d{4}$/.test(raw)) {
    return { start: `${raw}-01-01`, end: `${Number(raw) + 1}-01-01`, label: `ปี ${raw}`, key: raw, months: monthsBetween(`${raw}-01`, 12) };
  }
  if (raw && /^\d{4}-Q[1-4]$/.test(raw)) {
    const [y, q] = raw.split("-Q");
    const m0 = (Number(q) - 1) * 3 + 1;
    const start = `${y}-${String(m0).padStart(2, "0")}-01`;
    const endM = m0 + 3;
    const end = endM > 12 ? `${Number(y) + 1}-01-01` : `${y}-${String(endM).padStart(2, "0")}-01`;
    return { start, end, label: `ไตรมาส ${q}/${y}`, key: raw, months: monthsBetween(`${y}-${String(m0).padStart(2, "0")}`, 3) };
  }
  const m = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : nowMonth;
  const d = new Date(m + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  return { start: `${m}-01`, end: `${d.toISOString().slice(0, 7)}-01`, label: `เดือน ${m}`, key: m, months: [m] };
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ t?: string; period?: string; m?: string }> }) {
  const [{ supabase, shop }, admin] = await Promise.all([getCurrentShop(), isPlatformAdmin()]);
  // บันทึกว่ามีคนมาถึงหน้ารายงาน/ภาษี — เดิมวัดไม่ได้ว่าคนเดินมาไกลแค่ไหนหลังออกเอกสาร
  // ไม่ await เพราะหน้าไม่ควรรอ log และ track() กลืน error อยู่แล้ว
  void supabase.auth.getUser().then(({ data }) =>
    track(createServiceClient(), shop.id, data.user?.id ?? null, "report_viewed"));
  const sp = await searchParams;
  const t = TABS.some((x) => x.id === sp.t) ? sp.t! : "summary";
  const period = parsePeriod(sp.period ?? sp.m);
  // ไฟล์ยื่นสรรพากร .txt ปลดล็อกที่แพ็ก AI Executive ขึ้นไป (platform admin ใช้ได้เสมอ)
  const rdAllowed = admin || ["executive", "agency"].includes(shop.plan);

  return (
    <div className="space-y-5">
      <PageHeader
        title="รายงาน + ภาษี"
        lead={<>กำลังดู{period.label}</>}
        help="ตัวเลขทุกช่องมาจากเอกสารจริงที่คุณบันทึกไว้ ไม่ต้องรอปิดงบ — ดูกำไร-ขาดทุน ใครค้างเรานานแค่ไหน และภาษีที่ต้องยื่นเดือนนี้ · โหลดเป็น Excel ส่งนักบัญชี หรือโหลดไฟล์ยื่นสรรพากรได้เลย"
        action={<PeriodPicker tab={t} period={period.key} />}
      />

      {/* ยามเฝ้าความถูกต้องทางบัญชี — รันสดทุกครั้งที่เปิดหน้า
          เดิมการตรวจ 11 ข้อนี้ทำด้วยมือครั้งเดียวตอนออดิต ซึ่งเป็นภาพนิ่ง
          ลูกค้าบันทึกข้อมูลทุกวัน ถ้าวันไหนเพี้ยนต้องรู้ทันที ไม่ใช่รู้ตอนใกล้ยื่นภาษี */}
      <IntegrityCard shopId={shop.id} />

      <div className="flex flex-wrap gap-2">
        {TABS.map((x) => (
          <Link key={x.id} href={`/dashboard/reports?t=${x.id}&period=${period.key}`}
            className={cn(
              "inline-flex min-h-[36px] items-center rounded-full px-4 py-1.5 text-sm font-medium",
              t === x.id ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
            )}>
            {x.label}
          </Link>
        ))}
      </div>

      <AccountantPackage period={period.key} />

      {t === "summary" && <SummaryTab shopId={shop.id} supabase={supabase} period={period} />}
      {t === "aging" && <AgingTab shopId={shop.id} supabase={supabase} />}
      {t === "vat" && <VatTab shopId={shop.id} supabase={supabase} period={period} shopName={shop.billing_name || shop.name} shopTaxId={shop.tax_id ?? ""} rdAllowed={rdAllowed} />}
      {t === "wht" && <WhtTab shopId={shop.id} supabase={supabase} period={period} shopName={shop.billing_name || shop.name} shopTaxId={shop.tax_id ?? ""} rdAllowed={rdAllowed} />}
      {t === "trial" && <TrialTab shopId={shop.id} supabase={supabase} period={period} />}
    </div>
  );
}

type SB = Awaited<ReturnType<typeof getCurrentShop>>["supabase"];

// ---------- สรุปธุรกิจ ----------
async function SummaryTab({ shopId, supabase, period }: { shopId: string; supabase: SB; period: Period }) {
  // งวดเดือนเดียว: โชว์ตารางย้อนหลัง 6 เดือนให้เห็นเทรนด์ · ไตรมาส/ปี: โชว์เดือนในงวด
  const tableMonths = period.months.length === 1
    ? (() => {
        const d = new Date(period.start + "T00:00:00Z");
        d.setUTCMonth(d.getUTCMonth() - 5);
        const out: string[] = [];
        for (let i = 0; i < 6; i++) { out.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); }
        return out;
      })()
    : period.months;
  const queryStart = `${tableMonths[0]}-01`;

  const [{ data: lines }, { data: openDocs }] = await Promise.all([
    supabase.from("journal_lines")
      .select("debit, credit, chart_of_accounts(code,type), journal_entries!inner(entry_date)")
      .eq("shop_id", shopId)
      .gte("journal_entries.entry_date", queryStart).lt("journal_entries.entry_date", period.end),
    supabase.from("fin_docs").select("doc_type,total,wht_amount,paid_amount")
      .eq("shop_id", shopId).in("status", ["awaiting", "partial"]),
  ]);

  const byMonth = new Map<string, { income: number; expense: number }>();
  let periodIncome = 0, periodExpense = 0;
  for (const l of (lines ?? []) as unknown as { debit: number; credit: number; chart_of_accounts: { type: string } | null; journal_entries: { entry_date: string } }[]) {
    const mm = l.journal_entries.entry_date.slice(0, 7);
    const cur = byMonth.get(mm) ?? { income: 0, expense: 0 };
    const type = l.chart_of_accounts?.type;
    const inPeriod = l.journal_entries.entry_date >= period.start && l.journal_entries.entry_date < period.end;
    if (type === "income") { cur.income += Number(l.credit) - Number(l.debit); if (inPeriod) periodIncome += Number(l.credit) - Number(l.debit); }
    if (type === "expense") { cur.expense += Number(l.debit) - Number(l.credit); if (inPeriod) periodExpense += Number(l.debit) - Number(l.credit); }
    byMonth.set(mm, cur);
  }

  const ar = (openDocs ?? []).filter((d) => d.doc_type === "invoice").reduce((a, d) => a + docOutstanding(d), 0);
  const ap = (openDocs ?? []).filter((d) => d.doc_type === "expense").reduce((a, d) => a + docOutstanding(d), 0);
  const rows = tableMonths.filter((mm) => byMonth.has(mm));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* การ์ดพวกนี้หน้าตาเหมือน StatCard บนแดชบอร์ดที่กดได้ ผู้ใช้จึงคาดหวังว่ากดได้ด้วย — ใส่ปลายทางให้ทุกใบ */}
        {[
          { label: `รายได้ ${period.label}`, value: baht(periodIncome), tone: "text-emerald-700", href: "/dashboard/sales" },
          { label: `ค่าใช้จ่าย ${period.label}`, value: baht(periodExpense), tone: "text-red-600", href: "/dashboard/expenses" },
          { label: `กำไร (ก่อนภาษี) ${period.label}`, value: baht(periodIncome - periodExpense), tone: periodIncome - periodExpense >= 0 ? "text-emerald-700" : "text-red-600", href: "/dashboard/journal" },
          { label: "ค้างรับ / ค้างจ่าย ตอนนี้", value: `${baht(ar)} / ${baht(ap)}`, tone: "text-neutral-800", href: `/dashboard/reports?t=aging&period=${period.key}` },
        ].map((s) => (
          <Link key={s.label} href={s.href}
            className="block rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] transition-all duration-150 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md">
            <p className="text-xs font-medium text-neutral-500">{s.label}</p>
            <p className={cn("mt-2 text-xl font-bold tabular-nums tracking-tight", s.tone)}>{s.value}</p>
          </Link>
        ))}
      </div>

      <Card>
        {/* ตารางนี้กว้างกว่างวดที่เลือก (ย้อนหลัง 6 เดือนให้เห็นเทรนด์)
            จึงต้องเขียนช่วงจริงไว้ ไม่งั้นคนอ่านว่าเป็นตัวเลขของงวดที่เลือก */}
        <CardHeader>
          <CardTitle>รายได้ vs ค่าใช้จ่าย รายเดือน (จากสมุดรายวันจริง)</CardTitle>
          {rows.length > 1 && (
            <p className="mt-1 text-xs font-normal text-neutral-400">
              แสดง {rows.length} เดือน ({rows[0]} ถึง {rows[rows.length - 1]}) — กว้างกว่างวดที่เลือกเพื่อให้เห็นแนวโน้ม
            </p>
          )}
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {rows.length === 0 ? (
            <EmptyState icon={LineChart} title="งวดนี้ยังไม่มีรายการบัญชี"
              hint="ออกเอกสารขายหรือบันทึกค่าใช้จ่าย ระบบจะลงบัญชีและสรุปตัวเลขให้เอง"
              action={{ href: "/dashboard/sales/new?type=invoice", label: "ออกเอกสารใบแรก" }} />
          ) : (
            <Table>
              <thead><tr><Th>เดือน</Th><Th className="text-right">รายได้</Th><Th className="text-right">ค่าใช้จ่าย</Th><Th className="text-right">กำไร</Th></tr></thead>
              <tbody>
                {rows.map((mm) => {
                  const v = byMonth.get(mm)!;
                  const profit = v.income - v.expense;
                  return (
                    <tr key={mm}>
                      <Td className="font-medium">{mm}</Td>
                      <Td className="text-right text-emerald-700">{bahtDoc(v.income)}</Td>
                      <Td className="text-right text-red-600">{bahtDoc(v.expense)}</Td>
                      <Td className={cn("text-right font-semibold", profit >= 0 ? "text-emerald-700" : "text-red-600")}>{bahtDoc(profit)}</Td>
                    </tr>
                  );
                })}
                {rows.length > 1 && (() => {
                  const sum = rows.reduce((a, mm) => {
                    const v = byMonth.get(mm)!;
                    return { income: a.income + v.income, expense: a.expense + v.expense };
                  }, { income: 0, expense: 0 });
                  return (
                    <tr className="font-bold">
                      {/* เดิมเขียนว่า "รวม{period.label}" ซึ่งผิด เพราะรวมทุกเดือนในตาราง
                          ไม่ใช่เฉพาะงวดที่เลือก — คนอ่านแล้วเข้าใจว่ากำไรของเดือนนั้นเยอะกว่าจริง */}
                      <Td>{rows.length > 1 ? `รวม ${rows[0]} ถึง ${rows[rows.length - 1]}` : `รวม${period.label}`}</Td>
                      <Td className="text-right text-emerald-700">{bahtDoc(sum.income)}</Td>
                      <Td className="text-right text-red-600">{bahtDoc(sum.expense)}</Td>
                      <Td className={cn("text-right", sum.income - sum.expense >= 0 ? "text-emerald-700" : "text-red-600")}>{bahtDoc(sum.income - sum.expense)}</Td>
                    </tr>
                  );
                })()}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Aging (สถานะปัจจุบัน ไม่ขึ้นกับงวด) ----------
async function AgingTab({ shopId, supabase }: { shopId: string; supabase: SB }) {
  const { data } = await supabase.from("fin_docs")
    .select("id,doc_type,doc_number,contact_name,issue_date,due_date,total,wht_amount,paid_amount")
    .eq("shop_id", shopId).in("status", ["awaiting", "partial"]).in("doc_type", ["invoice", "expense"])
    .order("due_date", { ascending: true, nullsFirst: false });
  const docs = (data ?? []) as unknown as FinDoc[];

  const render = (kind: "invoice" | "expense") => {
    const list = docs.filter((d) => d.doc_type === kind);
    const buckets: Record<string, number> = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90up: 0 };
    for (const d of list) buckets[agingBucket(d)] += docOutstanding(d);
    const exportRows = list.map((d) => ({
      "เลขที่": d.doc_number, "คู่ค้า": d.contact_name ?? "", "วันที่": d.issue_date,
      "ครบกำหนด": d.due_date ?? "", "ยอดค้าง": docOutstanding(d), "อายุหนี้": AGING_LABEL_TH[agingBucket(d)],
    }));
    return (
      <Card key={kind}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{kind === "invoice" ? "ลูกหนี้ค้างรับ — แยกตามอายุหนี้" : "เจ้าหนี้ค้างจ่าย — แยกตามอายุหนี้"}</CardTitle>
          <ExportButtons xlsxName={`aging-${kind}.xlsx`} rows={exportRows} />
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="grid grid-cols-2 gap-2 px-5 sm:grid-cols-3 lg:grid-cols-5 pb-3">
            {Object.entries(buckets).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-neutral-50 px-2 py-2 text-center">
                <p className="text-[10px] text-neutral-400">{AGING_LABEL_TH[k]}</p>
                <p className={cn("text-sm font-bold", k === "current" ? "text-neutral-700" : k === "d90up" ? "text-red-600" : "text-amber-600")}>{baht(v)}</p>
              </div>
            ))}
          </div>
          {list.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="ไม่มียอดค้าง"
              hint={kind === "invoice" ? "ลูกค้าจ่ายครบทุกใบแล้ว" : "จ่ายบิลครบทุกใบแล้ว"} />
          ) : (
            <Table>
              <thead><tr><Th>เลขที่</Th><Th>คู่ค้า</Th><Th>ครบกำหนด</Th><Th className="text-right">ค้าง</Th><Th>อายุหนี้</Th></tr></thead>
              <tbody>
                {list.map((d) => {
                  const b = agingBucket(d);
                  return (
                    <tr key={d.id}>
                      <Td><Link href={kind === "invoice" ? `/dashboard/sales/${d.id}` : `/dashboard/expenses/${d.id}`} className="font-medium text-emerald-700 hover:underline">{d.doc_number}</Link></Td>
                      <Td>{d.contact_name ?? "-"}</Td>
                      <Td className="text-neutral-400">{dateOnlyTH(d.due_date ?? d.issue_date)}</Td>
                      <Td className="text-right font-medium">{bahtDoc(docOutstanding(d))}</Td>
                      <Td><Badge tone={b === "current" ? "neutral" : b === "d90up" ? "red" : "amber"}>{AGING_LABEL_TH[b]}</Badge></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  };

  return <div className="space-y-4">{render("invoice")}{render("expense")}</div>;
}

// ---------- VAT (ภ.พ.30) ----------
async function VatTab({ shopId, supabase, period, shopName, shopTaxId, rdAllowed }: {
  shopId: string; supabase: SB; period: Period; shopName: string; shopTaxId: string; rdAllowed: boolean;
}) {
  const [{ data }, { data: recs }] = await Promise.all([
    supabase.from("fin_docs")
      .select("id,doc_type,status,doc_number,contact_name,contact_tax_id,contact_branch,issue_date,total,vat_amount,vat_mode,ref_doc_id,tax_point")
      .eq("shop_id", shopId)
      .gte("issue_date", period.start).lt("issue_date", period.end)
      .order("issue_date"),
    // ภาษีขายของงานบริการ (ม.78/1) เข้า ภ.พ.30 ตามเดือนที่รับเงินจริง ไม่ใช่เดือนที่ออกใบแจ้งหนี้
    supabase.from("vat_recognitions")
      .select("recognized_on,base_amount,vat_amount,fin_docs(doc_number,contact_name,contact_tax_id,contact_branch)")
      .eq("shop_id", shopId)
      .gte("recognized_on", period.start).lt("recognized_on", period.end)
      .order("recognized_on"),
  ]);
  const docs = (data ?? []) as unknown as FinDoc[];

  // กฎเลือกเอกสารอยู่ที่ src/lib/vat-docs.ts ที่เดียว — ชุดส่งสำนักงานบัญชีใช้ตัวเดียวกัน
  // ตัวเลขบนจอกับในไฟล์จึงตรงกันเสมอ และกันนับซ้ำเมื่อใบแจ้งหนี้ถูกแปลงเป็นใบเสร็จข้ามเดือน
  const salesTax = [
    ...selectVatSalesDocs(docs),
    ...(recognitionsAsDocs((recs ?? []) as unknown as VatRecognitionRow[]) as unknown as FinDoc[]),
  ].sort((a, b) => a.issue_date.localeCompare(b.issue_date));
  const buyTax = selectVatPurchaseDocs(docs);

  // ใบลดหนี้หักภาษีขายออก ใบเพิ่มหนี้บวกเข้า — เครื่องหมายมาจาก vatSign() ที่เดียว
  const sumSales = sumVat(salesTax);
  const sumBuy = sumVat(buyTax);
  const baseSales = sumBase(salesTax);
  const baseBuy = sumBase(buyTax);
  const net = Math.round((sumSales - sumBuy) * 100) / 100;

  const mkRows = (list: FinDoc[]) => list.map((d, i) => ({
    "ลำดับ": i + 1, "วันที่": d.issue_date, "ประเภท": DOC_TYPE_TH[d.doc_type],
    "เลขที่ใบกำกับ": d.doc_number,
    "ชื่อผู้ซื้อ/ผู้ขาย": d.contact_name ?? "", "เลขผู้เสียภาษี": d.contact_tax_id ?? "",
    "มูลค่าสินค้า/บริการ": vatSign(d) * (Number(d.total) - Number(d.vat_amount)),
    "ภาษีมูลค่าเพิ่ม": vatSign(d) * Number(d.vat_amount),
  }));
  // ไฟล์โอนย้ายรายงานภาษีซื้อ-ขาย: ลำดับ|วันที่(พ.ศ.)|เลขที่ใบกำกับ|ชื่อคู่ค้า|เลขผู้เสียภาษี|สาขา|มูลค่า|VAT
  // ลำดับคอลัมน์/ตัวคั่น/CRLF ย้ายไปอยู่ใน src/lib/rd.ts แล้ว เพื่อให้ตัวตรวจอัตโนมัติแตะได้
  // (เดิมอยู่ในไฟล์นี้ ไม่มีเทสต์ไหนเห็น สลับคอลัมน์แล้วไม่มีใครรู้จนเอาไฟล์เข้า RD Prep)
  const txtOf = (list: FinDoc[]) => rdFile(list.map((d, i) => rdVatLine({
    seq: i + 1, issueDate: d.issue_date, docNumber: d.doc_number,
    contactName: d.contact_name, contactTaxId: d.contact_tax_id, contactBranch: d.contact_branch,
    // ใบลดหนี้ต้องเป็นยอดติดลบในไฟล์ที่ยื่น ไม่งั้นภาษีขายที่ยื่นจะเกินจริง
    base: vatSign(d) * (Number(d.total) - Number(d.vat_amount)),
    vat: vatSign(d) * Number(d.vat_amount),
  })));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>สรุป ภ.พ.30 {period.label} — {shopName} {shopTaxId && `(${shopTaxId})`}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs text-neutral-400">ยอดขาย (ฐาน VAT)</p><p className="text-lg font-bold">{bahtDoc(baseSales)}</p><p className="text-xs text-neutral-400">ภาษีขาย {bahtDoc(sumSales)}</p></div>
            <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs text-neutral-400">ยอดซื้อ (ฐาน VAT)</p><p className="text-lg font-bold">{bahtDoc(baseBuy)}</p><p className="text-xs text-neutral-400">ภาษีซื้อ {bahtDoc(sumBuy)}</p></div>
            <div className={cn("rounded-xl p-3", net >= 0 ? "bg-amber-50" : "bg-emerald-50")}>
              <p className="text-xs text-neutral-500">{net >= 0 ? "ภาษีต้องชำระ" : "ภาษีชำระเกิน (ขอคืน/ยกไป)"}</p>
              <p className={cn("text-lg font-bold", net >= 0 ? "text-amber-700" : "text-emerald-700")}>{bahtDoc(Math.abs(net))}</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">
            ภ.พ.30 ยื่นเป็นรายเดือน — ดูรายไตรมาส/ปีไว้ตรวจภาพรวม ตอนยื่นจริงเลือกงวด &quot;รายเดือน&quot; แล้วใช้ตัวเลขกรอกแบบบน e-filing ได้เลย
          </p>
        </CardContent>
      </Card>

      {[{ title: "รายงานภาษีขาย", list: salesTax, base: `vat-sales-${period.key}` }, { title: "รายงานภาษีซื้อ", list: buyTax, base: `vat-buy-${period.key}` }].map((sec) => (
        <Card key={sec.title}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{sec.title} ({sec.list.length} ใบ)</CardTitle>
            <ExportButtons xlsxName={`${sec.base}.xlsx`} rows={mkRows(sec.list)}
              txtName={`${sec.base}.txt`} txtContent={rdAllowed ? txtOf(sec.list) : undefined} txtLocked={!rdAllowed} />
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {sec.list.length === 0 ? (
              <EmptyState icon={FileText} title={`ไม่มีรายการ${period.label}`}
                hint="เอกสารใบไหนที่คิด VAT จะมาโผล่ในรายงานนี้เอง ไม่ต้องคีย์ซ้ำ"
                action={sec.title === "รายงานภาษีขาย"
                  ? { href: "/dashboard/sales/new?type=invoice", label: "+ ออกใบแจ้งหนี้มี VAT" }
                  : { href: "/dashboard/expenses/new", label: "+ บันทึกบิลซื้อมี VAT" }} />
            ) : (
              <Table>
                <thead><tr><Th>วันที่</Th><Th>เลขที่</Th><Th>คู่ค้า</Th><Th>เลขผู้เสียภาษี</Th><Th className="text-right">มูลค่า</Th><Th className="text-right">VAT</Th></tr></thead>
                <tbody>
                  {sec.list.map((d) => (
                    <tr key={d.id}>
                      <Td className="text-neutral-400">{dateOnlyTH(d.issue_date)}</Td>
                      <Td className="font-medium">{d.doc_number}</Td>
                      <Td>{d.contact_name ?? "-"}</Td>
                      <Td className="text-neutral-400">{d.contact_tax_id ?? "-"}</Td>
                      <Td className="text-right">{bahtDoc(Number(d.total) - Number(d.vat_amount))}</Td>
                      <Td className="text-right">{bahtDoc(d.vat_amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- WHT (ภ.ง.ด.3/53) ----------
async function WhtTab({ shopId, supabase, period, shopName, shopTaxId, rdAllowed }: {
  shopId: string; supabase: SB; period: Period; shopName: string; shopTaxId: string; rdAllowed: boolean;
}) {
  const { data } = await supabase.from("fin_docs")
    .select("id,doc_type,status,doc_number,contact_name,contact_tax_id,contact_address,contact_branch,recipient_kind,issue_date,total,vat_amount,vat_mode,ref_doc_id,wht_rate,wht_amount,wht_income_type")
    .eq("shop_id", shopId).gt("wht_amount", 0)
    .gte("issue_date", period.start).lt("issue_date", period.end)
    .order("issue_date");
  const docs = (data ?? []) as unknown as FinDoc[];

  const paid = selectWhtPayableDocs(docs);       // เราหักเขาไว้ ต้องนำส่ง
  const received = selectWhtReceivableDocs(docs); // ลูกค้าหักเราไว้ ต้องตามเก็บ 50 ทวิ
  const sumPaid = paid.reduce((a, d) => a + Number(d.wht_amount), 0);

  // แบบยื่นยึด "ประเภทผู้รับเงิน" ที่ผู้ใช้ยืนยันเป็นหลัก ถ้ายังไม่ระบุค่อยเดาจากเลขผู้เสียภาษี
  // เดิมเดาจากเลขขึ้นต้น 0 อย่างเดียว ทำให้คณะบุคคล/ห้างหุ้นส่วนสามัญไม่จดทะเบียน
  // ซึ่งได้เลขขึ้นต้น 0 เหมือนกัน ถูกจัดเข้า ภ.ง.ด.53 ทั้งที่ต้องยื่น ภ.ง.ด.3
  // กำหนดยื่นคิดจากเดือนสุดท้ายของงวด (งวดไตรมาส/ปีก็ยึดเดือนสุดท้ายที่มีการจ่าย)
  // ดึงจาก RPC เพราะจำนวนวันที่ขยายให้ตอนยื่นออนไลน์เป็น "ประกาศที่มีวันหมดอายุ"
  // ไม่ใช่กฎหมายถาวร — ถ้าพ้นช่วงที่ยืนยันไว้ RPC จะคืน online = null แทนที่จะเดา
  const { data: dueRaw } = await supabase.rpc("wht_due_dates", { p_period: period.months[period.months.length - 1] });
  const due = dueRaw as {
    paper: string; paper_statutory: string; shifted: boolean;
    online: string | null; extension_until: string | null; holidays_loaded: boolean;
  } | null;
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  // ยึด "วันตามกฎหมายก่อนเลื่อน" เป็นตัวนับถอยหลังเสมอ
  // การเลื่อนพ้นวันหยุดทำให้มีเวลามากขึ้น ถ้านับจากวันที่เลื่อนแล้วระบบจะบอกว่ายังมีเวลา
  // ทั้งที่ถ้าตารางวันหยุดไม่ครบอาจไม่ได้เลื่อนจริง — นับจากวันที่เร็วกว่าไว้ก่อนปลอดภัยกว่า
  const refDue = due?.paper_statutory ?? null;
  const dueLeft = refDue
    ? Math.floor((new Date(refDue + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / 86400000)
    : null;

  const formOf = (d: FinDoc) => rdFormFor(d.contact_tax_id, d.wht_income_type, d.recipient_kind);
  const pnd53 = paid.filter((d) => formOf(d) === "ภ.ง.ด.53");
  const pnd3 = paid.filter((d) => formOf(d) !== "ภ.ง.ด.53");

  const mkRows = (list: FinDoc[]) => list.map((d, i) => ({
    "ลำดับ": i + 1, "เลขผู้เสียภาษี": d.contact_tax_id ?? "", "ชื่อผู้ถูกหัก": d.contact_name ?? "",
    "ที่อยู่": d.contact_address ?? "", "วันที่จ่าย": d.issue_date,
    "ประเภทเงินได้": whtIncomeLabel(d.wht_income_type) || "40(8) ธุรกิจ พาณิชย์ บริการอื่น ๆ",
    "สาขาผู้ถูกหัก": branchCode(d.contact_branch), "อัตรา (%)": Number(d.wht_rate),
    "ยอดเงินที่จ่าย": Number(d.total) - Number(d.vat_amount), "ภาษีที่หัก": Number(d.wht_amount),
    "เอกสารอ้างอิง": d.doc_number,
  }));
  // ไฟล์โอนย้าย ภ.ง.ด.: ลำดับ|เลขผู้เสียภาษี|สาขา|ชื่อผู้ถูกหัก|ที่อยู่|วันที่จ่าย(พ.ศ.)|ประเภทเงินได้|อัตรา|ยอดจ่าย|ภาษีหัก|เงื่อนไข(1=หัก ณ ที่จ่าย)
  // สาขาและประเภทเงินได้ต้องเป็นค่าจริงของแต่ละราย — เดิมฮาร์ดโค้ดทั้งคู่
  // ทำให้ไฟล์ที่ยื่นเข้าระบบสรรพากรมีข้อมูลผิดทุกบรรทัด นักบัญชีต้องมานั่งแก้เอง
  const txtOf = (list: FinDoc[]) => rdFile(list.map((d, i) => rdWhtLine({
    seq: i + 1, contactTaxId: d.contact_tax_id, contactBranch: d.contact_branch,
    contactName: d.contact_name, contactAddress: d.contact_address,
    issueDate: d.issue_date, whtIncomeType: d.wht_income_type, whtRate: d.wht_rate,
    base: Number(d.total) - Number(d.vat_amount), whtAmount: d.wht_amount,
  })));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>สรุปหัก ณ ที่จ่าย {period.label} — {shopName} {shopTaxId && `(${shopTaxId})`}</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs text-neutral-400">ภาษีที่เราหักไว้ (ต้องนำส่ง)</p><p className="text-lg font-bold text-amber-700">{bahtDoc(sumPaid)}</p></div>
          <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs text-neutral-400">ภ.ง.ด.3 (บุคคลธรรมดา)</p><p className="text-lg font-bold">{pnd3.length} ราย · {bahtDoc(pnd3.reduce((a, d) => a + Number(d.wht_amount), 0))}</p></div>
          <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs text-neutral-400">ภ.ง.ด.53 (นิติบุคคล)</p><p className="text-lg font-bold">{pnd53.length} ราย · {bahtDoc(pnd53.reduce((a, d) => a + Number(d.wht_amount), 0))}</p></div>
        </CardContent>
      </Card>

      {/* กำหนดยื่นของงวด — คนพลาดเพราะจำสลับระหว่างวันยื่นกระดาษกับออนไลน์บ่อยมาก
          แสดงคู่กันไปเลย ไม่ต้องให้ไปเปิดปฏิทินสรรพากรเอง */}
      {due && sumPaid > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[12px] leading-relaxed text-neutral-600">
          <p>
            <b className="text-neutral-800">กำหนดนำส่งของงวดนี้</b> — ยื่นกระดาษภายใน{" "}
            <b className="text-neutral-800">{dateOnlyTH(due.paper_statutory)}</b> (ประมวลรัษฎากร มาตรา 52)
            {due.online
              ? <> · ยื่นออนไลน์ภายใน <b className="text-neutral-800">{dateOnlyTH(due.online)}</b></>
              : <> · <span className="text-amber-700">มาตรการขยายเวลายื่นออนไลน์ที่ระบบรู้จักไม่ครอบคลุมงวดนี้ ให้ยึดวันกระดาษไว้ก่อน แล้วตรวจประกาศฉบับล่าสุด</span></>}
            {dueLeft !== null && (
              <span className={dueLeft < 0 ? " font-bold text-red-600" : dueLeft <= 5 ? " font-bold text-amber-700" : " text-neutral-500"}>
                {" · "}{dueLeft < 0 ? `เลยกำหนดมาแล้ว ${Math.abs(dueLeft)} วัน` : `เหลืออีก ${dueLeft} วัน`}
              </span>
            )}
          </p>
          {due.shifted && (
            <p className="mt-1 text-[11px] text-neutral-500">
              วันที่ {dateOnlyTH(due.paper_statutory)} ตรงวันหยุด — ตามกฎหมายเลื่อนเป็นวันทำการถัดไปคือ{" "}
              <b className="text-neutral-700">{dateOnlyTH(due.paper)}</b> แต่ระบบนับถอยหลังจากวันเดิมไว้ก่อนเพื่อความปลอดภัย
            </p>
          )}
          {/* บอกข้อจำกัดตรง ๆ ดีกว่าให้เขาเชื่อวันที่ผิด */}
          <p className="mt-1 text-[11px] text-neutral-400">
            เลื่อนพ้นเสาร์-อาทิตย์ให้อัตโนมัติ ·{" "}
            {due.holidays_loaded
              ? "วันหยุดราชการปีนี้กรอกไว้ในระบบแล้ว"
              : "ยังไม่ได้กรอกวันหยุดราชการของปีนี้ ระบบจึงเลื่อนให้เฉพาะเสาร์-อาทิตย์ — ถ้ากำหนดตรงวันหยุดนักขัตฤกษ์ให้ตรวจปฏิทินสรรพากรเอง"}
            {due.extension_until && ` · มาตรการขยายเวลายื่นออนไลน์มีผลถึง ${due.extension_until}`}
          </p>
        </div>
      )}

      {[
        { title: "ภ.ง.ด.3 — หักจากบุคคลธรรมดา", list: pnd3, base: `pnd3-${period.key}` },
        { title: "ภ.ง.ด.53 — หักจากนิติบุคคล", list: pnd53, base: `pnd53-${period.key}` },
      ].map((sec) => {
        // ตรวจก่อนโหลด ไม่ใช่ให้ไปเจอตอนเปิด RD Prep ตอนดึกของวันที่ 6
        const issues = checkRdWhtRows(sec.list);
        return (
        <Card key={sec.title}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{sec.title} ({sec.list.length})</CardTitle>
            <ExportButtons xlsxName={`${sec.base}.xlsx`} rows={mkRows(sec.list)}
              txtName={`${sec.base}.txt`} txtContent={rdAllowed ? txtOf(sec.list) : undefined} txtLocked={!rdAllowed} />
          </CardHeader>
          {issues.length > 0 && (
            <div className="mx-4 mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
              <p className="text-[12px] font-bold text-amber-800">
                {issues.length} จาก {sec.list.length} รายการยังกรอกไม่ครบ — โหลดไฟล์ไปตอนนี้ RD Prep อาจไม่รับ
              </p>
              <ul className="mt-1.5 space-y-1">
                {issues.slice(0, 8).map((it) => (
                  <li key={it.docNumber} className="text-[11px] leading-relaxed text-amber-800">
                    <b>{it.docNumber}</b> {it.contactName} — {it.problems.join(" · ")}
                  </li>
                ))}
              </ul>
              {issues.length > 8 && (
                <p className="mt-1 text-[11px] text-amber-700">และอีก {issues.length - 8} รายการ</p>
              )}
              <p className="mt-1.5 text-[11px] text-amber-700">
                แก้ได้ที่หน้า <Link href="/dashboard/contacts" className="font-semibold underline">ผู้ติดต่อ</Link> (ชื่อ ที่อยู่ เลขผู้เสียภาษี)
                หรือเปิดเอกสารนั้นเพื่อแก้ประเภทเงินได้
              </p>
            </div>
          )}
          <CardContent className="px-0 pb-0">
            {sec.list.length === 0 ? (
              <EmptyState icon={FileSpreadsheet} title={`ไม่มีรายการ${period.label}`}
                hint="ค่าใช้จ่ายใบไหนที่เลือกอัตราหัก ณ ที่จ่าย จะมาที่นี่ พร้อมพิมพ์หนังสือรับรอง 50 ทวิ ให้เลย"
                action={{ href: "/dashboard/expenses/new", label: "บันทึกค่าใช้จ่ายมีหัก ณ ที่จ่าย" }} />
            ) : (
              <Table>
                <thead><tr><Th>วันที่</Th><Th>ผู้ถูกหัก</Th><Th>เลขผู้เสียภาษี</Th><Th className="text-right">ฐานเงิน</Th><Th className="text-right">อัตรา</Th><Th className="text-right">ภาษีหัก</Th><Th>50 ทวิ</Th></tr></thead>
                <tbody>
                  {sec.list.map((d) => (
                    <tr key={d.id}>
                      <Td className="text-neutral-400">{dateOnlyTH(d.issue_date)}</Td>
                      <Td>{d.contact_name ?? "-"}</Td>
                      <Td className="text-neutral-400">{d.contact_tax_id ?? "-"}</Td>
                      <Td className="text-right">{bahtDoc(Number(d.total) - Number(d.vat_amount))}</Td>
                      <Td className="text-right">{Number(d.wht_rate)}%</Td>
                      <Td className="text-right font-medium">{bahtDoc(d.wht_amount)}</Td>
                      <Td><a href={`/dashboard/print/${d.id}?form=wht`} target="_blank" className="text-xs text-emerald-700 hover:underline">พิมพ์</a></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
        );
      })}

      {received.length > 0 && (
        <Card>
          <CardHeader><CardTitle>เราถูกหัก ณ ที่จ่าย (เครดิตภาษีของเรา) — {bahtDoc(received.reduce((a, d) => a + Number(d.wht_amount), 0))}</CardTitle></CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <thead><tr><Th>วันที่</Th><Th>ลูกค้า</Th><Th>เอกสาร</Th><Th className="text-right">ภาษีถูกหัก</Th></tr></thead>
              <tbody>
                {received.map((d) => (
                  <tr key={d.id}>
                    <Td className="text-neutral-400">{dateOnlyTH(d.issue_date)}</Td>
                    <Td>{d.contact_name ?? "-"}</Td>
                    <Td className="font-medium">{d.doc_number}</Td>
                    <Td className="text-right">{bahtDoc(d.wht_amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}
      {/* ⚠️ คำเตือนนี้อยู่ติดปุ่มโหลดโดยเจตนา ไม่ใช่ในหน้าช่วยเหลือ
          จุดที่พลาดคือตอนกำลังกดในโปรแกรม RD Prep ซึ่งคนจะไม่ย้อนกลับมาอ่านคู่มือ
          ถ้าติ๊ก "บรรทัดแรกชื่อคอลัมน์" ทั้งที่ไฟล์เราไม่มีหัวคอลัมน์
          เอกสารใบแรกจะหายจากแบบยื่นแบบเงียบ ๆ = ยื่นภาษีขาดไปหนึ่งรายการ
          อันตรายกว่าไฟล์ถูกตีกลับ เพราะไฟล์ถูกตีกลับผู้ใช้รู้ทันที */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
        <p className="text-xs font-semibold text-amber-900">ตอนนำเข้าโปรแกรม RD Prep: ห้ามติ๊ก &quot;บรรทัดแรกชื่อคอลัมน์&quot;</p>
        <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
          ไฟล์นี้เริ่มด้วยข้อมูลแถวแรกเลย ไม่มีบรรทัดหัวคอลัมน์ — ถ้าติ๊กช่องนั้น
          โปรแกรมจะกินเอกสารใบแรกไปเป็นหัวตาราง แบบยื่นจะขาดไปหนึ่งรายการโดยไม่มีคำเตือน ·
          ตั้งตัวคั่นเป็น <b>|</b> · รูปแบบวันที่ <b>dd/mm/yyyy</b> และเลือก <b>พ.ศ.</b>
        </p>
      </div>
      <p className="text-[11px] text-neutral-400">
        ภ.ง.ด.3/53 ยื่นรายเดือน — ไฟล์ .txt คั่นด้วย | เข้ารหัส TIS-620 วันที่ พ.ศ. (มาตรฐานโปรแกรมโอนย้ายข้อมูลสรรพากร) ·
        ก่อนยื่นรอบแรกให้ทดลองนำเข้าโปรแกรม RD Prep 1 ครั้งเพื่อยืนยันลำดับคอลัมน์ตรงเวอร์ชันล่าสุด · หนังสือรับรอง 50 ทวิ พิมพ์ได้จากตาราง
      </p>
    </div>
  );
}

// ---------- งบทดลอง ----------
async function TrialTab({ shopId, supabase, period }: { shopId: string; supabase: SB; period: Period }) {
  const { data: lines } = await supabase.from("journal_lines")
    .select("debit, credit, chart_of_accounts(code,name,type), journal_entries!inner(entry_date)")
    .eq("shop_id", shopId).lt("journal_entries.entry_date", period.end);

  const byAcc = new Map<string, { code: string; name: string; type: string; dr: number; cr: number }>();
  for (const l of (lines ?? []) as unknown as { debit: number; credit: number; chart_of_accounts: { code: string; name: string; type: string } | null }[]) {
    if (!l.chart_of_accounts) continue;
    const key = l.chart_of_accounts.code;
    const cur = byAcc.get(key) ?? { ...l.chart_of_accounts, dr: 0, cr: 0 };
    cur.dr += Number(l.debit); cur.cr += Number(l.credit);
    byAcc.set(key, cur);
  }
  const accounts = [...byAcc.values()].filter((a) => Math.abs(a.dr - a.cr) > 0.004 || a.dr > 0).sort((a, b) => a.code.localeCompare(b.code));
  const totalDr = accounts.reduce((a, x) => a + Math.max(0, x.dr - x.cr), 0);
  const totalCr = accounts.reduce((a, x) => a + Math.max(0, x.cr - x.dr), 0);

  const exportRows = accounts.map((a) => ({
    "รหัส": a.code, "ชื่อบัญชี": a.name,
    "เดบิต": Math.max(0, Math.round((a.dr - a.cr) * 100) / 100),
    "เครดิต": Math.max(0, Math.round((a.cr - a.dr) * 100) / 100),
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>งบทดลอง (ยอดสะสมถึงสิ้น{period.label})</CardTitle>
        <ExportButtons xlsxName={`trial-balance-${period.key}.xlsx`} rows={exportRows} />
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {accounts.length === 0 ? (
          <EmptyState icon={BookOpenText} title="ยังไม่มีรายการบัญชี"
            hint="ทุกครั้งที่ออกเอกสารหรือบันทึกเงิน ระบบลงบัญชีให้เอง แล้วงบทดลองจะขึ้นที่นี่"
            action={{ href: "/dashboard/sales/new?type=invoice", label: "ออกเอกสารใบแรก" }} />
        ) : (
          <Table>
            <thead><tr><Th>รหัส</Th><Th>บัญชี</Th><Th className="text-right">เดบิต</Th><Th className="text-right">เครดิต</Th></tr></thead>
            <tbody>
              {accounts.map((a) => {
                const bal = a.dr - a.cr;
                return (
                  <tr key={a.code}>
                    <Td className="text-neutral-400">{a.code}</Td>
                    <Td>{a.name}</Td>
                    <Td className="text-right">{bal > 0.004 ? bahtDoc(bal) : ""}</Td>
                    <Td className="text-right">{bal < -0.004 ? bahtDoc(-bal) : ""}</Td>
                  </tr>
                );
              })}
              <tr className="font-bold">
                <Td colSpan={2}>รวม</Td>
                <Td className="text-right">{bahtDoc(totalDr)}</Td>
                <Td className="text-right">{bahtDoc(totalCr)}</Td>
              </tr>
            </tbody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
