// ============================================================
//  ภาพรวมการเงิน — เปิดมาต้องรู้ทันทีว่า "วันนี้ต้องทำอะไร" ไม่ใช่แค่เห็นตัวเลขลอยๆ
//  ลำดับความสำคัญ: งานค้างวันนี้ → ตัวเลขพร้อมเทียบเดือนก่อน → กราฟ → เอกสารล่าสุด
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, Th, Td, EmptyState, StatCard } from "@/components/ui";
import { baht, dateOnlyTH } from "@/lib/utils";
import { DOC_TYPE_TH, docStatusLabel, docStatusTone, docOutstanding } from "@/lib/finance";
import type { DocStatus, DocType, FinDoc } from "@/lib/types/finance";
import CashflowChart from "./cashflow-chart";
import SetupChecklist from "./setup-checklist";
import SampleDataCard from "./sample-data-card";
import TodayPanel, { type TodoDoc } from "./today-panel";
import { TrendingUp, TrendingDown, Users, Receipt, ArrowUpRight, ArrowDownRight, LineChart, FileText } from "lucide-react";
import Link from "next/link";
import RowLink from "@/components/row-link";
import DataHealth from "./data-health";

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
  const bkkNow = new Date(Date.now() + 7 * 3600_000);
  const monthStart = bkkNow.toISOString().slice(0, 7) + "-01";
  const prevMonthStart = new Date(Date.UTC(bkkNow.getUTCFullYear(), bkkNow.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const since60 = new Date(Date.now() - 62 * 864e5).toISOString();
  const today = bkkNow.toISOString().slice(0, 10);

  const [
    { data: pays }, { data: openDocs }, { data: recentDocs }, { data: overdue },
    { count: sampleCount }, { count: docCount }, { count: pendingApproval }, { count: unmatchedSlips },
  ] = await Promise.all([
    supabase.from("fin_payments").select("direction,amount,paid_at").eq("shop_id", shop.id).gte("paid_at", since60),
    supabase.from("fin_docs").select("doc_type,total,wht_amount,paid_amount").eq("shop_id", shop.id).in("status", ["awaiting", "partial"]),
    supabase.from("fin_docs").select("*").eq("shop_id", shop.id).neq("status", "draft").order("created_at", { ascending: false }).limit(6),
    supabase.from("fin_docs").select("id,doc_type,doc_number,contact_name,due_date,total,wht_amount,paid_amount")
      .eq("shop_id", shop.id).in("status", ["awaiting", "partial"]).lt("due_date", today).order("due_date").limit(20),
    supabase.from("fin_docs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("is_sample", true),
    supabase.from("fin_docs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("fin_docs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("approval_status", "pending"),
    supabase.from("fin_payments").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).is("doc_id", null),
  ]);

  const sum = (dir: string, from: string, to?: string) => (pays ?? [])
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
  for (const p of (pays ?? []).filter((x) => x.paid_at >= since30)) {
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

  return (
    <div className="space-y-6">
      {/* ⚠️ ห้ามเอา 3 กล่องนี้กลับมา — ประกาศระบบ · อัตรา VAT · แจ้งเตือน
          ย้ายเข้ากล่องจดหมายระบบที่กระดิ่งแล้ว (src/lib/notices.ts)
          รอบ 1 ย้ายออกจาก layout มาที่นี่ · รอบ 2 ยกออกจากที่นี่อีกชั้น
          เอากลับมาคือโชว์ซ้ำสองที่ ทั้งสาม component ยังอยู่ในโปรเจกต์ ไม่ได้ลบ

          DataHealth ด้านล่างยังอยู่โดยเจตนา: เป็นเรื่องที่ทำให้ยื่นภาษีผิดจริง
          ต้องขวางตา ไม่ควรซ่อนใต้กระดิ่งที่ผู้ใช้อาจไม่กด และเป็นชั้นสำรอง
          ถ้ากล่องจดหมายล่ม (layout จับ error ไว้แล้วให้กระดิ่งว่าง) */}

      {/* ข้อมูลที่ขาดไม่ทำให้ระบบพัง แต่จะระเบิดตอนวันยื่นภาษีซึ่งแก้ไม่ทันแล้ว
          ระบบรู้ได้ตั้งแต่วันนี้ จึงต้องบอกตั้งแต่วันนี้ (ไม่ขึ้นถ้าข้อมูลครบ) */}
      <DataHealth shopId={shop.id} />

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <Card>
        <CardHeader><CardTitle>เงินเข้า-ออก 30 วันล่าสุด</CardTitle></CardHeader>
        <CardContent>
          {chartData.length > 1
            ? <CashflowChart data={chartData} />
            : <EmptyState icon={LineChart} title="ยังไม่มีข้อมูลเงินเข้า-ออก" hint="พอมีเงินเข้าหรือออกครั้งแรก กราฟจะขึ้นที่นี่ให้เอง ไม่ต้องตั้งค่าอะไร" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>เอกสารล่าสุด</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          {(recentDocs ?? []).length === 0 ? (
            <EmptyState icon={FileText} title="ยังไม่มีเอกสาร"
              hint="ลองพิมพ์สั่ง AI ดูก่อนก็ได้ เช่น “ออกใบแจ้งหนี้ให้ร้านสมชาย ค่าออกแบบ 5,000”"
              action={{ href: "/dashboard/assistant", label: "สั่งผู้ช่วย AI เป็นภาษาคน" }}
              secondary={{ href: "/dashboard/sales/new?type=invoice", label: "คีย์เอกสารเอง" }} />
          ) : (
            <Table>
              <thead><tr><Th>เลขที่</Th><Th>ประเภท</Th><Th>คู่ค้า</Th><Th className="text-right">ยอด</Th><Th>สถานะ</Th><Th>วันที่</Th></tr></thead>
              <tbody>
                {((recentDocs ?? []) as FinDoc[]).map((d) => (
                  <RowLink key={d.id} href={d.doc_type === "expense" ? `/dashboard/expenses/${d.id}` : `/dashboard/sales/${d.id}`}>
                    <Td>
                      <Link href={d.doc_type === "expense" ? `/dashboard/expenses/${d.id}` : `/dashboard/sales/${d.id}`}
                        className="font-medium text-emerald-700 hover:underline">{d.doc_number}</Link>
                    </Td>
                    <Td>{DOC_TYPE_TH[d.doc_type as DocType]}</Td>
                    <Td>{d.contact_name ?? "-"}</Td>
                    <Td className="text-right tabular-nums">{baht(d.total)}</Td>
                    <Td><Badge tone={docStatusTone(d.status as DocStatus)}>{docStatusLabel(d.doc_type as DocType, d.status as DocStatus)}</Badge></Td>
                    <Td className="text-neutral-400">{dateOnlyTH(d.issue_date)}</Td>
                  </RowLink>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
