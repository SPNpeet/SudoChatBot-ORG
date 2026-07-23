// ============================================================
//  รายงานบัญชี+ภาษี — สรุปกำไร · ลูกหนี้/เจ้าหนี้ค้าง (Aging) ·
//  ภาษีซื้อ-ขาย (เตรียม ภ.พ.30) · หัก ณ ที่จ่าย (ภ.ง.ด.3/53 + ไฟล์ยื่น) · งบทดลอง
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Table, Th, Td, Badge } from "@/components/ui";
import { baht, bahtDoc, dateOnlyTH, cn } from "@/lib/utils";
import { agingBucket, AGING_LABEL_TH, docOutstanding } from "@/lib/finance";
import type { FinDoc } from "@/lib/types/finance";
import Link from "next/link";
import ExportButtons from "./export-buttons";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "summary", label: "สรุปธุรกิจ" },
  { id: "aging", label: "ลูกหนี้/เจ้าหนี้ค้าง" },
  { id: "vat", label: "ภาษีซื้อ-ขาย (ภ.พ.30)" },
  { id: "wht", label: "หัก ณ ที่จ่าย (ภ.ง.ด.)" },
  { id: "trial", label: "งบทดลอง" },
] as const;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ t?: string; m?: string }> }) {
  const { supabase, shop } = await getCurrentShop();
  const sp = await searchParams;
  const t = TABS.some((x) => x.id === sp.t) ? sp.t! : "summary";
  const month = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  const monthStart = `${month}-01`;
  const nextMonth = new Date(new Date(monthStart).getTime() + 40 * 864e5).toISOString().slice(0, 7) + "-01";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">รายงาน + ภาษี</h1>
          <p className="text-sm text-neutral-400">ข้อมูลจากสมุดรายวันจริง — พร้อมส่งให้นักบัญชี/ยื่นสรรพากร</p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="t" value={t} />
          <input type="month" name="m" defaultValue={month}
            className="h-9 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-emerald-500" />
          <button className="h-9 rounded-xl bg-neutral-900 px-3 text-sm text-white">ดูเดือนนี้</button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((x) => (
          <Link key={x.id} href={`/dashboard/reports?t=${x.id}&m=${month}`}
            className={cn(
              "inline-flex min-h-[36px] items-center rounded-full px-4 py-1.5 text-sm font-medium",
              t === x.id ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
            )}>
            {x.label}
          </Link>
        ))}
      </div>

      {t === "summary" && <SummaryTab shopId={shop.id} supabase={supabase} month={month} monthStart={monthStart} nextMonth={nextMonth} />}
      {t === "aging" && <AgingTab shopId={shop.id} supabase={supabase} />}
      {t === "vat" && <VatTab shopId={shop.id} supabase={supabase} month={month} monthStart={monthStart} nextMonth={nextMonth} shopName={shop.billing_name || shop.name} shopTaxId={shop.tax_id ?? ""} />}
      {t === "wht" && <WhtTab shopId={shop.id} supabase={supabase} month={month} monthStart={monthStart} nextMonth={nextMonth} shopName={shop.billing_name || shop.name} shopTaxId={shop.tax_id ?? ""} />}
      {t === "trial" && <TrialTab shopId={shop.id} supabase={supabase} month={month} nextMonth={nextMonth} />}
    </div>
  );
}

type SB = Awaited<ReturnType<typeof getCurrentShop>>["supabase"];

// ---------- สรุปธุรกิจ ----------
async function SummaryTab({ shopId, supabase, month, monthStart, nextMonth }: { shopId: string; supabase: SB; month: string; monthStart: string; nextMonth: string }) {
  const sixMonthsAgo = new Date(new Date(monthStart).getTime() - 200 * 864e5).toISOString().slice(0, 7) + "-01";
  const [{ data: lines }, { data: openDocs }] = await Promise.all([
    supabase.from("journal_lines")
      .select("debit, credit, chart_of_accounts(code,type), journal_entries!inner(entry_date)")
      .eq("shop_id", shopId)
      .gte("journal_entries.entry_date", sixMonthsAgo).lt("journal_entries.entry_date", nextMonth),
    supabase.from("fin_docs").select("doc_type,total,wht_amount,paid_amount")
      .eq("shop_id", shopId).in("status", ["awaiting", "partial"]),
  ]);

  // รวมต่อเดือน: รายได้ (income credit-debit) / ค่าใช้จ่าย (expense debit-credit)
  const byMonth = new Map<string, { income: number; expense: number }>();
  for (const l of (lines ?? []) as unknown as { debit: number; credit: number; chart_of_accounts: { type: string } | null; journal_entries: { entry_date: string } }[]) {
    const mm = l.journal_entries.entry_date.slice(0, 7);
    const cur = byMonth.get(mm) ?? { income: 0, expense: 0 };
    const type = l.chart_of_accounts?.type;
    if (type === "income") cur.income += Number(l.credit) - Number(l.debit);
    if (type === "expense") cur.expense += Number(l.debit) - Number(l.credit);
    byMonth.set(mm, cur);
  }
  const months = [...byMonth.keys()].sort();
  const thisMonth = byMonth.get(month) ?? { income: 0, expense: 0 };

  const ar = (openDocs ?? []).filter((d) => d.doc_type === "invoice").reduce((a, d) => a + docOutstanding(d), 0);
  const ap = (openDocs ?? []).filter((d) => d.doc_type === "expense").reduce((a, d) => a + docOutstanding(d), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: `รายได้ ${month}`, value: baht(thisMonth.income), tone: "text-emerald-700" },
          { label: `ค่าใช้จ่าย ${month}`, value: baht(thisMonth.expense), tone: "text-red-600" },
          { label: `กำไร (ก่อนภาษี) ${month}`, value: baht(thisMonth.income - thisMonth.expense), tone: thisMonth.income - thisMonth.expense >= 0 ? "text-emerald-700" : "text-red-600" },
          { label: "ค้างรับ − ค้างจ่าย", value: `${baht(ar)} / ${baht(ap)}`, tone: "text-neutral-800" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5">
              <p className="text-xs text-neutral-400">{s.label}</p>
              <p className={cn("mt-1 text-xl font-bold tracking-tight", s.tone)}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>รายได้ vs ค่าใช้จ่าย รายเดือน (จากสมุดรายวันจริง)</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          {months.length === 0 ? (
            <EmptyState title="ยังไม่มีข้อมูล" hint="เมื่อออกเอกสาร/บันทึกค่าใช้จ่าย ระบบสรุปให้อัตโนมัติ" />
          ) : (
            <Table>
              <thead><tr><Th>เดือน</Th><Th className="text-right">รายได้</Th><Th className="text-right">ค่าใช้จ่าย</Th><Th className="text-right">กำไร</Th></tr></thead>
              <tbody>
                {months.map((mm) => {
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
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Aging ----------
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
          <CardTitle>{kind === "invoice" ? "ลูกหนี้ค้างรับ (AR Aging)" : "เจ้าหนี้ค้างจ่าย (AP Aging)"}</CardTitle>
          <ExportButtons xlsxName={`aging-${kind}.xlsx`} rows={exportRows} />
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="grid grid-cols-5 gap-2 px-5 pb-3">
            {Object.entries(buckets).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-neutral-50 px-2 py-2 text-center">
                <p className="text-[10px] text-neutral-400">{AGING_LABEL_TH[k]}</p>
                <p className={cn("text-sm font-bold", k === "current" ? "text-neutral-700" : k === "d90up" ? "text-red-600" : "text-amber-600")}>{baht(v)}</p>
              </div>
            ))}
          </div>
          {list.length === 0 ? (
            <EmptyState title="ไม่มียอดค้าง 🎉" />
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
async function VatTab({ shopId, supabase, month, monthStart, nextMonth, shopName, shopTaxId }: {
  shopId: string; supabase: SB; month: string; monthStart: string; nextMonth: string; shopName: string; shopTaxId: string;
}) {
  const { data } = await supabase.from("fin_docs")
    .select("id,doc_type,doc_number,contact_name,contact_tax_id,issue_date,total,vat_amount,vat_mode,ref_doc_id")
    .eq("shop_id", shopId).neq("status", "void").neq("vat_mode", "none").gt("vat_amount", 0)
    .gte("issue_date", monthStart).lt("issue_date", nextMonth)
    .order("issue_date");
  const docs = (data ?? []) as unknown as FinDoc[];

  // ภาษีขาย: ใบเสร็จ/ใบแจ้งหนี้ (เลี่ยงนับซ้ำ: ใบเสร็จที่ ref ใบแจ้งหนี้ ไม่นับซ้ำเพราะใบเสร็จตัวนั้นไม่ post GL — แต่ในรายงานถือ "ใบกำกับภาษี" = receipt เสมอ + invoice ที่ยังไม่มี receipt)
  const receipts = docs.filter((d) => d.doc_type === "receipt");
  const refIds = new Set(receipts.map((r) => r.ref_doc_id).filter(Boolean));
  const salesTax = [...receipts, ...docs.filter((d) => d.doc_type === "invoice" && !refIds.has(d.id))];
  const buyTax = docs.filter((d) => d.doc_type === "expense");

  const sumSales = salesTax.reduce((a, d) => a + Number(d.vat_amount), 0);
  const sumBuy = buyTax.reduce((a, d) => a + Number(d.vat_amount), 0);
  const baseSales = salesTax.reduce((a, d) => a + Number(d.total) - Number(d.vat_amount), 0);
  const baseBuy = buyTax.reduce((a, d) => a + Number(d.total) - Number(d.vat_amount), 0);
  const net = sumSales - sumBuy;

  const mkRows = (list: FinDoc[]) => list.map((d, i) => ({
    "ลำดับ": i + 1, "วันที่": d.issue_date, "เลขที่ใบกำกับ": d.doc_number,
    "ชื่อผู้ซื้อ/ผู้ขาย": d.contact_name ?? "", "เลขผู้เสียภาษี": d.contact_tax_id ?? "",
    "มูลค่าสินค้า/บริการ": Number(d.total) - Number(d.vat_amount), "ภาษีมูลค่าเพิ่ม": Number(d.vat_amount),
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>สรุปยื่น ภ.พ.30 เดือน {month} — {shopName} {shopTaxId && `(${shopTaxId})`}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs text-neutral-400">ยอดขาย (ฐาน VAT)</p><p className="text-lg font-bold">{bahtDoc(baseSales)}</p><p className="text-xs text-neutral-400">ภาษีขาย {bahtDoc(sumSales)}</p></div>
            <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs text-neutral-400">ยอดซื้อ (ฐาน VAT)</p><p className="text-lg font-bold">{bahtDoc(baseBuy)}</p><p className="text-xs text-neutral-400">ภาษีซื้อ {bahtDoc(sumBuy)}</p></div>
            <div className={cn("rounded-xl p-3", net >= 0 ? "bg-amber-50" : "bg-emerald-50")}>
              <p className="text-xs text-neutral-500">{net >= 0 ? "ภาษีต้องชำระ" : "ภาษีชำระเกิน (ขอคืน/ยกไป)"}</p>
              <p className={cn("text-lg font-bold", net >= 0 ? "text-amber-700" : "text-emerald-700")}>{bahtDoc(Math.abs(net))}</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">ใช้ตัวเลขนี้กรอกแบบ ภ.พ.30 บน e-filing ของกรมสรรพากรได้เลย · รายงานแนบดาวน์โหลดเป็น Excel ด้านล่าง</p>
        </CardContent>
      </Card>

      {[{ title: "รายงานภาษีขาย", list: salesTax, name: `vat-sales-${month}.xlsx` }, { title: "รายงานภาษีซื้อ", list: buyTax, name: `vat-buy-${month}.xlsx` }].map((sec) => (
        <Card key={sec.title}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{sec.title} ({sec.list.length} ใบ)</CardTitle>
            <ExportButtons xlsxName={sec.name} rows={mkRows(sec.list)} />
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {sec.list.length === 0 ? <EmptyState title="ไม่มีรายการเดือนนี้" /> : (
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
async function WhtTab({ shopId, supabase, month, monthStart, nextMonth, shopName, shopTaxId }: {
  shopId: string; supabase: SB; month: string; monthStart: string; nextMonth: string; shopName: string; shopTaxId: string;
}) {
  const { data } = await supabase.from("fin_docs")
    .select("id,doc_type,doc_number,contact_name,contact_tax_id,contact_address,issue_date,total,vat_amount,wht_rate,wht_amount")
    .eq("shop_id", shopId).neq("status", "void").gt("wht_amount", 0)
    .gte("issue_date", monthStart).lt("issue_date", nextMonth)
    .order("issue_date");
  const docs = (data ?? []) as unknown as FinDoc[];

  const paid = docs.filter((d) => d.doc_type === "expense");           // เราหักเขา -> นำส่ง ภ.ง.ด.
  const received = docs.filter((d) => d.doc_type !== "expense");       // เราถูกหัก -> เครดิตภาษีเรา
  const sumPaid = paid.reduce((a, d) => a + Number(d.wht_amount), 0);

  // แยกบุคคลธรรมดา (ภ.ง.ด.3) / นิติบุคคล (ภ.ง.ด.53) ด้วยเลข 13 หลักขึ้นต้น 0 = นิติบุคคล (โดยประมาณ)
  const isCompany = (taxId: string | null) => !!taxId && taxId.startsWith("0");
  const pnd53 = paid.filter((d) => isCompany(d.contact_tax_id));
  const pnd3 = paid.filter((d) => !isCompany(d.contact_tax_id));

  const mkRows = (list: FinDoc[]) => list.map((d, i) => ({
    "ลำดับ": i + 1, "เลขผู้เสียภาษี": d.contact_tax_id ?? "", "ชื่อผู้ถูกหัก": d.contact_name ?? "",
    "ที่อยู่": d.contact_address ?? "", "วันที่จ่าย": d.issue_date,
    "ประเภทเงินได้": "ค่าสินค้า/บริการ", "อัตรา (%)": Number(d.wht_rate),
    "ยอดเงินที่จ่าย": Number(d.total) - Number(d.vat_amount), "ภาษีที่หัก": Number(d.wht_amount),
    "เอกสารอ้างอิง": d.doc_number,
  }));
  const txtOf = (list: FinDoc[]) => list.map((d, i) =>
    [i + 1, d.contact_tax_id ?? "", (d.contact_name ?? "").replace(/\|/g, " "), (d.contact_address ?? "").replace(/\|/g, " "),
      d.issue_date, "ค่าสินค้า/บริการ", Number(d.wht_rate).toFixed(2),
      (Number(d.total) - Number(d.vat_amount)).toFixed(2), Number(d.wht_amount).toFixed(2)].join("|"),
  ).join("\r\n");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>สรุปหัก ณ ที่จ่าย เดือน {month} — {shopName} {shopTaxId && `(${shopTaxId})`}</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs text-neutral-400">ภาษีที่เราหักไว้ (ต้องนำส่ง)</p><p className="text-lg font-bold text-amber-700">{bahtDoc(sumPaid)}</p></div>
          <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs text-neutral-400">ภ.ง.ด.3 (บุคคลธรรมดา)</p><p className="text-lg font-bold">{pnd3.length} ราย · {bahtDoc(pnd3.reduce((a, d) => a + Number(d.wht_amount), 0))}</p></div>
          <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs text-neutral-400">ภ.ง.ด.53 (นิติบุคคล)</p><p className="text-lg font-bold">{pnd53.length} ราย · {bahtDoc(pnd53.reduce((a, d) => a + Number(d.wht_amount), 0))}</p></div>
        </CardContent>
      </Card>

      {[
        { title: "ภ.ง.ด.3 — หักจากบุคคลธรรมดา", list: pnd3, base: `pnd3-${month}` },
        { title: "ภ.ง.ด.53 — หักจากนิติบุคคล", list: pnd53, base: `pnd53-${month}` },
      ].map((sec) => (
        <Card key={sec.title}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{sec.title} ({sec.list.length})</CardTitle>
            <ExportButtons xlsxName={`${sec.base}.xlsx`} rows={mkRows(sec.list)}
              txtName={`${sec.base}.txt`} txtContent={txtOf(sec.list)} />
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {sec.list.length === 0 ? <EmptyState title="ไม่มีรายการเดือนนี้" /> : (
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
      ))}

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
      <p className="text-[11px] text-neutral-400">
        ไฟล์ .txt เป็นรูปแบบโอนย้ายข้อมูลแนบแบบ (คั่นด้วย |) — ก่อนยื่นจริงตรวจกับโปรแกรมโอนย้ายฯ ของกรมสรรพากรอีกครั้ง · หนังสือรับรอง 50 ทวิ พิมพ์ได้จากตารางด้านบน
      </p>
    </div>
  );
}

// ---------- งบทดลอง ----------
async function TrialTab({ shopId, supabase, month, nextMonth }: { shopId: string; supabase: SB; month: string; nextMonth: string }) {
  const { data: lines } = await supabase.from("journal_lines")
    .select("debit, credit, chart_of_accounts(code,name,type), journal_entries!inner(entry_date)")
    .eq("shop_id", shopId).lt("journal_entries.entry_date", nextMonth);

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
        <CardTitle>งบทดลอง (ยอดสะสมถึงสิ้นเดือน {month})</CardTitle>
        <ExportButtons xlsxName={`trial-balance-${month}.xlsx`} rows={exportRows} />
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {accounts.length === 0 ? <EmptyState title="ยังไม่มีรายการบัญชี" /> : (
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
