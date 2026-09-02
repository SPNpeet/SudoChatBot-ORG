"use server";
// Server actions ของหน้า "งานอัตโนมัติ" — ทุกตัวผ่าน assertMember ก่อนแตะ service client
// สร้าง/ปิด/ลบได้เฉพาะ owner/admin (workflow สร้างร่างเอกสารได้ พนักงานดูได้แต่ตั้งไม่ได้)
import { assertMember } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { runShopWorkflows, validateConfig, WORKFLOW_MAX_PER_SHOP, type WorkflowKind } from "@/lib/workflows";
import { saveDoc } from "@/app/dashboard/finance/actions";

const MANAGE = ["owner", "admin"];
const UUID_RE = /^[0-9a-f-]{36}$/i;
const PATH = "/dashboard/assistant/workflows";

export async function createWorkflow(shopId: string, kind: WorkflowKind, name: string, config: Record<string, unknown>) {
  try {
    const { user } = await assertMember(shopId, MANAGE);
    const v = validateConfig(kind, config ?? {});
    if (!v.ok) return { ok: false as const, error: v.error };
    const cleanName = name.replace(/\s+/g, " ").trim().slice(0, 120);
    if (!cleanName) return { ok: false as const, error: "ตั้งชื่องานก่อน" };
    const svc = createServiceClient();
    const { count } = await svc.from("ai_workflows").select("id", { count: "exact", head: true }).eq("shop_id", shopId);
    if ((count ?? 0) >= WORKFLOW_MAX_PER_SHOP) return { ok: false as const, error: `ตั้งได้สูงสุด ${WORKFLOW_MAX_PER_SHOP} งาน — ลบงานที่ไม่ใช้ก่อน` };
    const { data, error } = await svc.from("ai_workflows")
      .insert({ shop_id: shopId, kind, name: cleanName, config: v.config, source: "user", created_by: user.id })
      .select("id").single();
    if (error || !data) return { ok: false as const, error: "บันทึกไม่สำเร็จ" };
    revalidatePath(PATH);
    return { ok: true as const, id: data.id as string };
  } catch {
    return { ok: false as const, error: "ไม่มีสิทธิ์ (เฉพาะเจ้าของ/ผู้ดูแล) หรือเชื่อมต่อไม่สำเร็จ" };
  }
}

export async function setWorkflowActive(shopId: string, id: string, active: boolean) {
  try {
    await assertMember(shopId, MANAGE);
    if (!UUID_RE.test(id)) return { ok: false as const, error: "รายการไม่ถูกต้อง" };
    const svc = createServiceClient();
    const { error } = await svc.from("ai_workflows").update({ active, updated_at: new Date().toISOString() }).eq("id", id).eq("shop_id", shopId);
    if (error) return { ok: false as const, error: "บันทึกไม่สำเร็จ" };
    revalidatePath(PATH);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "ไม่มีสิทธิ์ (เฉพาะเจ้าของ/ผู้ดูแล) หรือเชื่อมต่อไม่สำเร็จ" };
  }
}

export async function deleteWorkflow(shopId: string, id: string) {
  try {
    await assertMember(shopId, MANAGE);
    if (!UUID_RE.test(id)) return { ok: false as const, error: "รายการไม่ถูกต้อง" };
    const svc = createServiceClient();
    const { error } = await svc.from("ai_workflows").delete().eq("id", id).eq("shop_id", shopId);
    if (error) return { ok: false as const, error: "ลบไม่สำเร็จ" };
    revalidatePath(PATH);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "ไม่มีสิทธิ์ (เฉพาะเจ้าของ/ผู้ดูแล) หรือเชื่อมต่อไม่สำเร็จ" };
  }
}

/** รันทุกงานที่เปิดอยู่เดี๋ยวนี้ (ข้ามคูลดาวน์) — มี session จึงสร้างร่างเอกสารได้ */
export async function runWorkflowsNow(shopId: string) {
  try {
    await assertMember(shopId, MANAGE);
    const svc = createServiceClient();
    const r = await runShopWorkflows(svc, shopId, { force: true, createDoc: (input) => saveDoc(shopId, input) });
    revalidatePath(PATH);
    revalidatePath("/dashboard");
    return { ok: true as const, ran: r.ran, results: r.results };
  } catch {
    return { ok: false as const, error: "ไม่มีสิทธิ์ (เฉพาะเจ้าของ/ผู้ดูแล) หรือเชื่อมต่อไม่สำเร็จ" };
  }
}
