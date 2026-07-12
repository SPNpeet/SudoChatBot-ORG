import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, Th, Td, EmptyState } from "@/components/ui";
import { baht, dateTH, ORDER_STATUS_TH } from "@/lib/utils";
import RevenueChart from "./revenue-chart";
import { Bot, MessageSquare, ShoppingBag, Wallet } from "lucide-react";
import type { Order } from "@/lib/types/db";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const { supabase, shop } = await getCurrentShop();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();

  const [ordersToday, msgsToday, analytics, recentOrders] = await Promise.all([
    supabase.from("orders").select("total,status,closed_by").eq("shop_id", shop.id).gte("created_at", todayStart.toISOString()),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).gte("created_at", todayStart.toISOString()),
    supabase.from("daily_analytics").select("*").eq("shop_id", shop.id).gte("date", since30.slice(0, 10)).order("date"),
    supabase.from("orders").select("*, customers(display_name)").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(6),
  ]);

  const paidStatuses = ["paid", "confirmed", "shipped", "completed"];
  const todayPaid = (ordersToday.data ?? []).filter((o) => paidStatuses.includes(o.status));
  const todayRevenue = todayPaid.reduce((a, o) => a + Number(o.total), 0);
  const botClosedToday = todayPaid.filter((o) => o.closed_by === "bot").length;

  const rows = analytics.data ?? [];
  const revenue30 = rows.reduce((a, r) => a + Number(r.revenue), 0) + todayRevenue;
  const botClosed30 = rows.reduce((a, r) => a + r.orders_closed_by_bot, 0) + botClosedToday;
  const paid30 = rows.reduce((a, r) => a + r.orders_paid, 0) + todayPaid.length;
  const botRate = paid30 ? Math.round((botClosed30 / paid30) * 100) : 0;

  const chartData = rows.map((r) => ({
    date: new Date(r.date).toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
    revenue: Number(r.revenue), orders: r.orders_paid,
  }));
  chartData.push({ date: "วันนี้", revenue: todayRevenue, orders: todayPaid.length });

  const stats = [
    { label: "ยอดขายวันนี้", value: baht(todayRevenue), icon: Wallet },
    { label: "ยอดขาย 30 วัน", value: baht(revenue30), icon: ShoppingBag },
    { label: "บอทปิดการขาย", value: `${botRate}%`, sub: `${botClosed30} จาก ${paid30} ออเดอร์`, icon: Bot },
    { label: "ข้อความวันนี้", value: String(msgsToday.count ?? 0), icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">ภาพรวม</h1>
        <p className="text-sm text-neutral-400">สรุปผลงานของบอทและยอดขายร้าน {shop.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-start justify-between pt-5">
              <div>
                <p className="text-xs text-neutral-400">{s.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{s.value}</p>
                {s.sub && <p className="mt-0.5 text-[11px] text-neutral-400">{s.sub}</p>}
              </div>
              <s.icon className="h-5 w-5 text-emerald-600" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>ยอดขาย 30 วันล่าสุด</CardTitle></CardHeader>
        <CardContent>
          {chartData.length > 1
            ? <RevenueChart data={chartData} />
            : <EmptyState title="ยังไม่มีข้อมูลยอดขาย" hint="เมื่อบอทปิดออเดอร์แรกได้ กราฟจะแสดงที่นี่" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ออเดอร์ล่าสุด</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          {(recentOrders.data ?? []).length === 0 ? (
            <EmptyState title="ยังไม่มีออเดอร์" hint="เชื่อมต่อช่องทางและเพิ่มสินค้า แล้วปล่อยให้บอททำงาน" />
          ) : (
            <Table>
              <thead><tr><Th>ออเดอร์</Th><Th>ลูกค้า</Th><Th>ยอด</Th><Th>สถานะ</Th><Th>ปิดโดย</Th><Th>เวลา</Th></tr></thead>
              <tbody>
                {(recentOrders.data as Order[]).map((o) => (
                  <tr key={o.id}>
                    <Td className="font-medium">{o.order_number}</Td>
                    <Td>{o.customers?.display_name ?? o.shipping_name ?? "-"}</Td>
                    <Td>{baht(o.total)}</Td>
                    <Td><Badge tone={["paid", "confirmed", "shipped", "completed"].includes(o.status) ? "green" : o.status === "pending_payment" ? "amber" : "neutral"}>{ORDER_STATUS_TH[o.status] ?? o.status}</Badge></Td>
                    <Td>{o.closed_by === "bot" ? <Badge tone="blue">🤖 บอท</Badge> : o.closed_by === "human" ? "แอดมิน" : "-"}</Td>
                    <Td className="text-neutral-400">{dateTH(o.created_at)}</Td>
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
