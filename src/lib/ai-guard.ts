// ============================================================
//  เกราะแพลตฟอร์มก่อนยิง AI — กฎอยู่ที่นี่ที่เดียว
//
//  ⚠️ ทำไมต้องแยกออกมา (ตรวจพบ 4 ส.ค. 2569)
//  ทั้ง 4 ทางเข้าที่เรียก AI เขียนเงื่อนไขเหมือนกันว่า `if (pfOk === false) block`
//  ซึ่ง **fail-open**: ถ้า RPC พัง/ไทม์เอาต์ ค่าที่ได้เป็น null ไม่ใช่ false
//  เงื่อนไขจึงเป็นเท็จ แล้วปล่อยให้ยิง AI ต่อ
//  แปลว่าในจังหวะที่ฐานข้อมูลมีปัญหา "สวิตช์ปิด AI" จะปิดไม่ลง ซึ่งตรงข้ามกับหน้าที่ของมัน
//  — สวิตช์ฉุกเฉินที่ทำงานเฉพาะตอนระบบปกติ ไม่ใช่สวิตช์ฉุกเฉิน
//
//  กติกาโปรเจกต์ (CLAUDE.md ข้อ 8): เพดาน/โควตา/kill switch ต้อง fail-closed เสมอ
//  ตอบไม่ได้ว่า "เปิดอยู่ไหม" = ต้องถือว่าปิด ค่าเสียหายของการหยุดชั่วคราว
//  น้อยกว่าค่าเสียหายของการเผา token ไม่จำกัดตอนที่ตั้งใจจะปิดมันแล้ว
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AiGuardResult {
  ok: boolean;
  /** ข้อความพร้อมแสดงผู้ใช้ (ภาษาคน บอกว่ายังทำอะไรได้บ้าง) */
  error?: string;
}

/**
 * ตรวจเกราะแพลตฟอร์ม (kill switch + เพดานค่า AI ต่อวัน) ก่อนยิง AI ทุกครั้ง
 * @param altText สิ่งที่ผู้ใช้ยังทำได้ระหว่างที่ AI ปิด — ต่างกันตามหน้า
 */
export async function platformAiGuard(svc: SupabaseClient, altText: string): Promise<AiGuardResult> {
  try {
    const { data, error } = await svc.rpc("platform_ai_ok");
    if (error) {
      // ตรวจไม่ได้ = ถือว่าปิด (fail-closed) แต่ต้องแยกข้อความจาก "ปิดโดยตั้งใจ"
      // ไม่งั้นเวลาไล่ปัญหาจะแยกไม่ออกว่าผู้ดูแลปิดเอง หรือระบบตรวจพัง
      console.error("platformAiGuard rpc error", error.message);
      return { ok: false, error: `ตรวจสถานะระบบ AI ไม่สำเร็จ ลองใหม่อีกครั้ง — ${altText}` };
    }
    if (data === false) {
      return { ok: false, error: `ระบบ AI ปิดปรับปรุงชั่วคราวโดยผู้ดูแลแพลตฟอร์ม — ${altText}` };
    }
    // data ต้องเป็น true เท่านั้นถึงผ่าน — ค่าอื่น (null/undefined) ถือว่าตอบไม่ได้
    if (data !== true) {
      return { ok: false, error: `ตรวจสถานะระบบ AI ไม่สำเร็จ ลองใหม่อีกครั้ง — ${altText}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("platformAiGuard threw", (e as Error).message);
    return { ok: false, error: `ตรวจสถานะระบบ AI ไม่สำเร็จ ลองใหม่อีกครั้ง — ${altText}` };
  }
}
