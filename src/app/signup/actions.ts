"use server";
// ============================================================
//  สมัครสมาชิกแบบเข้าใช้ได้ทันที — ไม่ต้องรอเมลยืนยัน
//  เหตุผล: SMTP ฟรีของ Supabase ส่งเมลไม่ถึงหลายค่าย (โดยเฉพาะ hotmail)
//  ผู้ใช้สมัครแล้ว "เงียบ" = หายไปเลย — จึงสร้างบัญชีด้วย admin API
//  (email_confirm: true) แล้วให้ฝั่ง client ล็อกอินต่อทันที
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";

export interface SignUpResult { ok: boolean; error?: string }

export async function signUpDirect(name: string, email: string, password: string): Promise<SignUpResult> {
  const n = String(name ?? "").trim().slice(0, 100);
  const em = String(email ?? "").trim().toLowerCase();
  const pw = String(password ?? "");
  if (!n) return { ok: false, error: "กรอกชื่อของคุณก่อนนะ" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return { ok: false, error: "รูปแบบอีเมลไม่ถูกต้อง" };
  if (pw.length < 6) return { ok: false, error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" };

  const svc = createServiceClient();
  const { error } = await svc.auth.admin.createUser({
    email: em, password: pw, email_confirm: true,
    user_metadata: { full_name: n },
  });
  if (error) {
    const m = error.message ?? "";
    if (m.includes("already") || m.includes("registered") || error.code === "email_exists") {
      return { ok: false, error: "อีเมลนี้มีบัญชีอยู่แล้ว — กดเข้าสู่ระบบได้เลย" };
    }
    return { ok: false, error: `สมัครไม่สำเร็จ: ${m.slice(0, 200)}` };
  }
  return { ok: true };
}
