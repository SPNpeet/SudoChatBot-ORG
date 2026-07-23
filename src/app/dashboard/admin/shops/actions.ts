"use server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/shop";
import { revalidatePath } from "next/cache";

async function assertPlatformAdmin() {
  const { supabase } = await requireUser();
  const { data } = await supabase.rpc("is_platform_admin");
  if (!data) throw new Error("forbidden: platform admin only");
}

export type ActionResult = { ok: true } | { ok: false; error: string };

function friendly(e: unknown): string {
  const m = (e as Error).message ?? String(e);
  if (m.includes("forbidden")) return "ไม่มีสิทธิ์ทำรายการนี้";
  return `ทำรายการไม่สำเร็จ: ${m.slice(0, 150)}`;
}

export async function setShopStatus(shopId: string, status: string): Promise<ActionResult> {
  try {
    await assertPlatformAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_set_shop_status", { p_shop_id: shopId, p_status: status });
    if (error) return { ok: false, error: error.message };
    const r = data as { ok: boolean; message?: string } | null;
    if (r && r.ok === false) return { ok: false, error: r.message ?? "ทำรายการไม่สำเร็จ" };
    revalidatePath("/dashboard/admin/shops");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

/** ตั้งเพดานโควตางาน AI/วัน รายกิจการ (override แพ็ก) — null/ว่าง = ใช้ตามแพ็ก */
export async function setShopQuotaOverride(shopId: string, value: number | null): Promise<ActionResult> {
  try {
    await assertPlatformAdmin();
    const svc = createServiceClient();
    const v = value != null && value > 0 ? Math.min(1_000_000, Math.floor(value)) : null;
    const { error } = await svc.from("shops").update({ ai_quota_override: v }).eq("id", shopId);
    if (error) return { ok: false, error: error.message };
    await svc.from("audit_logs").insert({
      shop_id: shopId, actor_type: "user", action: "ai_quota_override_set",
      resource_type: "shops", resource_id: shopId, details: { override: v },
    });
    revalidatePath("/dashboard/admin/shops");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function setShopPlan(shopId: string, plan: string): Promise<ActionResult> {
  try {
    await assertPlatformAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_set_shop_plan", { p_shop_id: shopId, p_plan: plan });
    if (error) return { ok: false, error: error.message };
    const r = data as { ok: boolean; message?: string } | null;
    if (r && r.ok === false) return { ok: false, error: r.message ?? "ทำรายการไม่สำเร็จ" };
    revalidatePath("/dashboard/admin/shops");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}
