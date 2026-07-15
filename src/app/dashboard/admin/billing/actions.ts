"use server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/shop";
import { revalidatePath } from "next/cache";

async function assertPlatformAdmin() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.rpc("is_platform_admin");
  if (!data) throw new Error("forbidden: platform admin only");
  return { supabase, user };
}

export async function confirmTopup(topupId: string, approve: boolean) {
  await assertPlatformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_confirm_topup", { p_topup_id: topupId, p_approve: approve });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/billing");
  return data;
}

export async function savePlatformBilling(formData: FormData) {
  await assertPlatformAdmin();
  const svc = createServiceClient();
  const { error } = await svc.from("platform_billing_settings").update({
    promptpay_id: String(formData.get("promptpay_id") ?? "").trim() || null,
    account_name: String(formData.get("account_name") ?? "").trim() || null,
    slip_provider: String(formData.get("slip_provider") ?? "manual"),
    updated_at: new Date().toISOString(),
  }).eq("id", true);
  if (error) throw new Error(error.message);
  const slipKey = String(formData.get("slip_api_key") ?? "").trim();
  if (slipKey) {
    const supabase = await createClient();
    await supabase.rpc("store_platform_slip_key", { p_key: slipKey });
  }
  revalidatePath("/dashboard/admin/billing");
}
