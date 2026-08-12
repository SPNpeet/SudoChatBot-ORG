"use server";
// ============================================================
//  บันทึกผลทดสอบกับผู้ใช้จริง (UAT)
//
//  ทำไมต้องมี: `docs/UAT-PLAN.md` มีโจทย์ 7 ข้อครบมาตั้งแต่ 4 ส.ค. แต่ไม่เคยถูกรัน
//  เพราะมันต้องมีคนนั่งจับเวลาและจดว่าใครติดตรงไหน — งานที่ต้องใช้คนสองคนต่อรอบ
//  หน้านี้ทำให้เหลือคนเดียว: ยื่นมือถือให้ผู้ทดสอบ แล้วระบบจับเวลา/บันทึกเอง
//
//  ⚠️ ห้ามเก็บชื่อ/อีเมลผู้ทดสอบ — เก็บแค่ตัวอักษร A/B/C ตามกติกาใน UAT-PLAN.md
//     (repo เป็น public และ audit_logs เปิดดูได้จากหน้าแอดมิน)
//
//  ใช้ตาราง audit_logs เดิม ไม่สร้างตารางใหม่ — หลักเดียวกับ src/lib/track.ts
// ============================================================
import { assertMember } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";

export type UatOutcome = "done" | "gave_up" | "helped";

export interface UatResult { ok: boolean; error?: string }

/** ผู้ทดสอบทำโจทย์ข้อหนึ่งจบ (หรือยอมแพ้) — บันทึกพร้อมเวลาที่ใช้ */
export async function logUatTask(
  shopId: string,
  input: { tester: string; taskNo: number; taskTitle: string; outcome: UatOutcome; seconds: number; note?: string },
): Promise<UatResult> {
  try {
    // เจ้าของ/แอดมินเท่านั้นที่จัดการทดสอบได้ — ไม่ใช่ให้ใครก็ยิงข้อมูลเข้ามาได้
    await assertMember(shopId, ["owner", "admin"]);

    // กันข้อมูลขยะและกัน PII หลุดเข้ามาทางช่องหมายเหตุ
    const tester = /^[A-Z]$/.test(input.tester) ? input.tester : "?";
    const seconds = Math.max(0, Math.min(3600, Math.round(input.seconds)));
    const note = (input.note ?? "").trim().slice(0, 300);

    const svc = createServiceClient();
    await svc.from("audit_logs").insert({
      shop_id: shopId,
      actor_type: "system",
      action: "uat_task",
      resource_type: "uat",
      details: {
        tester, task_no: input.taskNo, task: input.taskTitle,
        outcome: input.outcome, seconds, note: note || null,
      },
    });
    return { ok: true };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "เฉพาะเจ้าของ/ผู้ดูแลจัดการทดสอบได้" : m.slice(0, 150) };
  }
}
