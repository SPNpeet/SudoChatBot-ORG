// ============================================================
//  ที่มาของคีย์ LINE Login — ที่เดียวของทั้งระบบ
//
//  ⚠️ ทำไมต้องมี (28 ส.ค. 2569)
//  ระบบมีคีย์ LINE Login สองที่โดยไม่ได้ตั้งใจ:
//    · หน้าแอดมิน (การ์ด LINE OA) เก็บ Channel ID + Secret ลง
//      platform_billing_settings และเส้น /api/line/* ใช้ค่านั้นมาตลอด
//    · ส่วนเข้าสู่ระบบด้วย LINE (/api/auth/line/*) กลับไปอ่าน process.env
//      ซึ่งไม่มีใครตั้งใน Vercel
//  ผลคือเจ้าของตั้งคีย์ไปนานแล้วและ LINE OA ใช้งานได้ปกติ
//  แต่ปุ่ม "เข้าสู่ระบบด้วย LINE" ไม่เคยโผล่เลยสักครั้ง
//  และรายงานสถานะก็บอกว่า "รอเจ้าของตั้ง env" ทั้งที่ค่ามีอยู่แล้ว
//
//  บทเรียนเดียวกับ migration 100 และ 106: อย่าผูกทางเดียวกับสิ่งที่คนต้องไปตั้งเอง
//  และอย่าเก็บของอย่างเดียวกันไว้สองที่ เพราะที่หนึ่งจะถูกลืมเสมอ
//
//  env มาก่อนเสมอ — ถ้าวันหนึ่งตั้ง LINE_LOGIN_CHANNEL_* ใน Vercel
//  พฤติกรรมเดิมกลับมาทันทีโดยไม่ต้องแก้อะไร
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";

export interface LineLoginKeys { channelId: string; channelSecret: string }

/** คีย์ที่ใช้ได้จริงตอนนี้ — คืน null เมื่อยังไม่มีทั้งสองทาง */
export async function getLineLoginKeys(): Promise<LineLoginKeys | null> {
  const envId = process.env.LINE_LOGIN_CHANNEL_ID?.trim();
  const envSecret = process.env.LINE_LOGIN_CHANNEL_SECRET?.trim();
  if (envId && envSecret) return { channelId: envId, channelSecret: envSecret };

  try {
    const { data } = await createServiceClient()
      .from("platform_billing_settings")
      .select("line_login_channel_id,line_login_channel_secret")
      .eq("id", true)
      .maybeSingle();
    const id = (data?.line_login_channel_id ?? "").trim();
    const secret = (data?.line_login_channel_secret ?? "").trim();
    if (id && secret) return { channelId: id, channelSecret: secret };
  } catch { /* อ่านไม่ได้ = ถือว่ายังไม่ได้ตั้ง ไม่ใช่ปล่อยผ่าน */ }
  return null;
}
