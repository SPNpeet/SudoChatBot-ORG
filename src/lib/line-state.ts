import { createHmac } from "crypto";

/** ลายเซ็นกันปลอม state ของ LINE Login (route file export ฟังก์ชันอื่นไม่ได้ จึงแยกมาไว้ที่นี่) */
export function signState(payload: string): string {
  const secret = process.env.RATE_LIMIT_IP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "sc-fallback";
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
}
