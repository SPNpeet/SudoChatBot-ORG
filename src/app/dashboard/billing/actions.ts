"use server";
// ============================================================
//  Billing — ซื้อ/ต่ออายุแพ็กเกจ, เติมเครดิต (ผ่าน Stripe เท่านั้น)
//
//  5 ส.ค. 2569 ตัดช่องทางเดิมทิ้งทั้งหมด (PromptPay+อัปสลิป และ Omise)
//  เหตุผล: สองเส้นนั้นต้องมีคนตรวจสลิป ซึ่งแปลว่าลูกค้าจ่ายเงินแล้วยังต้อง "รอ"
//  และเปิดช่องให้สลิปปลอมเข้ามาได้ · ตอนตัดมีรายการทั้งหมด 7 ใบ เป็น rejected/expired
//  ทั้งหมด ไม่มีใครค้างจ่ายอยู่และไม่เคยมีใครจ่ายผ่านเส้นนั้นสำเร็จเลย จึงไม่มีเงินใครค้าง
//
//  ทุก action คืน { ok } เสมอ — ห้าม throw ให้หลุดถึง client
//  (Next.js production ซ่อนข้อความ throw จาก Server Action เป็น
//  "Server Components render error" ที่ผู้ใช้อ่านไม่รู้เรื่อง)
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { revalidatePath } from "next/cache";

export type TopupResult =
  | { ok: true; topupId: string; amount: number; checkoutUrl: string }
  | { ok: false; error: string };
export type PlanResult = { ok: true } | { ok: false; error: string };

/**
 * สร้างรายการชำระเงินผ่าน Stripe Checkout — คืน URL ให้เบราว์เซอร์พาไปหน้าจ่ายของ Stripe
 *
 * ⚠️ ไม่มีที่ไหนในเส้นนี้ที่เครดิตเงิน — การกลับมาที่ success_url ไม่ใช่หลักฐานว่าจ่ายแล้ว
 * (ผู้ใช้พิมพ์ URL นั้นเองก็ได้) เงินเข้าเมื่อ webhook ที่ตรวจลายเซ็นแล้วเท่านั้น
 */
async function createStripeCheckout(
  shopId: string, amount: number, productName: string,
  plan?: { code: string; period: "monthly" | "yearly" },
): Promise<TopupResult> {
  const svc = createServiceClient();
  const { getStripeSecretKey, createCheckoutSession } = await import("@/lib/stripe");
  const secretKey = await getStripeSecretKey(svc);
  if (!secretKey) return { ok: false, error: "ระบบรับชำระเงินยังไม่เปิด — ติดต่อผู้ดูแลระบบ" };

  const { data: topup, error } = await svc.from("topups").insert({
    shop_id: shopId, amount, method: "stripe", gateway: "stripe", status: "pending",
    ...(plan ? { plan_code: plan.code, plan_period: plan.period } : {}),
  }).select("id").single();
  if (error) return { ok: false, error: error.message };

  try {
    const { APP_ORIGIN } = await import("@/lib/app-origin");
    const session = await createCheckoutSession(secretKey, {
      amountBaht: amount, productName, topupId: topup.id, shopId,
      // กลับมาที่หน้าเดิมพร้อมรหัสรายการ — หน้าเว็บจะ poll สถานะจริงจากฐานข้อมูลต่อ
      successUrl: `${APP_ORIGIN}/dashboard/billing?paid=${topup.id}`,
      cancelUrl: `${APP_ORIGIN}/dashboard/billing?canceled=${topup.id}`,
      expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 ชม. (Stripe บังคับอย่างน้อย 30 นาที)
    });
    if (!session.url) throw new Error("stripe ไม่ได้คืนลิงก์ชำระเงิน");
    // charge_id มี unique index อยู่แล้ว — ใช้ผูก session กับรายการ ห้ามมีสองรายการต่อ session เดียว
    const { error: linkErr } = await svc.from("topups").update({ charge_id: session.id }).eq("id", topup.id);
    // ผูกไม่ติด = webhook หา topup ไม่เจอ = ลูกค้าจ่ายแล้วเงินค้าง ต้องหยุดตั้งแต่ตรงนี้
    if (linkErr) {
      await svc.from("topups").update({ status: "expired", error: `link session: ${linkErr.message}`.slice(0, 300) }).eq("id", topup.id);
      return { ok: false, error: "สร้างรายการชำระเงินไม่สำเร็จ — ลองใหม่อีกครั้ง" };
    }
    revalidatePath("/dashboard/billing");
    return { ok: true, topupId: topup.id, amount, checkoutUrl: session.url };
  } catch (e) {
    await svc.from("topups").update({ status: "expired" }).eq("id", topup.id);
    return { ok: false, error: `สร้างรายการชำระเงินไม่สำเร็จ: ${(e as Error).message.slice(0, 150)}` };
  }
}

/** เติมเครดิตล่วงหน้า (ไม่บังคับ — ไว้ให้ระบบต่ออายุแพ็กอัตโนมัติ) */
export async function createTopup(shopId: string, amount: number): Promise<TopupResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    if (amount < 20) return { ok: false, error: "ขั้นต่ำ 20 บาท" };
    return await createStripeCheckout(shopId, amount, `เติมเครดิต ${amount.toLocaleString("th-TH")} บาท`);
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "เฉพาะเจ้าของ/ผู้ดูแลร้านเติมเงินได้" : `เติมเงินไม่สำเร็จ: ${m.slice(0, 150)}` };
  }
}

/** เช็กสถานะรายการ (ใช้ poll ฝั่ง client หลังกลับมาจากหน้าจ่ายของ Stripe) */
export async function getTopupStatus(shopId: string, topupId: string) {
  await assertMember(shopId, ["owner", "admin", "agent", "viewer"]);
  const svc = createServiceClient();
  const { data } = await svc.from("topups").select("status").eq("id", topupId).eq("shop_id", shopId).single();
  return data?.status ?? "unknown";
}

/** ซื้อ/ต่ออายุแพ็กเกจแบบจ่ายตรง — จ่ายเสร็จระบบเปิดแพ็ก + ตั้งรอบบิลถัดไปให้ทันที
 *  period "yearly" = จ่าย 10 เดือน ใช้ 12 เดือน — ยอดคำนวณฝั่ง server เท่านั้น ห้ามรับจาก client */
export async function purchasePlan(shopId: string, planCode: string, period: "monthly" | "yearly" = "monthly"): Promise<TopupResult> {
  try {
    await assertMember(shopId, ["owner"]);
    if (period !== "monthly" && period !== "yearly") return { ok: false, error: "งวดชำระไม่ถูกต้อง" };
    const svc = createServiceClient();
    const { data: plan } = await svc.from("plans").select("code,name,price_monthly").eq("code", planCode).eq("active", true).maybeSingle();
    if (!plan || Number(plan.price_monthly) <= 0) return { ok: false, error: "แพ็กเกจนี้ไม่เปิดให้ชำระตรง" };
    const amount = Number(plan.price_monthly) * (period === "yearly" ? 10 : 1);
    const label = period === "yearly" ? `แพ็กเกจ ${plan.name} รายปี (ใช้ได้ 12 เดือน)` : `แพ็กเกจ ${plan.name} รายเดือน`;
    return await createStripeCheckout(shopId, amount, label, { code: plan.code, period });
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "เฉพาะเจ้าของกิจการสมัครแพ็กเกจได้" : `สมัครแพ็กเกจไม่สำเร็จ: ${m.slice(0, 150)}` };
  }
}

/**
 * เปลี่ยนแพ็กเกจ — **ใช้ได้เฉพาะการย้ายไปแพ็กที่ราคา 0 เท่านั้น**
 *
 * ⚠️ ช่องโหว่ที่ปิด (พบจากการตรวจซ้ำ 5 ส.ค. 2569): เดิม action นี้รับ planCode จาก client
 * แล้ว update shops.plan ตรง ๆ โดยไม่ตรวจราคาเลย หน้าเว็บเรียกเฉพาะปุ่ม "ใช้แพ็กฟรี" ก็จริง
 * แต่ Server Action คือ endpoint สาธารณะ — เจ้าของกิจการยิง changePlan(shopId,"agency") เองได้
 * ได้แพ็ก 999฿ ฟรีจนกว่ารอบบิลจะไล่ลง (~37 วัน) แล้ววนซ้ำได้ไม่จำกัด
 *
 * กติกาข้อ 3 ของโปรเจกต์: "ถ้าต้องการให้หยุด ให้เขียน break อย่าเขียน prompt ขอ" —
 * ข้อห้ามต้องอยู่ที่ server ไม่ใช่ที่เงื่อนไข JSX
 * การอัปเกรดแพ็กเสียเงินมีทางเดียวคือ purchasePlan (จ่ายจริง) -> apply_plan_purchase
 */
export async function changePlan(shopId: string, planCode: string): Promise<PlanResult> {
  try {
    await assertMember(shopId, ["owner"]);
    const svcCheck = createServiceClient();
    const { data: target, error: planErr } = await svcCheck.from("plans")
      .select("code,price_monthly,active").eq("code", planCode).maybeSingle();
    // fail-closed: อ่านราคาไม่ได้ = ไม่ให้เปลี่ยน (ห้ามเดาว่าเป็นแพ็กฟรี)
    if (planErr || !target || target.active !== true) return { ok: false, error: "ไม่พบแพ็กเกจนี้" };
    if (Number(target.price_monthly) > 0) {
      return { ok: false, error: "แพ็กเกจนี้ต้องชำระเงินก่อน — กดปุ่มสมัครเพื่อไปหน้าชำระเงิน" };
    }
    // ต้องใช้ service client: role `authenticated` ไม่มีสิทธิ์ UPDATE คอลัมน์ `plan` ที่ระดับ Postgres
    // (วัดจริง 5 ส.ค. 2569: has_column_privilege(authenticated, shops.plan, UPDATE) = false)
    // เดิมใช้ client ของผู้ใช้ -> ปุ่ม "ใช้แพ็กฟรี" พังมาตลอดและโชว์ error อังกฤษดิบให้ผู้ใช้
    // ปลอดภัยเพราะด่านอยู่ครบก่อนถึงบรรทัดนี้แล้ว: assertMember(owner) + ตรวจว่าแพ็กราคา 0 เท่านั้น
    const svc = createServiceClient();
    const { error } = await svc.from("shops")
      .update({ plan: planCode, plan_since: new Date().toISOString().slice(0, 10) }).eq("id", shopId);
    if (error) return { ok: false, error: "เปลี่ยนแพ็กเกจไม่สำเร็จ — ลองใหม่อีกครั้ง" };
    await svc.from("audit_logs").insert({ shop_id: shopId, actor_type: "user", action: "plan_changed", resource_type: "shops", resource_id: shopId, details: { plan: planCode } });
    revalidatePath("/dashboard/billing");
    return { ok: true };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "เฉพาะเจ้าของร้านเปลี่ยนแพ็กเกจได้" : `เปลี่ยนแพ็กเกจไม่สำเร็จ: ${m.slice(0, 150)}` };
  }
}
