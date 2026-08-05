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
      const { error: creditErr } = await svc.rpc("credit_wallet", {
        p_shop_id: topup.shop_id, p_amount: Number(topup.amount), p_type: "topup",
        p_ref_type: "topup", p_ref_id: topup.id, p_note: "เติมเงินผ่าน Omise (PromptPay)", p_actor: null,
      });
      // เงินเข้าที่ Omise แล้วแต่เครดิตไม่เข้า = ต้องให้ Omise ยิงซ้ำ ห้ามตอบ processed
      // (เดิมทิ้ง error แล้วตอบ 200 -> Omise ไม่ retry -> ลูกค้าจ่ายแล้วไม่ได้อะไร ไม่มีใครรู้)
      if (creditErr) {
        // เครดิตเข้าไปแล้วจากอีกเส้น (ชนตาข่าย wallet_tx_topup_once) = สำเร็จจริง ห้ามคืนสถานะ
        // ไม่งั้นแถวเด้งกลับเข้าคิวแอดมิน แล้วกดยืนยันก็ชนกฎเดิมซ้ำจนค้างตลอดไป
        if (creditErr.code === "23505") {
          await svc.rpc("apply_plan_purchase", { p_topup_id: topup.id });
          return done("processed", "already credited");
        }
        // คืนสถานะก่อน ไม่งั้นทั้งสองทางกู้ตัน:
        //  · Omise ยิงซ้ำ -> .neq("status","paid") ไม่คืนแถว -> ข้ามการเครดิตตลอดไป
        //  · แอดมินกดยืนยัน -> admin_confirm_topup ปฏิเสธแถวที่เป็น paid
        await svc.from("topups").update({
          status: "verifying", verified_by: null, paid_at: null,
          error: `credit_wallet: ${creditErr.message}`.slice(0, 300),
        }).eq("id", topup.id);
        const { notifyPlatformAdmins } = await import("@/lib/notify");
        await notifyPlatformAdmins(svc, {
          title: "ด่วน: จ่ายผ่าน Omise สำเร็จแต่เครดิตไม่เข้า",
          body: `รายการ ${topup.id} — ${creditErr.message.slice(0, 120)} · คืนสถานะให้กดยืนยันมือได้แล้ว`,
          url: "/dashboard/admin/billing", tag: `credit-fail:${topup.id}`,
        });
        // เขียนเฉพาะเมื่อมีแถวจริง — `id=eq.` บนคอลัมน์ uuid ทำให้ PostgREST คืน 400 แล้วเงียบไปเฉย ๆ
        if (evt?.id) {
          await svc.from("webhook_events").update({ status: "failed", error: `credit_wallet: ${creditErr.message}`.slice(0, 300) }).eq("id", evt.id);
        }
        // ตอบ 500 เพื่อให้ Omise ยิงซ้ำจริง ๆ (done() ตอบ 200 เสมอ ซึ่งแปลว่า "รับทราบแล้ว")
        return NextResponse.json({ ok: false }, { status: 500 });
      }
      // ซื้อแพ็กเกจจ่ายตรง -> เปิดแพ็กทันที (idempotent — ข้ามเองถ้าไม่ใช่รายการซื้อแพ็ก)
      const { data: applied, error: applyErr } = await svc.rpc("apply_plan_purchase", { p_topup_id: topup.id });
      const res = applied as { ok?: boolean; error?: string } | null;
      if (applyErr || res?.ok === false) {
        const { notifyPlatformAdmins } = await import("@/lib/notify");
        await notifyPlatformAdmins(svc, {
          title: "ด่วน: จ่ายค่าแพ็กผ่าน Omise แล้วแต่เปิดแพ็กไม่สำเร็จ",
          body: `รายการ ${topup.id} — ${applyErr?.message ?? res?.error ?? "ไม่ทราบสาเหตุ"} · เครดิตเข้าแล้ว ต้องเปิดแพ็กให้มือ`,
          url: "/dashboard/admin/billing", tag: `plan-fail:${topup.id}`,
        });
      }
    }
    return done("processed");
  } catch (e) {
    return done("failed", (e as Error).message);
  }
}
