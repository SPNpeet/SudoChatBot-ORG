// ============================================================
//  SLIP VERIFIER — ตรวจสลิปอัตโนมัติ -> ปิดออเดอร์ -> ตัดสต๊อก -> ขอบคุณลูกค้า
// ============================================================
import { sb, qRead, qDelete, qArchive, getChannelToken, auditLog, logAiUsage } from "../_shared/supabase.ts";
import { json } from "../_shared/utils.ts";
import { QueueSlip, OutMessage } from "../_shared/types.ts";
import { verifyWithEasySlip, verifyWithSlipOK, SlipResult } from "../_shared/slip.ts";
import { lineGetContent, lineSend } from "../_shared/line.ts";
import { metaSend } from "../_shared/meta.ts";

async function reply(item: QueueSlip, messages: OutMessage[], senderType = "system"): Promise<void> {
  const s = sb();
  const token = await getChannelToken(item.channel_id);
  let ok = false; let error: string | undefined;
  if (token) {
    const r = item.platform === "line"
      ? await lineSend(token, item.platform_user_id, messages)
      : await metaSend(token, item.platform_user_id, messages);
    ok = r.ok; error = r.error;
  }
  for (const m of messages) {
    await s.from("messages").insert({
      shop_id: item.shop_id, conversation_id: item.conversation_id,
      direction: "outbound", sender_type: senderType,
      content_type: m.type, content: m.type === "text" ? m.text : m.url,
      status: ok ? "sent" : "failed", error,
    });
  }
}

async function processSlip(item: QueueSlip): Promise<void> {
  const s = sb();

  // ---- ออเดอร์ + payment ----
  const { data: order } = await s.from("orders")
    .select("id,order_number,total,status,closed_by")
    .eq("id", item.order_id!).single();
  if (!order || order.status !== "pending_payment") {
    console.log("order not pending, skip slip"); return;
  }
  const { data: payment } = await s.from("payments").select("id,status")
    .eq("order_id", order.id).in("status", ["pending", "verifying"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!payment) { console.log("no pending payment"); return; }

  // ---- ดึงรูปสลิป ----
  let bytes: Uint8Array | null = null;
  if (item.media.line_message_id) {
    const token = await getChannelToken(item.channel_id);
    if (token) bytes = await lineGetContent(token, item.media.line_message_id);
  } else if (item.media.url) {
    const res = await fetch(item.media.url);
    if (res.ok) bytes = new Uint8Array(await res.arrayBuffer());
  }
  if (!bytes) throw new Error("ดาวน์โหลดรูปสลิปไม่สำเร็จ");

  // เก็บสลิปเข้า storage (audit)
  const slipPath = `${item.shop_id}/${order.order_number}-${Date.now()}.jpg`;
  await s.storage.from("slips").upload(slipPath, bytes, { contentType: "image/jpeg", upsert: true });

  // ---- ตั้งค่าผู้ให้บริการตรวจสลิปของร้าน ----
  const { data: paySettings } = await s.from("shop_payment_settings")
    .select("slip_provider,account_name,promptpay_id").eq("shop_id", item.shop_id).maybeSingle();
  const provider = paySettings?.slip_provider ?? "manual";

  let apiKey: string | null = null;
  if (provider !== "manual") {
    const { data } = await s.rpc("get_shop_slip_key", { p_shop_id: item.shop_id });
    apiKey = data as string | null;
  }

  await s.from("payments").update({ status: "verifying", slip_storage_path: slipPath }).eq("id", payment.id);

  // ---- ตรวจ ----
  let result: SlipResult | null = null;
  if (provider === "easyslip" && apiKey) result = await verifyWithEasySlip(bytes, apiKey);
  else if (provider === "slipok" && apiKey) result = await verifyWithSlipOK(bytes, apiKey);

  await logAiUsage({ shop_id: item.shop_id, conversation_id: item.conversation_id, purpose: "slip_verify", model: provider, cost_usd: 0 });

  if (!result) {
    // manual mode: แจ้งลูกค้า + รอแอดมินยืนยันใน dashboard
    await s.from("payments").update({ slip_data: { manual: true, path: slipPath } }).eq("id", payment.id);
    await reply(item, [{ type: "text", text: "ได้รับสลิปเรียบร้อยค่ะ แอดมินกำลังตรวจสอบและจะยืนยันออเดอร์ให้เร็วที่สุดนะคะ 🙏" }]);
    await auditLog({ shop_id: item.shop_id, actor_type: "system", action: "slip_waiting_manual", resource_type: "payment", resource_id: payment.id });
    return;
  }

  if (!result.ok) throw new Error(result.error ?? "slip provider error"); // ปัญหาชั่วคราว -> retry

  // ---- ตรวจไม่ผ่าน (ไม่ใช่สลิปจริง) ----
  if (!result.verified) {
    await s.from("payments").update({ status: "rejected", slip_data: result.raw ?? {}, error: result.error }).eq("id", payment.id);
    await reply(item, [{ type: "text", text: "ขออภัยค่ะ ระบบตรวจสอบสลิปไม่สำเร็จ รบกวนส่งรูปสลิปที่ชัดเจนอีกครั้ง หรือพิมพ์ 'ติดต่อแอดมิน' ได้เลยค่ะ" }]);
    return;
  }

  // ---- ยอดไม่ตรง ----
  const amount = result.amount ?? 0;
  if (Math.abs(amount - Number(order.total)) > 0.01) {
    await s.from("payments").update({
      status: "rejected", slip_data: result.raw ?? {},
      error: `ยอดไม่ตรง: สลิป ${amount} / ออเดอร์ ${order.total}`,
    }).eq("id", payment.id);
    await reply(item, [{ type: "text", text: `ยอดในสลิป (${amount.toLocaleString()} บาท) ไม่ตรงกับยอดออเดอร์ (${Number(order.total).toLocaleString()} บาท) ค่ะ รบกวนตรวจสอบอีกครั้ง หรือพิมพ์ 'ติดต่อแอดมิน' ได้เลยนะคะ` }]);
    return;
  }

  // ---- สลิปซ้ำ (เลขธุรกรรมเคยใช้แล้ว) ----
  const { error: refErr } = await s.from("payments").update({
    status: "verified", verified_by: "auto", verified_at: new Date().toISOString(),
    slip_data: result.raw ?? {}, slip_trans_ref: result.transRef ?? null,
  }).eq("id", payment.id);
  if (refErr) {
    if (refErr.code === "23505") {
      await s.from("payments").update({ status: "rejected", error: "สลิปนี้ถูกใช้ไปแล้ว" }).eq("id", payment.id);
      await reply(item, [{ type: "text", text: "สลิปนี้ถูกใช้ยืนยันไปแล้วค่ะ รบกวนตรวจสอบอีกครั้ง หรือพิมพ์ 'ติดต่อแอดมิน' นะคะ" }]);
      return;
    }
    throw new Error(refErr.message);
  }

  // ---- ผ่านทุกอย่าง: ปิดออเดอร์ + ตัดสต๊อก ----
  await s.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", order.id);
  const { data: items } = await s.from("order_items").select("product_id,variant_id,quantity").eq("order_id", order.id);
  for (const it of items ?? []) {
    if (it.product_id) {
      await s.rpc("decrement_stock", { p_product_id: it.product_id, p_variant_id: it.variant_id, p_qty: it.quantity });
    }
  }
  await auditLog({
    shop_id: item.shop_id, actor_type: "system", action: "order_paid_auto",
    resource_type: "order", resource_id: order.id,
    details: { order_number: order.order_number, amount, trans_ref: result.transRef, closed_by: order.closed_by },
  });
  // แจ้งเจ้าของร้าน: บอทปิดการขายได้แล้ว (dashboard + อีเมล)
  await s.rpc("notify_order_paid", { p_shop_id: item.shop_id, p_order_id: order.id });
  await reply(item, [{
    type: "text",
    text: `ยืนยันการชำระเงินเรียบร้อยค่ะ ✅\nออเดอร์ ${order.order_number} ยอด ${Number(order.total).toLocaleString()} บาท\nร้านจะรีบจัดส่งและแจ้งเลขพัสดุให้เร็วที่สุดนะคะ ขอบคุณที่อุดหนุนค่ะ 💚`,
  }]);
}

Deno.serve(async (_req: Request) => {
  let ok = 0, fail = 0;
  const rows = await qRead<QueueSlip>("slip_verification", 120, 3);
  for (const row of rows) {
    try {
      await processSlip(row.message);
      await qDelete("slip_verification", row.msg_id);
      ok++;
    } catch (e) {
      console.error("slip error", (e as Error).message);
      fail++;
      if (row.read_ct >= 3) {
        await qArchive("slip_verification", row.msg_id);
        await reply(row.message, [{ type: "text", text: "ขออภัยค่ะ ระบบตรวจสลิปขัดข้องชั่วคราว แอดมินจะรีบตรวจสอบให้เร็วที่สุดนะคะ 🙏" }]);
      }
    }
  }
  return json({ ok, fail });
});
