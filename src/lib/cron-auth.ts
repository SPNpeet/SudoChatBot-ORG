// ============================================================
//  ด่านสิทธิ์ของงานตามเวลา — ที่เดียวของทั้งระบบ
//
//  ⚠️ ทำไมต้องมี (28 ส.ค. 2569)
//  /api/cron/backup กับ /api/cron/weekly-digest เป็น fail-closed ด้วย CRON_SECRET
//  ซึ่งเป็น env ของ Vercel ที่ยังไม่มีใครตั้ง ผลคือทั้งสองเส้น "ไม่เคยทำงานเลยสักครั้ง"
//  ค้างมาหลายสัปดาห์ และไม่มีอะไรทำให้มันเดินได้นอกจากรอเจ้าของว่าง
//
//  migration 100 เจอบทเรียนเดียวกันแล้วเขียนไว้เองว่า
//  "ทางเดียวที่สำรองได้ ไม่ควรผูกกับสิ่งที่คนต้องไปตั้งเอง"
//  ไฟล์นี้เอาบทเรียนนั้นมาใช้กับอีกสองเส้นที่เหลือ (migration 106)
//
//  ⚠️ ไม่ได้ผ่อนด่านลงแม้แต่นิดเดียว — ยังเป็นความลับร่วมแบบเดิม
//  ยังต้องส่ง Authorization: Bearer <secret> เหมือนเดิม และยัง fail-closed
//  ถ้าไม่มีความลับทั้งสองทาง ต่างกันแค่มีที่เก็บสำรองใน Vault ซึ่งอ่านได้เฉพาะ
//  service_role · env มาก่อนเสมอ ตั้ง CRON_SECRET เมื่อไหร่พฤติกรรมเดิมกลับมาทันที
//
//  ห้ามเปลี่ยนให้ผ่านเมื่อไม่มีความลับ ไม่ว่าจะด้วยเหตุผลใด
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";

/** ตรวจสิทธิ์คำขอของงานตามเวลา — คืน true เมื่อยิงมาพร้อมความลับที่ถูกต้องเท่านั้น */
export async function cronRequestAllowed(request: Request): Promise<boolean> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const sent = header.slice(7).trim();
  if (!sent) return false;

  const fromEnv = process.env.CRON_SECRET?.trim();
  if (fromEnv) return sent === fromEnv;

  // ไม่มี env ค่อยถอยไปอ่านจาก Vault — อ่านไม่ได้ = ปฏิเสธ ไม่ใช่ปล่อยผ่าน
  try {
    const { data } = await createServiceClient().rpc("get_cron_secret");
    const fromDb = typeof data === "string" ? data.trim() : "";
    return fromDb.length > 0 && sent === fromDb;
  } catch {
    return false;
  }
}
