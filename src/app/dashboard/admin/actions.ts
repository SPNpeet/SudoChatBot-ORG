"use server";
// ============================================================
//  Admin AI Center — Server Actions (platform admin เท่านั้น)
//  key เก็บใน Vault ผ่าน RPC, ทุกการเปลี่ยนแปลงลง audit_logs
// ============================================================
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

/** เลือกค่าย+โมเดล ต่อระดับคุณภาพ */
export async function saveRouting(formData: FormData) {
  const { user } = await assertPlatformAdmin();
  const svc = createServiceClient();
  const rows: { purpose: string; tier: string; provider: string; model: string; updated_by: string }[] = [];
  for (const tier of ["economy", "standard", "premium"]) {
    const provider = String(formData.get(`chat_${tier}_provider`) ?? "");
    const model = String(formData.get(`chat_${tier}_model`) ?? "");
    if (provider && model) rows.push({ purpose: "chat", tier, provider, model, updated_by: user.id });
  }
  const embProvider = String(formData.get("embed_provider") ?? "");
  const embModel = String(formData.get("embed_model") ?? "");
  if (embProvider && embModel) rows.push({ purpose: "embedding", tier: "default", provider: embProvider, model: embModel, updated_by: user.id });

  for (const r of rows) {
    const { error } = await svc.from("ai_settings").upsert({ ...r, updated_at: new Date().toISOString() }, { onConflict: "purpose,tier" });
    if (error) throw new Error(error.message);
  }
  await svc.from("audit_logs").insert({
    actor_type: "user", actor_id: user.id, action: "ai_routing_updated", resource_type: "ai_settings",
    details: { rows: rows.map((r) => `${r.purpose}/${r.tier}=${r.provider}:${r.model}`) },
  });
  revalidatePath("/dashboard/admin");
}
