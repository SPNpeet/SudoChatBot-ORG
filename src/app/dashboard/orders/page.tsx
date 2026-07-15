import { getCurrentShop } from "@/lib/shop";
import { Badge, Card, CardContent, EmptyState, Table, Th, Td } from "@/components/ui";
import { baht, dateTH, ORDER_STATUS_TH, cn } from "@/lib/utils";
import Link from "next/link";
import { markShipped, verifyPaymentManual, refundOrder } from "../actions";
import type { Order } from "@/lib/types/db";

export const dynamic = "force-dynamic";
const TABS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "pending_payment", label: "รอชำระ" },
  { key: "paid", label: "รอจัดส่ง" },
  { key: "shipped", label: "จัดส่งแล้ว" },
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { supabase, shop } = await getCurrentShop();
  const { tab = "all" } = await searchParams;

  let query = supabase.from("orders")
    .select("*, customers(display_name), order_items(id, product_name, variant_name, quantity, unit_price, total), payments(id, status, amount, slip_storage_path, verified_by, method, created_at, order_id)")
    .eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(100);
  if (tab !== "all") query = query.eq("status", tab);
  const { data } = await query;
  const orders = (data ?? []) as Order[];

  async function ship(formData: FormData) {
    "use server";
    await markShipped(String(formData.get("order_id")), String(formData.get("shop_id")), String(formData.get("tracking") ?? ""));
  }
  async function verify(formData: FormData) {
    "use server";
    await verifyPaymentManual(String(formData.get("payment_id")), String(formData.get("shop_id")), formData.get("approve") === "1");
  }
  async function refund(formData: FormData) {
    "use server";
    await refundOrder(String(formData.get("order_id")), String(formData.get("shop_id")), String(formData.get("reason") ?? ""));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">ออเดอร์</h1>
        <p className="text-sm text-neutral-400">ออเดอร์ทั้งหมดที่บอทและทีมของคุณปิดได้</p>
      </div>

      <div className="flex gap-1.5">
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
            <Table>
              <thead><tr><Th>ออเดอร์</Th><Th>ลูกค้า / รายการ</Th><Th>ยอดรวม</Th><Th>สถานะ</Th><Th>ปิดโดย</Th><Th>จัดการ</Th></tr></thead>
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
                      <Td>
                        <div className="flex flex-col gap-1.5">
                          {o.status === "pending_payment" && pendingPay && (
                            <div className="flex gap-1.5">
                              <form action={verify}>
                                <input type="hidden" name="payment_id" value={pendingPay.id} />
                                <input type="hidden" name="shop_id" value={shop.id} />
                                <input type="hidden" name="approve" value="1" />
                                <button className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500">ยืนยันชำระ</button>
                              </form>
                              <form action={verify}>
                                <input type="hidden" name="payment_id" value={pendingPay.id} />
                                <input type="hidden" name="shop_id" value={shop.id} />
                                <input type="hidden" name="approve" value="0" />
                                <button className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50">ปฏิเสธ</button>
                              </form>
                            </div>
                          )}
                          {["paid", "confirmed"].includes(o.status) && (
                            <form action={ship} className="flex gap-1.5">
                              <input type="hidden" name="order_id" value={o.id} />
                              <input type="hidden" name="shop_id" value={shop.id} />
                              <input name="tracking" placeholder="เลขพัสดุ" className="h-7 w-28 rounded-lg border border-neutral-300 px-2 text-xs outline-none focus:border-emerald-500" />
                              <button className="rounded-lg bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700">จัดส่ง</button>
                            </form>
                          )}
                          {["pending_payment", "paid", "confirmed", "shipped"].includes(o.status) && (
                            <form action={refund} className="flex gap-1.5">
                              <input type="hidden" name="order_id" value={o.id} />
                              <input type="hidden" name="shop_id" value={shop.id} />
                              <input name="reason" placeholder="เหตุผล (ไม่บังคับ)" className="h-7 w-28 rounded-lg border border-neutral-300 px-2 text-xs outline-none focus:border-rose-400" />
                              <button className="rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">
                                {["paid", "confirmed", "shipped"].includes(o.status) ? "คืนเงิน/ยกเลิก" : "ยกเลิก"}
                              </button>
                            </form>
                          )}
                        </div>
                      </Td>
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
