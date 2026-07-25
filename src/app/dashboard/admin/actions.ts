"use server";
// ============================================================
//  Admin AI Center — Server Actions (platform admin เท่านั้น)
//  key เก็บใน Vault ผ่าน RPC, ทุกการเปลี่ยนแปลงลง audit_logs
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/shop";
import { revalidatePath } from "next/cache";
import type { Provider } from "@/lib/ai-catalog";

async function assertPlatformAdmin() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.rpc("is_platform_admin");
  if (!data) throw new Error("forbidden: platform admin only");
  return { supabase, user };
}

export async function claimAdmin() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("claim_platform_admin");
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
  return data as boolean;
}

/** บันทึก API key ของค่าย (เข้า Vault) — ไม่ log ค่า key */
export async function saveProviderKey(provider: Provider, key: string) {
  // store_ai_key เป็น SECURITY DEFINER ที่เช็ค is_platform_admin() ด้วย auth.uid() ภายใน
  // ต้องเรียกผ่าน user client (มี JWT) ไม่ใช่ service client (auth.uid()=NULL → ถูกปฏิเสธ)
  const { supabase } = await assertPlatformAdmin();
  const trimmed = key.trim();
  if (trimmed.length < 10) throw new Error("API key สั้นเกินไป");
  const { error } = await supabase.rpc("store_ai_key", { p_provider: provider, p_key: trimmed });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
}

export async function deleteProviderKey(provider: Provider) {
  const { user } = await assertPlatformAdmin();
  const svc = createServiceClient();
  const { data: row } = await svc.from("ai_provider_keys").select("secret_id").eq("provider", provider).maybeSingle();
  await svc.from("ai_provider_keys").delete().eq("provider", provider);
  if (row?.secret_id) await svc.from("vault.secrets" as never).delete().eq("id", row.secret_id).then(() => {}, () => {});
  await svc.from("audit_logs").insert({
    actor_type: "user", actor_id: user.id, action: "ai_key_deleted", resource_type: "ai_provider_keys", resource_id: provider,
  });
  revalidatePath("/dashboard/admin");
}

// ---------- คีย์ตามงาน (Function-Centric: ผู้ช่วยบัญชี AI / อ่านบิล OCR) ----------
export type PurposeKeyPurpose = "assistant" | "chat" | "ocr";

/** บันทึกการตั้งค่างาน AI — key เว้นว่างได้ถ้าเคยบันทึกแล้ว (= แก้เฉพาะค่าย/ชื่อโมเดล ไม่ต้องวาง key ซ้ำ) */
export async function savePurposeKey(purpose: PurposeKeyPurpose, provider: Provider, model: string, key: string) {
  const { supabase } = await assertPlatformAdmin();
  const trimmed = key.trim();
  if (trimmed && trimmed.length < 10) throw new Error("API key สั้นเกินไป");
  const { error } = await supabase.rpc("store_purpose_ai_key", {
    p_purpose: purpose, p_provider: provider, p_model: model.trim(), p_key: trimmed || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
}

export async function deletePurposeKey(purpose: PurposeKeyPurpose) {
  const { supabase } = await assertPlatformAdmin();
  const { error } = await supabase.rpc("delete_purpose_ai_key", { p_purpose: purpose });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
}

// ---------- เกราะกันค่า AI รั่ว (เพดานรายวัน + สวิตช์ปิดฉุกเฉิน) ----------
export type AiGuardResult =
  | { ok: true }
  | { ok: false; error: string };

export async function savePlatformAiGuard(capUsd: number | null, kill: boolean): Promise<AiGuardResult> {
  try {
    const { supabase } = await assertPlatformAdmin();
    const cap = capUsd != null && capUsd > 0 ? Math.min(100000, capUsd) : null;
    const { error } = await supabase.rpc("set_platform_ai_guard", { p_cap_usd: cap, p_kill: kill });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message.includes("forbidden") ? "เฉพาะผู้ดูแลแพลตฟอร์ม" : "บันทึกไม่สำเร็จ" };
  }
}

/** ตั้งค่า LINE OA กลางของแพลตฟอร์ม (แอดมินเท่านั้น) — ช่องว่าง = คงค่าเดิม */
export async function savePlatformLine(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertPlatformAdmin();
    const svc = createServiceClient();
    const patch: Record<string, unknown> = { id: true, updated_at: new Date().toISOString() };
    const put = (key: string, field: string, max = 500) => {
      const v = String(formData.get(key) ?? "").trim();
      if (v) patch[field] = v.slice(0, max);
    };
    put("login_channel_id", "line_login_channel_id", 40);
    put("login_channel_secret", "line_login_channel_secret");
    put("oa_token", "line_oa_token", 1000);
    const basic = String(formData.get("oa_basic_id") ?? "").trim();
    patch.line_oa_basic_id = basic ? basic.slice(0, 40) : null;
    const { error } = await svc.from("platform_billing_settings").upsert(patch, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** ประกาศปัญหา/สถานะระบบถึงผู้ใช้ทุกคน — ยิงทั้ง Web Push และ LINE */
export async function broadcastSystemAlert(formData: FormData): Promise<{ ok: true; push: number; line: number } | { ok: false; error: string }> {
  try {
    const { user } = await assertPlatformAdmin();
    const level = String(formData.get("level") ?? "info");
    const title = String(formData.get("title") ?? "").trim().slice(0, 120);
    const body = String(formData.get("body") ?? "").trim().slice(0, 500);
    if (!title) return { ok: false, error: "ใส่หัวข้อก่อน" };
    if (!["info", "warning", "critical"].includes(level)) return { ok: false, error: "ระดับไม่ถูกต้อง" };

    const svc = createServiceClient();
    const { data: alert, error } = await svc.from("system_alerts")
      .insert({ level, title, body: body || null, created_by: user.id, active: true })
      .select("id").single();
    if (error || !alert) return { ok: false, error: error?.message ?? "บันทึกประกาศไม่สำเร็จ" };

    const { notifyEveryone } = await import("@/lib/notify");
    const icon = level === "critical" ? "🚨" : level === "warning" ? "⚠️" : "📢";
    const sent = await notifyEveryone(svc, { title: `${icon} ${title}`, body: body || "", url: "/dashboard", tag: "system-alert" });
    await svc.from("system_alerts").update({ pushed: true }).eq("id", alert.id);

    revalidatePath("/dashboard", "layout");
    return { ok: true, push: sent.push, line: sent.line };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** ปิดประกาศ (แบนเนอร์หายจากหน้าลูกค้า) */
export async function closeSystemAlert(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertPlatformAdmin();
    const svc = createServiceClient();
    const { error } = await svc.from("system_alerts").update({ active: false }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
