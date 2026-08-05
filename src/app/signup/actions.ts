"use server";
// ============================================================
//  สมัครสมาชิกแบบเข้าใช้ได้ทันที — ไม่ต้องรอเมลยืนยัน
//  เหตุผล: SMTP ฟรีของ Supabase ส่งเมลไม่ถึงหลายค่าย (โดยเฉพาะ hotmail)
//  ผู้ใช้สมัครแล้ว "เงียบ" = หายไปเลย — จึงสร้างบัญชีด้วย admin API
//  (email_confirm: true) แล้วให้ฝั่ง client ล็อกอินต่อทันที
// ============================================================
import { headers } from "next/headers";
import { createHmac } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

export interface SignUpResult { ok: boolean; error?: string }

/** HMAC ของ IP — ไม่เก็บ IP ดิบลง DB (PDPA) · IPv6 ตัดเหลือ /64 */
async function ipHash(): Promise<string> {
  const h = await headers();
  const raw = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim().toLowerCase();
  const norm = raw.includes(":") ? raw.split("%")[0].split(":").slice(0, 4).join(":") + "::/64" : raw;
  const secret = process.env.RATE_LIMIT_IP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "sc-fallback";
  return createHmac("sha256", secret).update(norm).digest("hex");
}

export async function signUpDirect(name: string, email: string, password: string): Promise<SignUpResult> {
  const n = String(name ?? "").trim().slice(0, 100);
  const em = String(email ?? "").trim().toLowerCase();
  const pw = String(password ?? "");
  if (!n) return { ok: false, error: "กรอกชื่อของคุณก่อนนะ" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return { ok: false, error: "รูปแบบอีเมลไม่ถูกต้อง" };
  // 8 ให้ตรงกับ Minimum password length ที่ตั้งไว้ใน Supabase Auth (30 ก.ค. 2569)
  // เดิมเช็ค 6 ตรงนี้ แล้วปล่อยไปตกที่เซิร์ฟเวอร์ Auth ซึ่งตอบ error ภาษาอังกฤษ
  if (pw.length < 8) return { ok: false, error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };

  const svc = createServiceClient();

  // กันสมัครรัว/บอทปั๊มบัญชี — 10 ครั้ง/ชม./IP · ระบบนับล่ม = ไม่ปล่อยผ่าน (fail-closed)
  const { data: rate, error: rateErr } = await svc.rpc("consume_public_rate", {
    p_bucket: "signup", p_ip_hash: await ipHash(), p_limit: 10, p_window_secs: 3600,
  });
  if (rateErr) return { ok: false, error: "ระบบไม่พร้อมชั่วคราว ลองใหม่อีกครั้ง" };
  // fail-closed แบบเต็มรูป: ต้องได้ allowed === true เท่านั้น
  // (คืน null/JSON ที่ไม่มีคีย์ allowed โดยไม่มี error = ตัวนับใช้ไม่ได้ ห้ามปล่อยผ่าน)
  if ((rate as { allowed?: boolean } | null)?.allowed !== true) {
    return { ok: false, error: "สมัครถี่เกินไปจากเครือข่ายนี้ — รอสักครู่แล้วลองใหม่ หรือถ้ามีบัญชีแล้วให้กดเข้าสู่ระบบ" };
  }
  const { error } = await svc.auth.admin.createUser({
    email: em, password: pw, email_confirm: true,
    user_metadata: { full_name: n },
  });
  if (error) {
    const m = error.message ?? "";
    if (m.includes("already") || m.includes("registered") || error.code === "email_exists") {
      return { ok: false, error: "อีเมลนี้มีบัญชีอยู่แล้ว — กดเข้าสู่ระบบได้เลย" };
    }
    // เผื่อเกณฑ์ฝั่ง Auth ถูกปรับอีกในอนาคต — แปลเป็นภาษาคน ไม่โชว์ error อังกฤษดิบ
    if (/at least|password.*short|weak/i.test(m)) {
      return { ok: false, error: "รหัสผ่านสั้นหรือเดาง่ายเกินไป — ตั้งอย่างน้อย 8 ตัวอักษร" };
    }
    return { ok: false, error: `สมัครไม่สำเร็จ: ${m.slice(0, 200)}` };
  }
  return { ok: true };
}
