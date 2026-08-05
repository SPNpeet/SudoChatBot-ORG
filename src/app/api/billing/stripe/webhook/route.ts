// ============================================================
//  Stripe webhook — เครดิต wallet เมื่อชำระเงินสำเร็จ
//
//  ต่างจาก Omise ตรงที่ Stripe "เซ็นลายเซ็น" มาให้ → ตรวจลายเซ็นก่อนทุกครั้ง
//  แล้วยังดึง session จาก API ซ้ำอีกชั้น (source of truth) เพราะ payload ที่ส่งมา
//  เป็นภาพ ณ เวลาที่ event เกิด ไม่ใช่สถานะล่าสุด
//
//  ตั้ง endpoint ใน Stripe Dashboard: https://<domain>/api/billing/stripe/webhook
//  event ที่ต้องติ๊ก: checkout.session.completed · checkout.session.async_payment_succeeded
//                     · checkout.session.async_payment_failed · checkout.session.expired
// ============================================================
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripeSecretKey, getStripeWebhookSecret, retrieveCheckoutSession, verifyStripeSignature } from "@/lib/stripe";

/** event ที่แปลว่า "อาจได้เงินแล้ว" — ต้องไปเช็คสถานะจริงจาก API ต่อ */
const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
const DEAD_EVENTS = new Set(["checkout.session.expired", "checkout.session.async_payment_failed"]);

export async function POST(request: Request) {
  // ยังไม่ได้ตั้ง service key -> ตอบ 503 ให้ Stripe retry ภายหลัง (กัน event หายเงียบ)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "server not configured" }, { status: 503 });
  }
  const svc = createServiceClient();

  // ⚠️ ต้องอ่านเป็น text ก่อนเสมอ — request.json() ทำให้ body ดิบหายไป แล้วตรวจลายเซ็นไม่ได้อีกเลย
  const raw = await request.text();

  const whSecret = await getStripeWebhookSecret(svc);
  // fail-closed: ไม่มี signing secret = ไม่รู้ว่าใครยิงมา = ห้ามแตะเงินเด็ดขาด
  // ตอบ 503 (ไม่ใช่ 200) เพื่อให้ Stripe เก็บ event ไว้ retry หลังเจ้าของใส่คีย์แล้ว
  if (!whSecret) {
    await svc.from("webhook_events").insert({
      platform: "stripe", event_type: "unverified", payload: { note: "webhook secret not configured" },
      signature_valid: false, status: "failed", error: "stripe webhook secret not configured",
    });
    return NextResponse.json({ ok: false, error: "webhook secret not configured" }, { status: 503 });
  }

  const sigOk = verifyStripeSignature(raw, request.headers.get("stripe-signature"), whSecret);
  if (!sigOk) {
    // เก็บไว้ให้เห็นว่ามีคนพยายามยิง แต่ห้ามอ่าน payload ไปทำอะไรต่อ
    await svc.from("webhook_events").insert({
      platform: "stripe", event_type: "invalid_signature", payload: {},
      signature_valid: false, status: "failed", error: "signature verification failed",
    });
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let event: { id?: string; type?: string; data?: { object?: { id?: string; object?: string } } } = {};
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  // เก็บ raw event ก่อนเสมอ (zero loss) — ลายเซ็นผ่านแล้วเท่านั้นถึงมาถึงบรรทัดนี้
  const { data: evt } = await svc.from("webhook_events").insert({
    platform: "stripe", event_type: event.type ?? "unknown", payload: event,
    signature_valid: true, status: "received",
  }).select("id").single();

  const done = async (status: string, error?: string) => {
    if (evt) await svc.from("webhook_events").update({ status, error: error ?? null, processed_at: new Date().toISOString() }).eq("id", evt.id);
    return NextResponse.json({ ok: true }); // 200 = รับทราบแล้ว ไม่ต้องส่งซ้ำ
  };

  const obj = event.data?.object;
  const sessionId = obj?.object === "checkout.session" ? obj?.id : undefined;
  if (!sessionId || !(PAID_EVENTS.has(event.type ?? "") || DEAD_EVENTS.has(event.type ?? ""))) return done("skipped");

  if (DEAD_EVENTS.has(event.type ?? "")) {
    // หมดอายุ/จ่ายไม่ผ่าน -> ปิดรายการ (เฉพาะที่ยังไม่ paid — ห้ามล้มรายการที่จ่ายสำเร็จไปแล้ว)
    await svc.from("topups").update({ status: "expired" })
      .eq("charge_id", sessionId).in("status", ["pending", "verifying"]);
    return done("processed", event.type);
  }

  const secretKey = await getStripeSecretKey(svc);
  if (!secretKey) return done("failed", "stripe secret key not configured");

  try {
    // source of truth: ดึง session จาก Stripe ตรง
    const session = await retrieveCheckoutSession(secretKey, sessionId);
    if (session.payment_status !== "paid") {
      // PromptPay สแกนแล้วยังไม่จ่าย = ปล่อยค้างไว้ อย่าเพิ่งปิดรายการ
      // (async_payment_succeeded จะตามมาทีหลัง หรือ expired ถ้าไม่จ่าย)
      return done("processed", `payment_status=${session.payment_status ?? "unknown"}`);
    }

    const { data: topup } = await svc.from("topups").select("id,shop_id,amount,status").eq("charge_id", session.id).single();
    if (!topup) return done("failed", "topup not found for session");
    if (Math.round(Number(topup.amount) * 100) !== Number(session.amount_total ?? 0)) return done("failed", "amount mismatch");
    if ((session.currency ?? "thb").toLowerCase() !== "thb") return done("failed", "currency mismatch");

    // idempotent: อัปเดตเฉพาะแถวที่ยังไม่ paid — ไม่มีแถวคืนมา = เครดิตไปแล้ว
    const { data: updated, error: updErr } = await svc.from("topups")
      .update({ status: "paid", verified_by: "stripe", paid_at: new Date().toISOString(), slip_data: session as unknown as Record<string, unknown> })
      .eq("id", topup.id).neq("status", "paid").select("id");
    // อ่าน error ด้วย: update ที่ล้มเหลวคืน data = null เหมือนกับ "เครดิตไปแล้ว" ทุกประการ
    // ถ้าไม่แยกสองกรณีนี้ ลูกค้าจ่ายเงินแล้วระบบจะเงียบสนิท
    if (updErr) return NextResponse.json({ ok: false }, { status: 500 });

    if (updated && updated.length > 0) {
      const { error: creditErr } = await svc.rpc("credit_wallet", {
        p_shop_id: topup.shop_id, p_amount: Number(topup.amount), p_type: "topup",
        p_ref_type: "topup", p_ref_id: topup.id, p_note: "ชำระผ่าน Stripe", p_actor: null,
      });
      if (creditErr) {
        // เครดิตเข้าไปแล้วจากอีกเส้น (ชนตาข่าย wallet_tx_topup_once) = สำเร็จจริง ห้ามคืนสถานะ
        if (creditErr.code === "23505") {
          await svc.rpc("apply_plan_purchase", { p_topup_id: topup.id });
          return done("processed", "already credited");
        }
        // คืนสถานะก่อน ไม่งั้นทั้งสองทางกู้ตัน (บทเรียนเดียวกับเส้น Omise):
        //  · Stripe ยิงซ้ำ -> .neq("status","paid") ไม่คืนแถว -> ข้ามการเครดิตตลอดไป
        //  · แอดมินกดยืนยัน -> admin_confirm_topup ปฏิเสธแถวที่เป็น paid
        await svc.from("topups").update({
          status: "verifying", verified_by: null, paid_at: null,
          error: `credit_wallet: ${creditErr.message}`.slice(0, 300),
        }).eq("id", topup.id);
        const { notifyPlatformAdmins } = await import("@/lib/notify");
        await notifyPlatformAdmins(svc, {
          title: "ด่วน: จ่ายผ่าน Stripe สำเร็จแต่เครดิตไม่เข้า",
          body: `รายการ ${topup.id} — ${creditErr.message.slice(0, 120)} · คืนสถานะให้กดยืนยันมือได้แล้ว`,
          url: "/dashboard/admin/billing", tag: `credit-fail:${topup.id}`,
        });
        if (evt?.id) {
          await svc.from("webhook_events").update({ status: "failed", error: `credit_wallet: ${creditErr.message}`.slice(0, 300) }).eq("id", evt.id);
        }
        // ตอบ 500 เพื่อให้ Stripe ยิงซ้ำจริง ๆ (Stripe retry แบบ backoff นานถึง 3 วัน)
        return NextResponse.json({ ok: false }, { status: 500 });
      }
      // ซื้อแพ็กเกจจ่ายตรง -> เปิดแพ็กทันที (idempotent — ข้ามเองถ้าไม่ใช่รายการซื้อแพ็ก)
      const { data: applied, error: applyErr } = await svc.rpc("apply_plan_purchase", { p_topup_id: topup.id });
      const res = applied as { ok?: boolean; error?: string } | null;
      if (applyErr || res?.ok === false) {
        const { notifyPlatformAdmins } = await import("@/lib/notify");
        await notifyPlatformAdmins(svc, {
          title: "ด่วน: จ่ายค่าแพ็กผ่าน Stripe แล้วแต่เปิดแพ็กไม่สำเร็จ",
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
