"use server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/shop";
import { revalidatePath } from "next/cache";

async function assertPlatformAdmin() {
  const { supabase } = await requireUser();
  const { data } = await supabase.rpc("is_platform_admin");
  if (!data) throw new Error("forbidden: platform admin only");
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function markFeedback(feedbackId: string, status: "resolved" | "dismissed" | "open"): Promise<ActionResult> {
  try {
    await assertPlatformAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_mark_feedback", { p_feedback_id: feedbackId, p_status: status });
    if (error) return { ok: false, error: error.message };
    const r = data as { ok: boolean; message?: string } | null;
    if (r && r.ok === false) return { ok: false, error: r.message ?? "ทำรายการไม่สำเร็จ" };
    revalidatePath("/dashboard/admin/feedback");
    return { ok: true };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "ไม่มีสิทธิ์ทำรายการนี้" : `ทำรายการไม่สำเร็จ: ${m.slice(0, 150)}` };
  }
}
