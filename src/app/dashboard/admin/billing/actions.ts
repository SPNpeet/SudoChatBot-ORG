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

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function confirmTopup(topupId: string, approve: boolean): Promise<ActionResult> {
  try {
    await assertPlatformAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_confirm_topup", { p_topup_id: topupId, p_approve: approve });
    if (error) return { ok: false, error: error.message };
    const result = data as { ok: boolean; message?: string } | null;
    if (result && result.ok === false) return { ok: false, error: result.message ?? "ทำรายการไม่สำเร็จ" };
    revalidatePath("/dashboard/admin/billing");
    return { ok: true };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "ไม่มีสิทธิ์ทำรายการนี้" : `ทำรายการไม่สำเร็จ: ${m.slice(0, 150)}` };
  }
}

export async function savePlatformBilling(formData: FormData): Promise<ActionResult> {
  try {
    await assertPlatformAdmin();
    const svc = createServiceClient();
    const { error } = await svc.from("platform_billing_settings").update({
      promptpay_id: String(formData.get("promptpay_id") ?? "").trim() || null,
      account_name: String(formData.get("account_name") ?? "").trim() || null,
      slip_provider: String(formData.get("slip_provider") ?? "manual"),
      payment_gateway: formData.get("payment_gateway") === "omise" ? "omise" : "promptpay_slip",
      omise_public_key: String(formData.get("omise_public_key") ?? "").trim() || null,
      company_name: String(formData.get("company_name") ?? "").trim() || null,
      company_address: String(formData.get("company_address") ?? "").trim() || null,
      tax_id: String(formData.get("tax_id") ?? "").replace(/[^0-9]/g, "") || null,
      tax_branch: String(formData.get("tax_branch") ?? "").trim() || "สำนักงานใหญ่",
      vat_registered: formData.get("vat_registered") === "on",
      email_from: String(formData.get("email_from") ?? "").trim() || null,
      low_credit_threshold: Math.max(0, Number(formData.get("low_credit_threshold") ?? 50) || 50),
      updated_at: new Date().toISOString(),
    }).eq("id", true);
    if (error) return { ok: false, error: `บันทึกไม่สำเร็จ: ${error.message}` };

    const supabase = await createClient();
    const slipKey = String(formData.get("slip_api_key") ?? "").trim();
    if (slipKey) {
      const { error: e1 } = await supabase.rpc("store_platform_slip_key", { p_key: slipKey });
      if (e1) return { ok: false, error: `บันทึก slip API key ไม่สำเร็จ: ${e1.message}` };
    }
    const omiseKey = String(formData.get("omise_secret_key") ?? "").trim();
    if (omiseKey) {
      const { error: e2 } = await supabase.rpc("store_platform_omise_key", { p_key: omiseKey });
      if (e2) return { ok: false, error: `บันทึก Omise secret key ไม่สำเร็จ: ${e2.message}` };
    }
    const resendKey = String(formData.get("resend_api_key") ?? "").trim();
    if (resendKey) {
      const { error: e3 } = await supabase.rpc("store_platform_resend_key", { p_key: resendKey });
      if (e3) return { ok: false, error: `บันทึก Resend API key ไม่สำเร็จ: ${e3.message}` };
    }
    revalidatePath("/dashboard/admin/billing");
    return { ok: true };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "ไม่มีสิทธิ์ตั้งค่านี้" : `บันทึกไม่สำเร็จ: ${m.slice(0, 150)}` };
  }
}
