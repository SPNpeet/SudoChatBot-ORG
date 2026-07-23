// ============================================================
//  ภาพรวมการเงิน — Executive Dashboard: กระแสเงินสด ค้างรับ-ค้างจ่าย
//  เอกสารเกินกำหนด และเอกสารล่าสุด (ตัวเลขจริงจากระบบบัญชี)
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, Th, Td, EmptyState } from "@/components/ui";
import { baht, dateOnlyTH, cn } from "@/lib/utils";
import { DOC_TYPE_TH, docStatusLabel, docStatusTone, docOutstanding } from "@/lib/finance";
import type { DocStatus, DocType, FinDoc } from "@/lib/types/finance";
import CashflowChart from "./cashflow-chart";
import SetupChecklist from "./setup-checklist";
import { TrendingUp, TrendingDown, HandCoins, AlarmClock } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const { supabase, shop } = await getCurrentShop();
  const monthStart = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7) + "-01";
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

  const [{ data: pays30 }, { data: openDocs }, { data: recentDocs }, { data: overdue }] = await Promise.all([
    supabase.from("fin_payments").select("direction,amount,paid_at").eq("shop_id", shop.id).gte("paid_at", since30),
    supabase.from("fin_docs").select("doc_type,total,wht_amount,paid_amount").eq("shop_id", shop.id).in("status", ["awaiting", "partial"]),
    supabase.from("fin_docs").select("*").eq("shop_id", shop.id).neq("status", "draft").order("created_at", { ascending: false }).limit(6),
    supabase.from("fin_docs").select("id,doc_type,doc_number,contact_name,due_date,total,wht_amount,paid_amount")
      .eq("shop_id", shop.id).in("status", ["awaiting", "partial"]).lt("due_date", today)
      .order("due_date").limit(5),
  ]);

  const monthIn = (pays30 ?? []).filter((p) => p.direction === "in" && p.paid_at >= monthStart).reduce((a, p) => a + Number(p.amount), 0);
  const monthOut = (pays30 ?? []).filter((p) => p.direction === "out" && p.paid_at >= monthStart).reduce((a, p) => a + Number(p.amount), 0);
  const ar = (openDocs ?? []).filter((d) => d.doc_type === "invoice").reduce((a, d) => a + docOutstanding(d), 0);
  const ap = (openDocs ?? []).filter((d) => d.doc_type === "expense").reduce((a, d) => a + docOutstanding(d), 0);

  // กราฟเงินเข้า-ออกรายวัน 30 วัน
  const byDay = new Map<string, { in: number; out: number }>();
  for (const p of pays30 ?? []) {
    const d = new Date(new Date(p.paid_at).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
    const cur = byDay.get(d) ?? { in: 0, out: 0 };
    cur[p.direction as "in" | "out"] += Number(p.amount);
    byDay.set(d, cur);
  }
  const chartData = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({
    date: new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" }), ...v,
  }));

  const stats = [
    { label: "เงินเข้าเดือนนี้", value: baht(monthIn), icon: TrendingUp, tone: "text-emerald-600" },
    { label: "เงินออกเดือนนี้", value: baht(monthOut), icon: TrendingDown, tone: "text-red-500" },
    { label: "ลูกหนี้ค้างรับ", value: baht(ar), icon: HandCoins, tone: "text-amber-600" },
    { label: "เจ้าหนี้ค้างจ่าย", value: baht(ap), icon: AlarmClock, tone: "text-neutral-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">ภาพรวมการเงิน</h1>
        <p className="text-sm text-neutral-400">สถานะเงินสดและเอกสารของ {shop.name} — ตัวเลขจริงจากสมุดรายวัน ไม่ต้องรอปิดงบ</p>
      </div>

      <SetupChecklist shop={shop} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-start justify-between pt-5">
              <div>
                <p className="text-xs text-neutral-400">{s.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{s.value}</p>
              </div>
              <s.icon className={cn("h-5 w-5", s.tone)} />
            </CardContent>
          </Card>
        ))}
      </div>

      {(overdue ?? []).length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader><CardTitle className="text-amber-800">⏰ เกินกำหนดชำระ — ควรตามวันนี้</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {(overdue ?? []).map((d) => (
              <Link key={d.id} href={d.doc_type === "expense" ? `/dashboard/expenses/${d.id}` : `/dashboard/sales/${d.id}`}
                className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm hover:bg-neutral-50">
                <span>
                  <span className="font-medium">{d.doc_number}</span>
                  <span className="ml-2 text-neutral-500">{d.contact_name ?? "-"}</span>
                  <span className="ml-2 text-xs text-neutral-400">ครบกำหนด {dateOnlyTH(d.due_date)}</span>
                </span>
                <span className={cn("font-semibold", d.doc_type === "expense" ? "text-red-600" : "text-amber-600")}>
                  {d.doc_type === "expense" ? "ต้องจ่าย" : "รอรับ"} {baht(docOutstanding(d))}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>เงินเข้า-ออก 30 วันล่าสุด</CardTitle></CardHeader>
        <CardContent>
          {chartData.length > 1
            ? <CashflowChart data={chartData} />
            : <EmptyState title="ยังไม่มีข้อมูลเงินเข้า-ออก" hint="เมื่อออกเอกสาร/บันทึกรับ-จ่ายเงิน กราฟจะแสดงที่นี่" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>เอกสารล่าสุด</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          {(recentDocs ?? []).length === 0 ? (
            <EmptyState title="ยังไม่มีเอกสาร" hint="เริ่มจากออกใบแจ้งหนี้/ใบเสร็จ หรือบันทึกค่าใช้จ่าย — สั่งผู้ช่วย AI เป็นภาษาคนได้เลย" />
          ) : (
            <Table>
              <thead><tr><Th>เลขที่</Th><Th>ประเภท</Th><Th>คู่ค้า</Th><Th className="text-right">ยอด</Th><Th>สถานะ</Th><Th>วันที่</Th></tr></thead>
              <tbody>
                {((recentDocs ?? []) as FinDoc[]).map((d) => (
                  <tr key={d.id}>
                    <Td>
                      <Link href={d.doc_type === "expense" ? `/dashboard/expenses/${d.id}` : `/dashboard/sales/${d.id}`}
                        className="font-medium text-emerald-700 hover:underline">{d.doc_number}</Link>
                    </Td>
                    <Td>{DOC_TYPE_TH[d.doc_type as DocType]}</Td>
                    <Td>{d.contact_name ?? "-"}</Td>
                    <Td className="text-right">{baht(d.total)}</Td>
                    <Td><Badge tone={docStatusTone(d.status as DocStatus)}>{docStatusLabel(d.doc_type as DocType, d.status as DocStatus)}</Badge></Td>
                    <Td className="text-neutral-400">{dateOnlyTH(d.issue_date)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
