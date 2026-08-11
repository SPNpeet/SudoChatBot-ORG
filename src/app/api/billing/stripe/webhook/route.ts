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

  const sigHeader = request.headers.get("stripe-signature");
  const sigOk = verifyStripeSignature(raw, sigHeader, whSecret);
  if (!sigOk) {
    // เก็บไว้ให้เห็นว่ามีคนพยายามยิง แต่ห้ามอ่าน payload ไปทำอะไรต่อ
    //
    // ⚠️ บันทึก "เพราะอะไร" ด้วย (เพิ่ม 11 ส.ค. 2569): เดิมเขียนแค่ว่าลายเซ็นไม่ผ่าน
    // ซึ่งแยกไม่ออกเลยระหว่าง 2 กรณีที่ต้องทำคนละอย่างสุดขั้ว
    //   · ไม่มี header เลย = บอตสแกนอินเทอร์เน็ตยิงมั่ว -> ไม่ต้องทำอะไร
    //   · มี header แต่ไม่ผ่าน = คีย์ whsec ที่เราเก็บไม่ตรงกับ endpoint จริงของ Stripe
    //     (มักเกิดตอนสลับ test/live หรือสร้าง endpoint ใหม่แล้วลืมอัปคีย์)
    //     = เงินลูกค้าจะเข้า Stripe แต่ระบบเราปฏิเสธทุก event -> ต้องรีบแก้
    // ห้ามเก็บตัวลายเซ็น เก็บแค่โครงสร้างพอให้วินิจฉัยได้
    const hasHeader = !!sigHeader;
    const ts = hasHeader ? /(^|,)t=(\d+)/.exec(sigHeader!)?.[2] : undefined;
    const skewSec = ts ? Math.floor(Date.now() / 1000) - Number(ts) : null;
    await svc.from("webhook_events").insert({
      platform: "stripe", event_type: "invalid_signature",
      payload: { has_signature_header: hasHeader, skew_sec: skewSec, body_bytes: raw.length },
      signature_valid: false, status: "failed",
      error: hasHeader
        ? `signature mismatch (คีย์ whsec ไม่ตรงกับ endpoint นี้ หรือเวลาเพี้ยน ${skewSec ?? "?"} วินาที)`
        : "no stripe-signature header (น่าจะเป็นบอตสแกน ไม่ใช่ Stripe)",
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

  /**
   * ล้มเหลวแบบ "ลองใหม่แล้วอาจสำเร็จ" — ต้องตอบ 5xx เท่านั้น
   *
   * ⚠️ บทเรียน (พบตอนตรวจ 11 ส.ค. 2569): เดิมทุกทางที่ล้มเหลวเรียก done() ซึ่งตอบ 200
   * Stripe เห็น 200 = ถือว่าส่งสำเร็จ แล้ว **ไม่ยิงซ้ำอีกเลยตลอดกาล**
   * แปลว่าถ้า Stripe API ล่มชั่วคราวตอนเราดึง session มายืนยัน (หรือฐานข้อมูลสะดุด)
   * ลูกค้าจ่ายเงินจริงแล้วแต่เครดิตไม่เข้า และไม่มีใครรู้ เพราะระบบตอบว่า ok
   * ตอบ 5xx แทน = Stripe ยิงซ้ำแบบ backoff นานถึง 3 วัน ซึ่งพอให้เหตุชั่วคราวหายไปเอง
   */
  const retryLater = async (error: string, code = 500) => {
    if (evt) await svc.from("webhook_events").update({ status: "failed", error: error.slice(0, 300) }).eq("id", evt.id);
    return NextResponse.json({ ok: false, error }, { status: code });
  };

  /** ล้มเหลวแบบ "ยิงซ้ำก็ได้ผลเดิม" แต่เป็นเรื่องเงิน — ต้องมีคนมาดู ห้ามเงียบ */
  const alertAdmins = async (title: string, body: string, tag: string) => {
    const { notifyPlatformAdmins } = await import("@/lib/notify");
    await notifyPlatformAdmins(svc, { title, body, url: "/dashboard/admin/billing", tag });
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
  // ไม่มีคีย์ = ยืนยันกับ Stripe ไม่ได้ แต่เงินอาจเข้าไปแล้ว -> ให้ยิงซ้ำหลังเจ้าของใส่คีย์
  // (เส้น webhook secret ด้านบนตอบ 503 อยู่แล้ว ตรงนี้ต้องเหมือนกัน ไม่งั้น event หายถาวร)
  if (!secretKey) return retryLater("stripe secret key not configured", 503);

  try {
    // source of truth: ดึง session จาก Stripe ตรง
    const session = await retrieveCheckoutSession(secretKey, sessionId);
    if (session.payment_status !== "paid") {
      // PromptPay สแกนแล้วยังไม่จ่าย = ปล่อยค้างไว้ อย่าเพิ่งปิดรายการ
      // (async_payment_succeeded จะตามมาทีหลัง หรือ expired ถ้าไม่จ่าย)
      return done("processed", `payment_status=${session.payment_status ?? "unknown"}`);
    }

    const { data: topup, error: topupErr } = await svc.from("topups").select("id,shop_id,amount,status").eq("charge_id", session.id).single();
    // หาไม่เจออาจเป็นเรื่องชั่วคราว (ฐานข้อมูลสะดุด / webhook มาถึงก่อนแถวถูกผูก session)
    // เงินเข้า Stripe แล้วแน่นอน ณ จุดนี้ -> ห้ามตอบ 200 ทิ้ง ให้ยิงซ้ำ + เรียกคนมาดู
    if (!topup) {
      await alertAdmins(
        "ด่วน: มีเงินเข้า Stripe แต่หารายการในระบบไม่เจอ",
        `session ${session.id} — ${topupErr?.message ?? "ไม่พบแถว topup"} · ตรวจที่ Stripe Dashboard แล้วเปิดแพ็ก/เครดิตให้มือ`,
        `topup-missing:${session.id}`,
      );
      return retryLater(`topup not found for session: ${topupErr?.message ?? "no row"}`);
    }
    // ยอด/สกุลไม่ตรง = ยิงซ้ำก็ได้ผลเดิม แต่ลูกค้าจ่ายเงินไปแล้วและจะไม่ได้อะไรกลับ
    // เดิมตอบ 200 เงียบ ๆ ไม่มีใครรู้ว่ามีเงินค้าง -> ต้องปลุกแอดมินเสมอ
    if (Math.round(Number(topup.amount) * 100) !== Number(session.amount_total ?? 0)) {
      await alertAdmins(
        "ด่วน: ยอดที่จ่ายไม่ตรงกับรายการในระบบ",
        `รายการ ${topup.id} — ระบบ ${topup.amount} บาท / Stripe ${(Number(session.amount_total ?? 0) / 100).toFixed(2)} บาท · ยังไม่เครดิตให้ ต้องตรวจด้วยมือ`,
        `amount-mismatch:${topup.id}`,
      );
      return done("failed", "amount mismatch");
    }
    if ((session.currency ?? "thb").toLowerCase() !== "thb") {
      await alertAdmins(
        "ด่วน: สกุลเงินที่จ่ายไม่ใช่บาท",
        `รายการ ${topup.id} — Stripe ส่งมาเป็น ${session.currency} · ยังไม่เครดิตให้ ต้องตรวจด้วยมือ`,
        `currency-mismatch:${topup.id}`,
      );
      return done("failed", "currency mismatch");
    }

    // idempotent: อัปเดตเฉพาะแถวที่ยังไม่ paid — ไม่มีแถวคืนมา = เครดิตไปแล้ว
    const { data: updated, error: updErr } = await svc.from("topups")
      .update({ status: "paid", verified_by: "stripe", paid_at: new Date().toISOString(), slip_data: session as unknown as Record<string, unknown> })
      .eq("id", topup.id).neq("status", "paid").select("id");
    // อ่าน error ด้วย: update ที่ล้มเหลวคืน data = null เหมือนกับ "เครดิตไปแล้ว" ทุกประการ
    // ถ้าไม่แยกสองกรณีนี้ ลูกค้าจ่ายเงินแล้วระบบจะเงียบสนิท
    if (updErr) return retryLater(`mark paid: ${updErr.message}`);

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
        await alertAdmins(
          "ด่วน: จ่ายผ่าน Stripe สำเร็จแต่เครดิตไม่เข้า",
          `รายการ ${topup.id} — ${creditErr.message.slice(0, 120)} · คืนสถานะให้กดยืนยันมือได้แล้ว`,
          `credit-fail:${topup.id}`,
        );
        // ตอบ 500 เพื่อให้ Stripe ยิงซ้ำจริง ๆ (Stripe retry แบบ backoff นานถึง 3 วัน)
        return retryLater(`credit_wallet: ${creditErr.message}`);
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
    // ⚠️ ห้ามเปลี่ยนกลับเป็น done() (= 200) เด็ดขาด
    // ถึงบรรทัดนี้ได้แปลว่าลายเซ็นผ่านแล้วและ Stripe บอกว่ามีการชำระเงิน
    // ส่วนใหญ่ที่พังตรงนี้คือดึง session จาก Stripe ไม่สำเร็จ (API ล่ม/เน็ตสะดุด/timeout)
    // ซึ่งเป็นเหตุชั่วคราวล้วน ๆ — ตอบ 200 = ทิ้ง event ทิ้งเงินลูกค้าไปเงียบ ๆ
    return retryLater((e as Error).message);
  }
}
