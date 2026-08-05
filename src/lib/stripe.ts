// ============================================================
//  Stripe — Checkout Sessions ฝั่ง server เท่านั้น
//
//  ทำไมไม่ลง `stripe` npm: เราต้องการแค่ 3 อย่าง (สร้าง session · ดึง session ·
//  ตรวจลายเซ็น webhook) ซึ่งเป็น REST + HMAC ธรรมดา การลง SDK เพิ่ม ~1MB
//  ลง bundle ของ serverless function ทุกตัว แลกกับสิ่งที่เขียนเองได้ใน 60 บรรทัด
//  (เดิมไฟล์ lib/omise.ts ก็เขียนแบบเดียวกันนี้ ก่อนถูกตัดทิ้งเมื่อ 5 ส.ค. 2569)
//
//  secret key อยู่ Vault (RPC get_platform_stripe_key) · env STRIPE_SECRET_KEY เป็น fallback
// ============================================================
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const STRIPE_API = "https://api.stripe.com";

export interface StripeCheckoutSession {
  id: string;
  object: string;
  url?: string | null;
  amount_total?: number | null;   // สตางค์
  currency?: string | null;
  /** "paid" เท่านั้นที่ถือว่าได้เงินจริง — "unpaid"/"no_payment_required" ห้ามเครดิต */
  payment_status?: "paid" | "unpaid" | "no_payment_required";
  status?: "open" | "complete" | "expired";
  metadata?: Record<string, string>;
  payment_intent?: string | null;
}

/** ดึง secret key: Vault ก่อน แล้วค่อย env */
export async function getStripeSecretKey(svc: SupabaseClient): Promise<string | null> {
  const { data } = await svc.rpc("get_platform_stripe_key");
  const key = (typeof data === "string" && data.trim()) ? data.trim() : (process.env.STRIPE_SECRET_KEY ?? "").trim();
  return key || null;
}

/** ดึง webhook signing secret (whsec_...) — ไม่มี = ห้ามรับ webhook เด็ดขาด */
export async function getStripeWebhookSecret(svc: SupabaseClient): Promise<string | null> {
  const { data } = await svc.rpc("get_platform_stripe_webhook_secret");
  const key = (typeof data === "string" && data.trim()) ? data.trim() : (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  return key || null;
}

async function stripeRequest<T>(
  secretKey: string,
  path: string,
  init?: { method?: string; body?: URLSearchParams; idempotencyKey?: string },
): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(init?.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      // กันสร้างรายการซ้ำเมื่อ network ค้างแล้วผู้ใช้กดใหม่ — Stripe คืน session เดิมให้
      ...(init?.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init?.body,
    cache: "no-store",
  });
  const j = (await res.json()) as T & { error?: { message?: string; code?: string; type?: string } };
  if (j.error) throw new Error(`Stripe: ${j.error.code ?? j.error.type ?? ""} ${j.error.message ?? "unknown error"}`.trim());
  return j;
}

/**
 * สร้าง Checkout Session (โหมด payment) — ยอดเป็นบาท แปลงเป็นสตางค์ให้
 *
 * ⚠️ ไม่ส่ง payment_method_types โดยตั้งใจ: ปล่อยให้ Stripe เลือกตามที่เปิดไว้
 * ใน Dashboard (PromptPay / บัตร) ถ้าฮาร์ดโค้ด "promptpay" แล้วเจ้าของยังไม่ได้
 * เปิดวิธีนั้น Stripe จะปฏิเสธทั้งรายการ = ลูกค้าจ่ายไม่ได้เลยโดยไม่รู้สาเหตุ
 */
export async function createCheckoutSession(secretKey: string, opts: {
  amountBaht: number;
  productName: string;
  topupId: string;
  shopId: string;
  successUrl: string;
  cancelUrl: string;
  expiresAt?: number; // unix seconds — Stripe บังคับอย่างน้อย 30 นาทีจากนี้
}): Promise<StripeCheckoutSession> {
  const body = new URLSearchParams({
    mode: "payment",
    locale: "th",
    "line_items[0][price_data][currency]": "thb",
    "line_items[0][price_data][product_data][name]": opts.productName,
    "line_items[0][price_data][unit_amount]": String(Math.round(opts.amountBaht * 100)),
    "line_items[0][quantity]": "1",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    client_reference_id: opts.topupId,
    "metadata[topup_id]": opts.topupId,
    "metadata[shop_id]": opts.shopId,
    // ติด metadata ที่ payment_intent ด้วย — เวลาไล่เงินจากหน้า Stripe Dashboard
    // จะเห็นว่ารายการไหนของกิจการไหนโดยไม่ต้องเปิดฐานข้อมูลเรา
    "payment_intent_data[metadata][topup_id]": opts.topupId,
    "payment_intent_data[metadata][shop_id]": opts.shopId,
  });
  if (opts.expiresAt) body.set("expires_at", String(opts.expiresAt));
  return stripeRequest<StripeCheckoutSession>(secretKey, "/v1/checkout/sessions", {
    method: "POST", body, idempotencyKey: `topup:${opts.topupId}`,
  });
}

/** ดึง session จาก API ตรง — ใช้เป็น source of truth หลังตรวจลายเซ็นแล้ว */
export async function retrieveCheckoutSession(secretKey: string, sessionId: string): Promise<StripeCheckoutSession> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new Error("invalid session id");
  return stripeRequest<StripeCheckoutSession>(secretKey, `/v1/checkout/sessions/${sessionId}`);
}

/**
 * ตรวจลายเซ็น webhook ของ Stripe ด้วยมือ (ตามเอกสาร "Verify manually")
 *  header: `t=<unix>,v1=<hex>[,v1=<hex> ตอนกำลังหมุนคีย์][,v0=<hex> ของ test]`
 *  signed_payload = `${t}.${rawBody}` · HMAC-SHA256 · กุญแจคือ whsec_...
 *
 * ⚠️ กติกาที่ห้ามแก้:
 *  · รับเฉพาะ scheme v1 — v0 เป็นลายเซ็นปลอมสำหรับ test ถ้ารับด้วยจะโดน downgrade attack
 *  · เทียบแบบ timing-safe เสมอ (ไม่ใช่ ===) ไม่งั้นเดาลายเซ็นทีละไบต์ได้
 *  · ต้องใช้ "body ดิบ" ที่ยังไม่ผ่าน JSON.parse — parse แล้ว stringify ใหม่ลายเซ็นเพี้ยนทันที
 *  · tolerance ห้ามใส่ 0 (= ปิดการตรวจอายุ) ค่าเริ่มต้นของ Stripe คือ 5 นาที
 */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  let t = "";
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t") t = v;
    else if (k === "v1") v1.push(v);
  }
  if (!t || v1.length === 0) return false;

  const ts = Number(t);
  if (!Number.isFinite(ts)) return false;
  // เก่าเกินไป = ปฏิเสธ (กัน replay) · แต่ยอมให้ล้ำหน้าได้เท่ากัน เผื่อนาฬิกาเครื่องเราช้า
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > toleranceSec) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest();
  return v1.some((sig) => {
    if (!/^[0-9a-f]+$/i.test(sig) || sig.length !== expected.length * 2) return false;
    try { return timingSafeEqual(Buffer.from(sig, "hex"), expected); } catch { return false; }
  });
}
