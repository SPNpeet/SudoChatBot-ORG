// ============================================================
//  ภาพรวมการเงิน — เปิดมาต้องรู้ทันทีว่า "วันนี้ต้องทำอะไร" ไม่ใช่แค่เห็นตัวเลขลอยๆ
//  ลำดับความสำคัญ: งานค้างวันนี้ → ตัวเลขพร้อมเทียบเดือนก่อน → กราฟ → เอกสารล่าสุด
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, Th, Td, EmptyState, StatCard } from "@/components/ui";
import { baht, dateOnlyTH } from "@/lib/utils";
import { DOC_TYPE_TH, docStatusLabel, docStatusTone, docOutstanding } from "@/lib/finance";
import type { DocStatus, DocType, FinDoc } from "@/lib/types/finance";
import TodoCard from "./todo-card";
import CashflowChart from "./cashflow-chart";
import SetupChecklist from "./setup-checklist";
import SampleDataCard from "./sample-data-card";
import TodayPanel, { type TodoDoc } from "./today-panel";
import CommandBar from "./command-bar";
import DocTemplates from "./doc-templates";
import { TrendingUp, TrendingDown, Users, Receipt, ArrowUpRight, ArrowDownRight, LineChart, FileText, Wallet } from "lucide-react";
import Link from "next/link";
import RowLink from "@/components/row-link";

export const dynamic = "force-dynamic";

/** ทักทายตามเวลาไทย — ทำให้หน้าเหมือนมีคนคุยด้วย ไม่ใช่รายงานเปล่าๆ */
function greeting(h: number) {
  if (h < 11) return "สวัสดีตอนเช้า";
  if (h < 15) return "สวัสดีตอนบ่าย";
  if (h < 19) return "สวัสดีตอนเย็น";
  return "สวัสดีตอนค่ำ";
}

/** เทียบกับเดือนก่อน — ตัวเลขเดี่ยวๆ ไม่บอกอะไร ต้องมีจุดอ้างอิงถึงจะมีความหมาย */
function delta(now: number, prev: number) {
  if (prev <= 0) return null;
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return null;
  return pct;
}

export default async function Overview() {
  const { supabase, shop } = await getCurrentShop();
  // ชื่อที่ลูกค้าตั้งให้ผู้ช่วย (ตั้งได้ที่หน้าผู้ช่วย) — ใช้ทักทายบนช่องสั่งงาน
  const assistantName = String((((shop as { settings?: Record<string, unknown> | null }).settings ?? {}) as Record<string, unknown>).assistant_name ?? "").trim() || null;
  const bkkNow = new Date(Date.now() + 7 * 3600_000);
  const monthStart = bkkNow.toISOString().slice(0, 7) + "-01";
  const prevMonthStart = new Date(Date.UTC(bkkNow.getUTCFullYear(), bkkNow.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const since60 = new Date(Date.now() - 62 * 864e5).toISOString();
  const today = bkkNow.toISOString().slice(0, 10);

  const [
    { data: pays }, { data: openDocs }, { data: recentDocs }, { data: overdue },
    { count: sampleCount }, { count: docCount }, { count: pendingApproval }, { count: unmatchedSlips },
    { count: draftDocs }, { data: cashBalanceRaw },
  ] = await Promise.all([
    // กันรายการของเอกสารที่ยกเลิกแล้ว (กรองในโค้ดด้านล่าง) — ห้ามใช้ !inner เพราะจะตัดเงินที่ยังไม่ผูกเอกสารทิ้ง
    supabase.from("fin_payments").select("direction,amount,paid_at,fin_docs(status)")
      .eq("shop_id", shop.id).gte("paid_at", since60),
    supabase.from("fin_docs").select("doc_type,total,wht_amount,paid_amount").eq("shop_id", shop.id).in("status", ["awaiting", "partial"]),
    supabase.from("fin_docs").select("*").eq("shop_id", shop.id).neq("status", "draft").order("created_at", { ascending: false }).limit(6),
    supabase.from("fin_docs").select("id,doc_type,doc_number,contact_name,due_date,total,wht_amount,paid_amount")
      .eq("shop_id", shop.id).in("status", ["awaiting", "partial"]).lt("due_date", today).order("due_date").limit(20),
    supabase.from("fin_docs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("is_sample", true),
    supabase.from("fin_docs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("fin_docs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("approval_status", "pending"),
    supabase.from("fin_payments").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).is("doc_id", null),
    supabase.from("fin_docs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "draft"),
    // ยอดเงินสด+เงินฝากตามสมุดบัญชี — รวมทุกแถวตั้งแต่แถวแรก จึงคิดฝั่งฐานข้อมูล
    // ดูเหตุผลและข้อจำกัด (ไม่ใช่ยอดธนาคารจริง) ใน migration 105
    supabase.rpc("shop_cash_balance", { p_shop_id: shop.id }),
  ]);

  // เอกสารที่ยกเลิกแล้ว = สมุดรายวันกลับรายการไปแล้ว ตัวเลขบนแดชบอร์ดต้องไม่นับต่อ
  // แต่แถวที่ยังไม่ผูกเอกสาร (fin_docs เป็น null) คือเงินจริงที่ลงบัญชีแล้ว ต้องนับ
  const livePays = ((pays ?? []) as unknown as { direction: string; amount: number; paid_at: string; fin_docs?: { status?: string } | null }[])
    .filter((p) => (p.fin_docs?.status ?? "") !== "void");
  const sum = (dir: string, from: string, to?: string) => livePays
    .filter((p) => p.direction === dir && p.paid_at >= from && (!to || p.paid_at < to))
    .reduce((a, p) => a + Number(p.amount), 0);

  const monthIn = sum("in", monthStart);
  const monthOut = sum("out", monthStart);
  const prevIn = sum("in", prevMonthStart, monthStart);
  const prevOut = sum("out", prevMonthStart, monthStart);
  const ar = (openDocs ?? []).filter((d) => d.doc_type === "invoice").reduce((a, d) => a + docOutstanding(d), 0);
  const ap = (openDocs ?? []).filter((d) => d.doc_type === "expense").reduce((a, d) => a + docOutstanding(d), 0);

  // กราฟเงินเข้า-ออกรายวัน 30 วันล่าสุด
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const byDay = new Map<string, { in: number; out: number }>();
  for (const p of livePays.filter((x) => x.paid_at >= since30)) {
    const d = new Date(new Date(p.paid_at).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
    const cur = byDay.get(d) ?? { in: 0, out: 0 };
    cur[p.direction as "in" | "out"] += Number(p.amount);
    byDay.set(d, cur);
  }
  const chartData = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({
    date: new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" }), ...v,
  }));

  // ภ.พ.30 ยื่นภายในวันที่ 15 ของเดือนถัดไป
  const dayOfMonth = bkkNow.getUTCDate();
  const taxDueDay = dayOfMonth <= 15 ? 15 - dayOfMonth : null;

  const dIn = delta(monthIn, prevIn);
  const dOut = delta(monthOut, prevOut);
  const trend = (pct: number | null, goodWhenUp: boolean) => {
    if (pct === null) return undefined;
    const good = goodWhenUp ? pct > 0 : pct < 0;
    const Icon = pct > 0 ? ArrowUpRight : ArrowDownRight;
    return (
      <span className={good ? "inline-flex items-center gap-0.5 text-emerald-600" : "inline-flex items-center gap-0.5 text-neutral-400"}>
        <Icon className="h-3 w-3" />{Math.abs(pct)}% จากเดือนก่อน
      </span>
    );
  };

  const netFlow = monthIn - monthOut;
  const cashBalance = Number(cashBalanceRaw ?? 0);

  return (
    <div className="space-y-6">
      {/* ⚠️ ห้ามเอา 3 กล่องนี้กลับมา — ประกาศระบบ · อัตรา VAT · แจ้งเตือน
          ย้ายเข้ากล่องจดหมายระบบที่กระดิ่งแล้ว (src/lib/notices.ts)
          รอบ 1 ย้ายออกจาก layout มาที่นี่ · รอบ 2 ยกออกจากที่นี่อีกชั้น
          เอากลับมาคือโชว์ซ้ำสองที่ ทั้งสาม component ยังอยู่ในโปรเจกต์ ไม่ได้ลบ

          DataHealth ก็ยกเข้ากระดิ่งแล้วเหมือนกัน (กุญแจ health:*) เจ้าของสั่งเมื่อ 30 ก.ค.
          เดิมกันไว้เป็นชั้นสำรองเพราะกลัวกระดิ่งล่มแล้วคำเตือนหายเงียบ
          แก้ด้วยวิธีที่ตรงกว่า: ถ้า getNotices ล้ม layout จะยัดข้อความ
          "ตรวจสถานะระบบไม่สำเร็จ" เข้ากระดิ่งแทนที่จะเงียบ — ดู layout.tsx
          จึงไม่ต้องมีแถบซ้ำสองที่อีก */}


      {/* ทักทาย + สรุปหนึ่งบรรทัดที่บอกสถานะเงินสดทันที */}
      <div>
        <p className="text-xs text-neutral-400">
          {bkkNow.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
        </p>
        <h1 className="mt-0.5 text-xl font-bold tracking-tight">
          {greeting(bkkNow.getUTCHours())} · {shop.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {docCount === 0
            ? "ยังไม่มีเอกสารในระบบ — เริ่มจากกดปุ่ม + มุมขวาล่าง หรือลองข้อมูลตัวอย่างด้านล่าง"
            : <>เดือนนี้เงินสด{netFlow >= 0 ? "เป็นบวก " : "ติดลบ "}
                <b className={netFlow >= 0 ? "text-emerald-700" : "text-red-600"}>{baht(Math.abs(netFlow))}</b>
                {ar > 0 && <> · รอเก็บอีก <b className="text-amber-700">{baht(ar)}</b></>}
              </>}
        </p>
      </div>

      {/* ⚠️ ต้องอยู่เหนือทุกอย่างที่เป็นตัวเลข
          จุดขายของระบบคือสั่งงานด้วยการพิมพ์ ถ้าวางไว้ท้ายหน้าคนจะเลื่อนไม่ถึง
          และกลับไปคีย์มือเหมือนโปรแกรมบัญชีทั่วไป = จ่ายค่า AI แล้วไม่ได้ใช้ */}
      <CommandBar assistantName={assistantName} />

      <SampleDataCard shopId={shop.id} hasSample={(sampleCount ?? 0) > 0} isEmpty={(docCount ?? 0) === 0} />

      {(docCount ?? 0) > 0 && (
        <TodayPanel
          overdue={(overdue ?? []) as TodoDoc[]}
          pendingApproval={pendingApproval ?? 0}
          unmatchedSlips={unmatchedSlips ?? 0}
          taxDueDay={taxDueDay}
        />
      )}

      <SetupChecklist shop={shop} />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-5">
        {/* ⚠️ ป้ายต้องเขียนว่า "เงินสด + เงินฝาก" และกำกับว่า "ตามสมุดบัญชี" เสมอ
            ห้ามเปลี่ยนเป็น "เงินคงเหลือในบัญชี" หรือคำที่ทำให้เข้าใจว่าเป็นยอดในธนาคารจริง
            ระบบไม่ได้ต่อกับธนาคาร ตัวเลขนี้ยังไม่ผ่านการกระทบยอด — เหตุผลเต็มอยู่ใน migration 105 */}
        <StatCard label="เงินสด + เงินฝาก" value={baht(cashBalance)} icon={<Wallet className="h-4 w-4" />}
          tone={cashBalance < 0 ? "red" : "green"} href="/dashboard/journal"
          hint={cashBalance < 0
            ? "ติดลบ — แปลว่ามีรายจ่ายที่จ่ายออกมากกว่าเงินที่บันทึกรับเข้า"
            : "ตามสมุดบัญชี · ยังไม่กระทบยอดธนาคาร"} />
        {/* ทุกใบกดได้ทั้งใบ ไม่ใช่กดได้แค่ตัวหนังสือเล็กๆ ข้างล่าง */}
        <StatCard label="เงินเข้าเดือนนี้" value={baht(monthIn)} icon={<TrendingUp className="h-4 w-4" />} tone="green"
          hint={trend(dIn, true)} href="/dashboard/money" />
        <StatCard label="เงินออกเดือนนี้" value={baht(monthOut)} icon={<TrendingDown className="h-4 w-4" />}
          hint={trend(dOut, false)} href="/dashboard/money" />
        {/* ไอคอน 2 ใบนี้ต้องบอก "ใคร/อะไร" ไม่ใช่แค่ "เงิน" — ลูกหนี้=คนที่ค้างเรา, เจ้าหนี้=บิลที่เราต้องจ่าย */}
        <StatCard label="ลูกหนี้ค้างรับ" value={baht(ar)} icon={<Users className="h-4 w-4" />} tone="amber"
          href="/dashboard/sales?t=unpaid"
          hint={ar > 0 ? "ดูว่าใครค้างเรา →" : "ไม่มียอดค้าง"} />
        <StatCard label="เจ้าหนี้ค้างจ่าย" value={baht(ap)} icon={<Receipt className="h-4 w-4" />} tone={ap > 0 ? "red" : "neutral"}
          href="/dashboard/expenses?t=unpaid"
          hint={ap > 0 ? "ดูบิลที่ต้องจ่าย →" : "ไม่มีบิลค้าง"} />
      </div>

      {/* ⚠️ กราฟขึ้นเฉพาะตอนมีข้อมูลพอจะเห็น "แนวโน้ม" จริง (>= 4 วันที่มีเงินเคลื่อนไหว)
          เจ้าของเจอเอง: มีข้อมูลจริง 2 วัน แต่กราฟลากเส้นโค้งสวยเต็มการ์ด
          ซึ่งอ่านแล้วเข้าใจผิดว่ามีแนวโน้ม ทั้งที่เส้นระหว่างจุด 2 จุดไม่ได้บอกอะไรเลย
          กราฟที่ข้อมูลไม่พอคือการตกแต่ง ไม่ใช่ข้อมูล — และกินพื้นที่ที่ควรเป็นของงานจริง
          ต่ำกว่าเกณฑ์ = ไม่โชว์การ์ดเลย ดีกว่าโชว์กล่องว่างที่กินที่เท่ากัน */}
      {chartData.length >= 4 && (
        <Card>
          <CardHeader><CardTitle>เงินเข้า-ออก 30 วันล่าสุด</CardTitle></CardHeader>
          <CardContent><CashflowChart data={chartData} /></CardContent>
        </Card>
      )}

      {/* ⚠️ วางก่อน "เอกสารล่าสุด" โดยตั้งใจ — สิ่งที่ยังต้องทำสำคัญกว่าสิ่งที่ทำไปแล้ว
          และเป็นเหตุผลเดียวที่ทำให้คนเปิดระบบซ้ำในวันถัดไป (ดูคอมเมนต์ใน todo-card.tsx) */}
      <TodoCard
        today={today}
        overdue={(overdue ?? []) as never}
        pendingApproval={pendingApproval ?? 0}
        unmatchedSlips={unmatchedSlips ?? 0}
        draftDocs={draftDocs ?? 0}
        hasVat={!!shop.tax_id}
      />

      <DocTemplates />

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>เอกสารล่าสุด</CardTitle>
          {/* ทางออกจากการ์ด — เดิมดูได้แค่ 6 ใบแล้วตัน ต้องไปหาเมนูเอง */}
          <Link href="/dashboard/sales" className="shrink-0 text-xs font-medium text-emerald-700 hover:underline">
            ดูทั้งหมด →
          </Link>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {(recentDocs ?? []).length === 0 ? (
            <EmptyState icon={FileText} title="ยังไม่มีเอกสาร"
              hint="ลองพิมพ์สั่ง AI ดูก่อนก็ได้ เช่น “ออกใบแจ้งหนี้ให้ร้านสมชาย ค่าออกแบบ 5,000”"
              action={{ href: "/dashboard/assistant", label: "สั่งผู้ช่วย AI เป็นภาษาคน" }}
              secondary={{ href: "/dashboard/sales/new?type=invoice", label: "คีย์เอกสารเอง" }} />
          ) : (
            <>
            {/* ⚠️ มือถือ = การ์ด · เดสก์ท็อป = ตาราง และห้ามยุบเหลืออย่างเดียว
                ตารางบนจอ 375px ต้องเลื่อนแนวนอนถึงจะเห็นครบ 6 คอลัมน์ ซึ่งไม่มีใครเลื่อน
                คนบนมือถือจึงเห็นแค่ "เลขที่กับประเภท" แล้วเดาเอาว่าใบไหนจ่ายแล้ว
                ส่วนบนเดสก์ท็อปการ์ดแย่กว่าตาราง เพราะคนที่เปิดดูวันละหลายรอบ
                กวาดสายตาลงคอลัมน์เดียวได้เร็วกว่าอ่านการ์ดทีละใบ — คนละสถานการณ์ ไม่ใช่รสนิยม */}
            <div className="space-y-2 px-4 pb-4 sm:hidden">
              {((recentDocs ?? []) as FinDoc[]).map((d) => (
                <Link key={d.id} href={d.doc_type === "expense" ? `/dashboard/expenses/${d.id}` : `/dashboard/sales/${d.id}`}
                  className="flex min-h-[44px] items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 transition-colors active:bg-neutral-50">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-500">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-semibold text-neutral-900">{d.doc_number}</span>
                      <Badge tone={docStatusTone(d.status as DocStatus)}>{docStatusLabel(d.doc_type as DocType, d.status as DocStatus)}</Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-neutral-500">
                      {DOC_TYPE_TH[d.doc_type as DocType]} · {d.contact_name ?? "-"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-semibold tabular-nums text-neutral-900">{baht(d.total)}</span>
                    <span className="block text-xs text-neutral-400">{dateOnlyTH(d.issue_date)}</span>
                  </span>
                </Link>
              ))}
            </div>

            <div className="hidden sm:block">
            <Table>
              <thead><tr><Th>เลขที่</Th><Th>ประเภท</Th><Th>คู่ค้า</Th><Th className="text-right">ยอด</Th><Th>สถานะ</Th><Th>วันที่</Th></tr></thead>
              <tbody>
                {((recentDocs ?? []) as FinDoc[]).map((d) => (
                  <RowLink key={d.id} href={d.doc_type === "expense" ? `/dashboard/expenses/${d.id}` : `/dashboard/sales/${d.id}`}>
                    <Td>
                      <Link href={d.doc_type === "expense" ? `/dashboard/expenses/${d.id}` : `/dashboard/sales/${d.id}`}
                        className="font-medium text-emerald-700 hover:underline">{d.doc_number}</Link>
                    </Td>
                    <Td label="ประเภท">{DOC_TYPE_TH[d.doc_type as DocType]}</Td>
                    <Td label="คู่ค้า">{d.contact_name ?? "-"}</Td>
                    <Td label="ยอด" className="text-right tabular-nums">{baht(d.total)}</Td>
                    <Td label="สถานะ"><Badge tone={docStatusTone(d.status as DocStatus)}>{docStatusLabel(d.doc_type as DocType, d.status as DocStatus)}</Badge></Td>
                    <Td label="วันที่" className="text-neutral-400">{dateOnlyTH(d.issue_date)}</Td>
                  </RowLink>
                ))}
              </tbody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
