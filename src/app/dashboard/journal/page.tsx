// ============================================================
//  สมุดรายวัน (GL) — ทุกธุรกรรมของระบบลงเดบิต/เครดิตอัตโนมัติ
//  นักบัญชีเข้ามารีวิว/เพิ่มรายการปรับปรุง (JV) ได้ ไม่ต้องคีย์ซ้ำ
//
//  หน้านี้เคยมีแค่ เดบิต/เครดิต ซึ่งคนที่ไม่ได้เรียนบัญชีอ่านไม่รู้เรื่องเลย
//  จึงเพิ่ม 4 อย่างที่ทำให้ "อ่านออก" โดยไม่ต้องรู้หลักบัญชี:
//   1) คำแปลเป็นภาษาคนของทั้งรายการ  2) ป้ายประเภทบัญชีต่อบรรทัด (สินทรัพย์/หนี้สิน/…)
//   3) ลิงก์กลับไปเอกสารต้นทาง        4) ตรารับรองว่าเดบิต = เครดิต (ลงตัว)
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Badge, Card, CardContent, EmptyState, Table, Th, Td } from "@/components/ui";
import { bahtDoc, dateOnlyTH, cn } from "@/lib/utils";
import type { Account, JournalEntry, JournalLine } from "@/lib/types/finance";
import { BookOpenText, CheckCircle2, AlertTriangle, ExternalLink, Lightbulb } from "lucide-react";
import Link from "next/link";
import ManualJournalForm from "./manual-form";

export const dynamic = "force-dynamic";

const SOURCE_TH: Record<string, string> = {
  sale: "ขาย", receipt: "รับเงิน", expense: "ค่าใช้จ่าย", payment: "จ่ายเงิน",
  stock: "สต๊อก/ต้นทุน", manual: "บันทึกเอง", reversal: "กลับรายการ",
};

/** คำแปลของทั้งรายการ — บอกว่า "เกิดอะไรขึ้นจริงๆ" ก่อนจะไปดูตัวเลข */
const SOURCE_PLAIN: Record<string, string> = {
  sale: "ขายของ/บริการ แล้วออกเอกสารให้ลูกค้า",
  receipt: "ได้รับเงินจากลูกค้า",
  expense: "มีค่าใช้จ่ายเกิดขึ้น (ตั้งเป็นบิลที่ต้องจ่าย)",
  payment: "จ่ายเงินออกไปแล้ว",
  stock: "ตัดสต๊อกเป็นต้นทุนของที่ขายไป",
  manual: "นักบัญชีบันทึกปรับปรุงเอง",
  reversal: "ยกเลิกรายการเดิม ระบบกลับบัญชีคืนให้",
};

const TYPE_TH: Record<Account["type"], string> = {
  asset: "สินทรัพย์", liability: "หนี้สิน", equity: "ทุน", income: "รายได้", expense: "ค่าใช้จ่าย",
};
const TYPE_TONE: Record<Account["type"], "green" | "amber" | "blue" | "neutral" | "red"> = {
  asset: "green", liability: "amber", equity: "blue", income: "green", expense: "red",
};

/** แปลงบรรทัดบัญชีเป็นภาษาคน เช่น "เงินเข้า" / "หนี้เพิ่ม" / "รายได้เพิ่ม" */
function plainEffect(type: Account["type"] | undefined, isDebit: boolean): string {
  if (!type) return "";
  const up = isDebit;
  switch (type) {
    case "asset":     return up ? "ของ/เงินเพิ่มขึ้น" : "ของ/เงินลดลง";
    case "liability": return up ? "หนี้ลดลง" : "หนี้เพิ่มขึ้น";
    case "equity":    return up ? "ทุนลดลง" : "ทุนเพิ่มขึ้น";
    case "income":    return up ? "รายได้ลดลง" : "รายได้เพิ่มขึ้น";
    case "expense":   return up ? "ค่าใช้จ่ายเพิ่มขึ้น" : "ค่าใช้จ่ายลดลง";
  }
}

/** ลิงก์กลับไปต้นทาง — source_id คือ fin_docs.id (sale/expense) หรือ fin_payments.id (receipt/payment) */
function sourceHref(e: JournalEntry): string | null {
  if (!e.source_id) return null;
  if (e.source_type === "sale") return `/dashboard/sales/${e.source_id}`;
  if (e.source_type === "expense") return `/dashboard/expenses/${e.source_id}`;
  if (e.source_type === "receipt" || e.source_type === "payment") return "/dashboard/money";
  return null;
}

/** query ดึง type ของบัญชีมาด้วย (นอกเหนือจาก code/name ใน JournalLine ฐาน) */
type LineWithAcct = Omit<JournalLine, "chart_of_accounts"> & {
  chart_of_accounts?: { code: string; name: string; type?: Account["type"] } | null;
};

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const canEdit = ["owner", "admin", "agent"].includes(role);
  const { m } = await searchParams;
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  const monthStart = `${month}-01`;
  const nextMonth = new Date(new Date(monthStart).getTime() + 40 * 864e5).toISOString().slice(0, 7) + "-01";

  const [{ data: entries }, { data: accounts }] = await Promise.all([
    supabase.from("journal_entries")
      .select("*, journal_lines(*, chart_of_accounts(code,name,type))")
      .eq("shop_id", shop.id).gte("entry_date", monthStart).lt("entry_date", nextMonth)
      .order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(300),
    supabase.from("chart_of_accounts").select("*").eq("shop_id", shop.id).eq("status", "active").order("code"),
  ]);

  const rows = (entries ?? []) as unknown as JournalEntry[];
  const monthTotal = rows.reduce((a, e) => a + (e.journal_lines ?? []).reduce((s, l) => s + Number(l.debit), 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-neutral-900">สมุดรายวัน</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {rows.length > 0
              ? <>เดือนนี้ <b className="text-neutral-900">{rows.length}</b> รายการ มูลค่ารวม <b className="text-neutral-900">{bahtDoc(monthTotal)}</b></>
              : "บันทึกบัญชีของทุกธุรกรรม เรียงตามวันที่"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form method="get" className="flex items-center gap-2">
            <input type="month" name="m" defaultValue={month} aria-label="เลือกเดือน"
              className="h-10 rounded-xl border border-neutral-300 bg-white px-3 text-base outline-none focus:border-emerald-500 sm:text-sm" />
            <button className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-700">ดู</button>
          </form>
          {canEdit && <ManualJournalForm shopId={shop.id} accounts={(accounts ?? []) as Account[]} />}
        </div>
      </div>

      {/* คำอธิบายเดบิต/เครดิตแบบที่คนไม่ได้เรียนบัญชีเข้าใจได้ — อยู่บนสุดครั้งเดียว ไม่รกทุกการ์ด */}
      <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/70 px-4 py-3">
        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-neutral-600">
          <Lightbulb aria-hidden className="mt-[1px] h-3.5 w-3.5 shrink-0 text-neutral-400" />
          <span>
            <b className="text-neutral-800">หน้านี้ไม่ต้องทำอะไรเลย</b> — ทุกครั้งที่ออกเอกสารหรือบันทึกเงิน ระบบเขียนบันทึกบัญชีให้เองตามมาตรฐาน
            ส่งหน้านี้ให้นักบัญชีดูได้ทันที
          </span>
        </p>
        <div className="mt-2.5 grid gap-2 text-[12px] text-neutral-500 sm:grid-cols-2">
          <p className="rounded-lg bg-white px-3 py-2 ring-1 ring-inset ring-neutral-200/70">
            <b className="text-neutral-700">เดบิต</b> = ฝั่งที่ของหรือค่าใช้จ่าย <i>เพิ่ม</i> (เงินเข้ากระเป๋า, ซื้อของ, จ่ายค่าไฟ)
          </p>
          <p className="rounded-lg bg-white px-3 py-2 ring-1 ring-inset ring-neutral-200/70">
            <b className="text-neutral-700">เครดิต</b> = ฝั่งที่เงินหรือรายได้ <i>ออก/เกิดขึ้น</i> (ขายได้, เป็นหนี้เพิ่ม, เงินออกจากบัญชี)
          </p>
        </div>
        <p className="mt-2 text-[11.5px] text-neutral-400">ทุกรายการสองฝั่งต้องเท่ากันเสมอ — ระบบตรวจให้อยู่แล้ว ถ้าไม่เท่าจะมีป้ายเตือนสีแดง</p>
      </div>

      {rows.length === 0 ? (
        <Card><CardContent className="pt-5">
          <EmptyState icon={BookOpenText} title="เดือนนี้ยังไม่มีรายการ"
            hint="สมุดรายวันคือบันทึกที่ระบบเขียนให้เองทุกครั้งที่มีเงินเคลื่อนไหว — ไม่ต้องคีย์เอง"
            steps={[
              "ออกเอกสารขาย หรือบันทึกค่าใช้จ่าย ตามปกติ",
              "ระบบแปลงเป็นรายการบัญชีคู่ (เดบิต/เครดิต) ให้อัตโนมัติ",
              "สิ้นเดือนกดออกรายงานภาษีได้เลย ไม่ต้องรวบรวมใหม่",
            ]}
            action={{ href: "/dashboard/sales/new?type=invoice", label: "ออกเอกสารใบแรก" }} />
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((e) => {
            const lines = ([...(e.journal_lines ?? [])] as LineWithAcct[]).sort((a, b) => a.sort - b.sort);
            const totalDr = lines.reduce((a, l) => a + Number(l.debit), 0);
            const totalCr = lines.reduce((a, l) => a + Number(l.credit), 0);
            const balanced = Math.abs(totalDr - totalCr) < 0.005;
            const href = sourceHref(e);

            return (
              <Card key={e.id} className="overflow-hidden">
                {/* หัวการ์ด: เลขที่ · ที่มา · วันที่ · ยอด · สถานะลงตัว */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50/60 px-4 py-2.5 sm:px-5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-neutral-800">{e.entry_number}</span>
                    <Badge tone={e.source_type === "manual" ? "blue" : e.source_type === "reversal" ? "red" : "neutral"}>
                      {SOURCE_TH[e.source_type] ?? e.source_type}
                    </Badge>
                    <span className="text-xs text-neutral-400">{dateOnlyTH(e.entry_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-neutral-900">{bahtDoc(totalDr)}</span>
                    {balanced
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600" title="เดบิตเท่ากับเครดิต ถูกต้องตามหลักบัญชี">
                          <CheckCircle2 className="h-3.5 w-3.5" />ลงตัว
                        </span>
                      : <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600" title="สองฝั่งไม่เท่ากัน ต้องตรวจสอบ">
                          <AlertTriangle className="h-3.5 w-3.5" />ไม่ลงตัว
                        </span>}
                  </div>
                </div>

                <CardContent className="px-0 pb-0 pt-0">
                  {/* คำแปลภาษาคน + ลิงก์ต้นทาง */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 sm:px-5">
                    <p className="text-[13px] text-neutral-600">
                      <span className="text-neutral-400">แปลว่า: </span>
                      {e.memo || SOURCE_PLAIN[e.source_type] || "บันทึกบัญชี"}
                    </p>
                    {href && (
                      <Link href={href} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[12px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50">
                        ดูเอกสารต้นทาง<ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>

                  <Table className="mt-2">
                    <thead>
                      <tr>
                        <Th>บัญชี</Th>
                        <Th className="hidden sm:table-cell">ประเภท</Th>
                        <Th className="hidden md:table-cell">ผลที่เกิดขึ้น</Th>
                        <Th className="text-right">เดบิต</Th>
                        <Th className="text-right">เครดิต</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => {
                        const isDebit = Number(l.debit) > 0;
                        const acct = l.chart_of_accounts;
                        const t = acct?.type;
                        return (
                          <tr key={l.id} className="hover:bg-neutral-50/60">
                            <Td className={cn("min-w-0", !isDebit && "pl-7 sm:pl-9")}>
                              <span className="mr-1.5 font-mono text-xs text-neutral-300">{acct?.code}</span>
                              <span className={cn("text-[13px]", isDebit ? "text-neutral-800" : "text-neutral-500")}>{acct?.name}</span>
                              {/* มือถือไม่มีคอลัมน์ประเภท/ผล เลยยัดมาไว้ใต้ชื่อบัญชีแทน จะได้ไม่เสียข้อมูล */}
                              {t && <span className="mt-0.5 block text-xs text-neutral-400 sm:hidden">{TYPE_TH[t]} · {plainEffect(t, isDebit)}</span>}
                            </Td>
                            <Td label="ประเภท" className="hidden sm:table-cell">
                              {t && <Badge tone={TYPE_TONE[t]}>{TYPE_TH[t]}</Badge>}
                            </Td>
                            <Td label="ผลที่เกิดขึ้น" className="hidden text-[12px] text-neutral-500 md:table-cell">{plainEffect(t, isDebit)}</Td>
                            <Td label="เดบิต" className="text-right tabular-nums">{isDebit ? bahtDoc(l.debit) : <span className="text-neutral-200">—</span>}</Td>
                            <Td label="เครดิต" className="text-right tabular-nums">{Number(l.credit) > 0 ? bahtDoc(l.credit) : <span className="text-neutral-200">—</span>}</Td>
                          </tr>
                        );
                      })}
                      <tr className="bg-neutral-50/80 font-semibold">
                        <Td className="text-[12px] text-neutral-500">รวม</Td>
                        <Td className="hidden sm:table-cell" />
                        <Td className="hidden md:table-cell" />
                        <Td label="เดบิต" className="text-right tabular-nums">{bahtDoc(totalDr)}</Td>
                        <Td label="เครดิต" className="text-right tabular-nums">{bahtDoc(totalCr)}</Td>
                      </tr>
                    </tbody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
