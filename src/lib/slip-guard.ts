import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
//  เพดานตรวจสลิประดับแพลตฟอร์ม — คู่แฝดของ ai-guard.ts ฝั่งสลิป
//
//  ทำไมต้องมีทั้งที่มีโควตารายร้านแล้ว (check_slip_quota):
//  โควตารายร้านคุม "ความยุติธรรมระหว่างร้าน" แต่ไม่ได้คุม "เงินของเรา"
//  คีย์ตรวจสลิปเป็นคีย์กลางใบเดียวที่ทุกร้านใช้ร่วมกัน — แพ็กฟรี SlipOK = 100 ครั้ง/เดือน
//  ถ้าไม่มีเพดานกลาง ร้านฟรีไม่กี่ร้านก็ใช้หมดโควตาของร้านที่จ่ายเงินได้
//  (ช่องโหว่คลาสเดียวกับที่เคยเจอฝั่ง AI ก่อนมี ai_daily_cap_usd)
//
//  กติกาเดียวกับ ai-guard:
//  · fail-closed — RPC พัง/คืน null = ไม่ผ่าน ห้ามปล่อยไปยิง API
//  · ตัดโควตาก่อนยิงจริง (atomic ใน RPC) กันสองคำขอพร้อมกันทะลุเพดาน
//  · ต้องเรียก "หลัง" ด่านที่ปฏิเสธเฉย ๆ (โควตาร้าน/ร้านถูกระงับ) เสมอ
//    ไม่งั้นคำขอที่จะโดนปฏิเสธอยู่แล้วจะกินโควตากลางไปฟรี ๆ
// ============================================================

export type SlipGuardResult = { ok: true } | { ok: false; error: string };

/** ข้อความกลางเมื่อตรวจอัตโนมัติใช้ไม่ได้ — ผู้ใช้ต้องมีทางไปต่อเสมอ ไม่ใช่ทางตัน */
const FALLBACK_MSG = "ระบบตรวจสลิปอัตโนมัติเต็มโควตาของเดือนนี้แล้ว — ส่งสลิปให้ยืนยันโดยตรงได้เลย";

/**
 * ตรวจ+ตัดโควตาตรวจสลิปของแพลตฟอร์ม 1 ครั้ง
 * เรียกก่อนยิง API ผู้ให้บริการทุกครั้ง (นับทุกคำขอ ไม่ใช่เฉพาะที่ผ่าน
 * เพราะผู้ให้บริการก็นับแบบนั้น)
 */
export async function consumePlatformSlip(svc: SupabaseClient): Promise<SlipGuardResult> {
  try {
    const { data, error } = await svc.rpc("consume_platform_slip");
    if (error) {
      console.error("consumePlatformSlip rpc error", error.message);
      return { ok: false, error: "ระบบตรวจสลิปอัตโนมัติไม่พร้อมชั่วคราว — ส่งสลิปให้ยืนยันโดยตรงได้เลย" };
    }
    const r = data as { allowed?: boolean; used?: number; cap?: number } | null;
    if (r?.allowed !== true) return { ok: false, error: FALLBACK_MSG };
    return { ok: true };
  } catch (e) {
    console.error("consumePlatformSlip threw", (e as Error).message);
    return { ok: false, error: "ระบบตรวจสลิปอัตโนมัติไม่พร้อมชั่วคราว — ส่งสลิปให้ยืนยันโดยตรงได้เลย" };
  }
}
