"use server";
// ============================================================
//  แก้ไขรายละเอียดออเดอร์หลังบอทสร้าง (ที่อยู่/เบอร์/จำนวน) — คืน {ok,error} เสมอ
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true } | { ok: false; error: string };

function friendly(e: unknown, fallback: string): string {
  const m = (e as Error).message ?? String(e);
  if (m.includes("forbidden")) return "คุณไม่มีสิทธิ์ทำรายการนี้ในร้านนี้";
  return m || fallback;
}

export interface OrderItemEdit { id: string; quantity: number }

export async function updateOrderDetails(
  orderId: string, shopId: string,
  fields: { name: string; phone: string; address: string },
  items: OrderItemEdit[],
): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    const { data: order } = await svc.from("orders").select("id,status,shipping_fee").eq("id", orderId).eq("shop_id", shopId).single();
    if (!order) return { ok: false, error: "ไม่พบออเดอร์" };

    const shippingUpdate: Record<string, unknown> = {
      shipping_name: fields.name.trim() || null,
      shipping_phone: fields.phone.trim() || null,
      shipping_address: fields.address.trim() ? { text: fields.address.trim() } : null,
    };

    // แก้จำนวนสินค้าได้เฉพาะก่อนจัดส่ง (กันสต๊อก/ยอดไม่ตรงหลังแพ็กของแล้ว)
    const canEditItems = ["draft", "pending_payment", "paid", "confirmed"].includes(order.status);
    if (canEditItems && items.length > 0) {
      const { data: rows } = await svc.from("order_items").select("id,unit_price").eq("order_id", orderId);
      const priceMap = new Map((rows ?? []).map((r) => [r.id, Number(r.unit_price)]));
      let subtotal = 0;
      for (const it of items) {
        const unit = priceMap.get(it.id);
        if (unit === undefined) continue;
        const qty = Math.max(1, Math.floor(it.quantity));
        const total = +(unit * qty).toFixed(2);
        subtotal += total;
        const { error } = await svc.from("order_items").update({ quantity: qty, total }).eq("id", it.id).eq("order_id", orderId);
        if (error) return { ok: false, error: `แก้จำนวนสินค้าไม่สำเร็จ: ${error.message}` };
      }
      subtotal = +subtotal.toFixed(2);
      const total = +(subtotal + Number(order.shipping_fee ?? 0)).toFixed(2);
      shippingUpdate.subtotal = subtotal;
      shippingUpdate.total = total;
    }

    const { error } = await svc.from("orders").update(shippingUpdate).eq("id", orderId);
    if (error) return { ok: false, error: error.message };

    await svc.from("audit_logs").insert({
      shop_id: shopId, actor_type: "user", action: "order_edited", resource_type: "order", resource_id: orderId,
    });
    revalidatePath("/dashboard/orders");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "แก้ไขออเดอร์ไม่สำเร็จ") };
  }
}
