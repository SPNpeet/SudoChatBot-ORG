// ============================================================
//  Omise webhook — รับ event charge.complete แล้วเครดิต wallet
//  Omise ไม่เซ็นลายเซ็น webhook → ยืนยันโดย fetch charge จาก API ตรงเสมอ
//  (ตั้ง endpoint ใน Omise dashboard: https://<domain>/api/billing/omise/webhook)
// ============================================================
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getOmiseSecretKey, retrieveCharge } from "@/lib/omise";

export async function POST(request: Request) {
  // ยังไม่ได้ตั้ง service key -> ตอบ 503 ให้ Omise retry ภายหลัง (กัน event หายเงียบ)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "server not configured" }, { status: 503 });
  }
  const svc = createServiceClient();

  let event: { key?: string; data?: { id?: string; object?: string } } = {};
  try { event = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  // 1) เก็บ raw event ก่อนเสมอ (zero loss)
  const { data: evt } = await svc.from("webhook_events").insert({
    platform: "omise", event_type: event.key ?? "unknown", payload: event,
    signature_valid: null, status: "received",
  }).select("id").single();

  const done = async (status: string, error?: string) => {
    if (evt) await svc.from("webhook_events").update({ status, error: error ?? null, processed_at: new Date().toISOString() }).eq("id", evt.id);
    return NextResponse.json({ ok: true }); // ตอบ 200 เสมอ กัน Omise ปิด endpoint
  };

  const chargeId = event.data?.object === "charge" ? event.data?.id : undefined;
  if (event.key !== "charge.complete" || !chargeId) return done("skipped");

  const secretKey = await getOmiseSecretKey(svc);
  if (!secretKey) return done("failed", "omise key not configured");

  try {
    // 2) source of truth: ดึง charge จาก Omise API ตรง (กัน payload ปลอม)
    const charge = await retrieveCharge(secretKey, chargeId);
    if (!(charge.status === "successful" && charge.paid)) {
      // จ่ายไม่สำเร็จ/หมดอายุ -> ปิดรายการ
      await svc.from("topups").update({ status: "expired" })
        .eq("charge_id", charge.id).in("status", ["pending", "verifying"]);
      return done("processed", `charge ${charge.status}`);
    }

    const { data: topup } = await svc.from("topups").select("id,shop_id,amount,status").eq("charge_id", charge.id).single();
    if (!topup) return done("failed", "topup not found for charge");
    if (Math.round(Number(topup.amount) * 100) !== charge.amount) return done("failed", "amount mismatch");

    // 3) idempotent: อัปเดตเฉพาะแถวที่ยังไม่ paid — ถ้าไม่มีแถวคืนมา แปลว่าเครดิตไปแล้ว
    const { data: updated } = await svc.from("topups")
      .update({ status: "paid", verified_by: "omise", paid_at: new Date().toISOString(), slip_data: charge as unknown as Record<string, unknown> })
      .eq("id", topup.id).neq("status", "paid").select("id");
    if (updated && updated.length > 0) {
      await svc.rpc("credit_wallet", {
        p_shop_id: topup.shop_id, p_amount: Number(topup.amount), p_type: "topup",
        p_ref_type: "topup", p_ref_id: topup.id, p_note: "เติมเงินผ่าน Omise (PromptPay)", p_actor: null,
      });
    }
    return done("processed");
  } catch (e) {
    return done("failed", (e as Error).message);
  }
}
