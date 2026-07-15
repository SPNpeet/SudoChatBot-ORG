// ============================================================
//  Omise (opn.ooo) — Charges API ฝั่ง server เท่านั้น
//  secret key อยู่ Vault (RPC get_platform_omise_key) · env OMISE_SECRET_KEY เป็น fallback
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";

const OMISE_API = "https://api.omise.co";

export interface OmiseCharge {
  id: string;
  object: string;
  amount: number; // สตางค์
  currency: string;
  status: "pending" | "successful" | "failed" | "expired" | "reversed";
  paid: boolean;
  metadata?: Record<string, string>;
  source?: {
    type: string;
    scannable_code?: { image?: { download_uri?: string } };
  };
  failure_message?: string | null;
}

/** ดึง secret key: Vault ก่อน แล้วค่อย env */
export async function getOmiseSecretKey(svc: SupabaseClient): Promise<string | null> {
  const { data } = await svc.rpc("get_platform_omise_key");
  const key = (typeof data === "string" && data.trim()) ? data.trim() : (process.env.OMISE_SECRET_KEY ?? "").trim();
  return key || null;
}

async function omiseRequest<T>(secretKey: string, path: string, init?: { method?: string; body?: URLSearchParams }): Promise<T> {
  const res = await fetch(`${OMISE_API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      ...(init?.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init?.body,
    cache: "no-store",
  });
  const j = (await res.json()) as T & { object?: string; message?: string; code?: string };
  if (j.object === "error") throw new Error(`Omise: ${j.code ?? ""} ${j.message ?? "unknown error"}`.trim());
  return j;
}

/** สร้าง charge แบบ PromptPay source — ยอดเป็นบาท แปลงเป็นสตางค์ให้ */
export async function createPromptPayCharge(secretKey: string, amountBaht: number, topupId: string, shopId: string): Promise<OmiseCharge> {
  const body = new URLSearchParams({
    amount: String(Math.round(amountBaht * 100)),
    currency: "thb",
    "source[type]": "promptpay",
    "metadata[topup_id]": topupId,
    "metadata[shop_id]": shopId,
  });
  return omiseRequest<OmiseCharge>(secretKey, "/charges", { method: "POST", body });
}

/** ดึง charge จาก API ตรง (source of truth — ใช้ยืนยัน webhook ที่ Omise ไม่มีลายเซ็น) */
export async function retrieveCharge(secretKey: string, chargeId: string): Promise<OmiseCharge> {
  if (!/^chrg_[a-z0-9_]+$/i.test(chargeId)) throw new Error("invalid charge id");
  return omiseRequest<OmiseCharge>(secretKey, `/charges/${chargeId}`);
}
