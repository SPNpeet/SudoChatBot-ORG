"use server";
// ============================================================
//  Server action บาง ๆ ให้ปุ่มฝั่ง client บันทึกเหตุการณ์การใช้งานได้
//  แยกไฟล์จาก actions.ts เพราะไฟล์นั้นเป็นเส้นทางเงิน/บัญชี — ของที่ไม่เกี่ยวไม่ควรไปปน
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { track, type TrackEvent } from "@/lib/track";

const ALLOWED: TrackEvent[] = ["share_link_copied"];

export async function trackUsage(shopId: string, event: TrackEvent): Promise<void> {
  try {
    // ยืนยันสมาชิกก่อนเสมอ — ไม่งั้นใครก็ยิง event ปลอมเข้ากิจการคนอื่นได้
    // และจำกัด event ที่ยิงจากฝั่ง client ได้เฉพาะรายการที่อนุญาต
    if (!ALLOWED.includes(event)) return;
    const { user } = await assertMember(shopId, ["owner", "admin", "agent", "viewer"]);
    await track(createServiceClient(), shopId, user.id, event);
  } catch {
    // เงียบ — บันทึกไม่ได้ต้องไม่ทำให้ปุ่มคัดลอกลิงก์พัง
  }
}
