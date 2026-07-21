import { getCurrentShop } from "@/lib/shop";
import { Badge, Card, CardContent, EmptyState, Table, Th, Td } from "@/components/ui";
import { baht, dateTH, ORDER_STATUS_TH, cn } from "@/lib/utils";
import Link from "next/link";
import { VerifyButtons, ShipForm, RefundForm } from "./order-actions";
import EditOrderModal from "./edit-order-modal";
import TrackingImportModal from "./tracking-import-modal";
import type { Order } from "@/lib/types/db";

export const dynamic = "force-dynamic";
// bulkMarkShipped สูงสุด 200 ออเดอร์ (อัปเดต+แจ้งลูกค้ารายแถว) — กัน Vercel ตัดกลางคัน
export const maxDuration = 120;
const TABS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "pending_payment", label: "รอชำระ" },
  { key: "paid", label: "รอจัดส่ง" },
  { key: "shipped", label: "จัดส่งแล้ว" },
  { key: "completed", label: "สำเร็จ" },
  { key: "cancelled", label: "ยกเลิก" },
  { key: "expired", label: "หมดอายุ" },
  { key: "draft", label: "ตะกร้าที่ยังไม่ปิดการขาย" },
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const canManage = role === "owner" || role === "admin";
  const canFulfill = role !== "viewer"; // owner/admin/agent จัดการออเดอร์ได้ (ยืนยันจ่าย/จัดส่ง ต้อง owner/admin ตาม action)
  const { tab = "all" } = await searchParams;

  let query = supabase.from("orders")
    .select("*, customers(display_name), order_items(id, product_name, variant_name, quantity, unit_price, total), payments(id, status, amount, slip_storage_path, verified_by, method, created_at, order_id)")
    .eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(100);
  if (tab === "all") query = query.neq("status", "draft");
  else query = query.eq("status", tab);
  const { data } = await query;
  const orders = (data ?? []) as Order[];

  // ออเดอร์รอจัดส่ง — ส่งให้ modal นำเข้าเลขพัสดุใช้จับคู่/dropdown
  const { data: openRows } = canFulfill
    ? await supabase.from("orders").select("order_number").eq("shop_id", shop.id).in("status", ["paid", "confirmed"]).order("created_at", { ascending: false }).limit(300)
    : { data: [] };
  const openOrderNumbers = (openRows ?? []).map((o) => o.order_number as string);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">ออเดอร์</h1>
          <p className="text-sm text-neutral-400">ออเดอร์ทั้งหมดที่บอทและทีมของคุณปิดได้</p>
        </div>
        {canFulfill && <TrackingImportModal shopId={shop.id} openOrderNumbers={openOrderNumbers} />}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link key={t.key} href={`/dashboard/orders?tab=${t.key}`}
            className={cn("rounded-xl px-3.5 py-1.5 text-sm", tab === t.key ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100")}>
            {t.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="px-0 pb-0 pt-0">
          {orders.length === 0 ? (
            <EmptyState title="ไม่มีออเดอร์ในหมวดนี้" />
          ) : (
            <>
              {/* ===== ตาราง — จอใหญ่ (≥md) ===== */}
              <div className="hidden md:block">
                <Table>
                  <thead><tr><Th>ออเดอร์</Th><Th>ลูกค้า / รายการ</Th><Th>ยอดรวม</Th><Th>สถานะ</Th><Th>ปิดโดย</Th>{canFulfill && <Th>จัดการ</Th>}</tr></thead>
                  <tbody>
                    {orders.map((o) => {
                      const pendingPay = o.payments?.find((p) => ["pending", "verifying"].includes(p.status));
                      return (
                        <tr key={o.id}>
                          <Td>
                            <p className="font-medium">{o.order_number}</p>
                            <p className="text-[11px] text-neutral-400">{dateTH(o.created_at)}</p>
                          </Td>
                          <Td>
                            <p className="font-medium">{o.shipping_name ?? o.customers?.display_name ?? "-"}</p>
                            <p className="max-w-64 truncate text-[11px] text-neutral-400">
                              {(o.order_items ?? []).map((i) => `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ""} x${i.quantity}`).join(", ")}
                            </p>
                            {o.tracking_number && <p className="text-[11px] text-sky-600">พัสดุ: {o.tracking_number}</p>}
                          </Td>
                          <Td className="font-semibold">{baht(o.total)}</Td>
                          <Td>
                            <Badge tone={["paid", "confirmed", "completed"].includes(o.status) ? "green" : o.status === "shipped" ? "blue" : o.status === "pending_payment" ? "amber" : "neutral"}>
                              {ORDER_STATUS_TH[o.status] ?? o.status}
                            </Badge>
                          </Td>
                          <Td>{o.closed_by === "bot" ? <Badge tone="blue">🤖 บอท</Badge> : o.closed_by ? "แอดมิน" : "-"}</Td>
                          {canFulfill && (
                            <Td>
                              <div className="flex flex-col gap-1.5">
                                {o.status === "pending_payment" && pendingPay && canManage && <VerifyButtons paymentId={pendingPay.id} shopId={shop.id} />}
                                {["paid", "confirmed"].includes(o.status) && <ShipForm orderId={o.id} shopId={shop.id} />}
                                {["pending_payment", "paid", "confirmed", "shipped"].includes(o.status) && canManage && <RefundForm orderId={o.id} shopId={shop.id} isRefund={["paid", "confirmed", "shipped"].includes(o.status)} />}
                                {canManage && !["cancelled", "expired"].includes(o.status) && <EditOrderModal order={o} shopId={shop.id} />}
                              </div>
                            </Td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              {/* ===== การ์ด — มือถือ (<md) ===== */}
              <div className="divide-y divide-neutral-100 md:hidden">
                {orders.map((o) => {
                  const pendingPay = o.payments?.find((p) => ["pending", "verifying"].includes(p.status));
                  const hasActions = canFulfill && (
                    (o.status === "pending_payment" && pendingPay && canManage) ||
                    ["paid", "confirmed"].includes(o.status) ||
                    (["pending_payment", "paid", "confirmed", "shipped"].includes(o.status) && canManage) ||
                    (canManage && !["cancelled", "expired"].includes(o.status))
                  );
                  return (
                    <div key={o.id} className="space-y-2.5 px-4 py-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold">{o.order_number}</p>
                          <p className="text-[11px] text-neutral-400">{dateTH(o.created_at)}</p>
                        </div>
                        <Badge tone={["paid", "confirmed", "completed"].includes(o.status) ? "green" : o.status === "shipped" ? "blue" : o.status === "pending_payment" ? "amber" : "neutral"}>
                          {ORDER_STATUS_TH[o.status] ?? o.status}
                        </Badge>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{o.shipping_name ?? o.customers?.display_name ?? "-"}</p>
                        <p className="truncate text-[11px] text-neutral-400">
                          {(o.order_items ?? []).map((i) => `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ""} x${i.quantity}`).join(", ")}
                        </p>
                        {o.tracking_number && <p className="text-[11px] text-sky-600">พัสดุ: {o.tracking_number}</p>}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold tracking-tight">{baht(o.total)}</p>
                        {o.closed_by === "bot" ? <Badge tone="blue">🤖 บอทปิด</Badge> : o.closed_by ? <span className="text-[11px] text-neutral-400">ปิดโดยแอดมิน</span> : null}
                      </div>
                      {hasActions && (
                        <div className="flex flex-col gap-2 border-t border-neutral-100 pt-2.5">
                          {o.status === "pending_payment" && pendingPay && canManage && <VerifyButtons paymentId={pendingPay.id} shopId={shop.id} />}
                          {["paid", "confirmed"].includes(o.status) && <ShipForm orderId={o.id} shopId={shop.id} />}
                          {["pending_payment", "paid", "confirmed", "shipped"].includes(o.status) && canManage && <RefundForm orderId={o.id} shopId={shop.id} isRefund={["paid", "confirmed", "shipped"].includes(o.status)} />}
                          {canManage && !["cancelled", "expired"].includes(o.status) && <EditOrderModal order={o} shopId={shop.id} />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
