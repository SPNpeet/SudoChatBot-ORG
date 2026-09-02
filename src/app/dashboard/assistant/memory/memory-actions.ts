"use server";
// Server actions ของหน้า "สิ่งที่ผู้ช่วยจำ" — ทุกตัวผ่าน assertMember ก่อนแตะ service client
// เจ้าของ/ผู้ดูแล/พนักงานเห็นและแก้ได้ทั้งหมด (ความจำเป็นของกิจการ ไม่ใช่ของคนใดคนหนึ่ง)
import { assertMember } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { addMemory, sanitizeMemory, type MemoryKind } from "@/lib/business-memory";
import { revalidatePath } from "next/cache";

const ROLES = ["owner", "admin", "agent"];
const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function createMemory(shopId: string, content: string, kind: MemoryKind) {
  try {
    const { user } = await assertMember(shopId, ROLES);
    const svc = createServiceClient();
    const r = await addMemory(svc, shopId, { content, kind, source: "user", userId: user.id });
    if (r.ok) revalidatePath("/dashboard/assistant/memory");
    return r;
  } catch {
    return { ok: false as const, error: "ไม่มีสิทธิ์ หรือเชื่อมต่อไม่สำเร็จ" };
  }
}

export async function updateMemory(shopId: string, id: string, patch: { content?: string; kind?: MemoryKind; active?: boolean }) {
  try {
    await assertMember(shopId, ROLES);
    if (!UUID_RE.test(id)) return { ok: false as const, error: "รายการไม่ถูกต้อง" };
    const svc = createServiceClient();
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.content !== undefined) {
      const c = sanitizeMemory(patch.content);
      if (!c) return { ok: false as const, error: "ข้อความว่าง" };
      row.content = c;
    }
    if (patch.kind) row.kind = patch.kind;
    if (patch.active !== undefined) row.active = patch.active;
    const { error } = await svc.from("business_memories").update(row).eq("id", id).eq("shop_id", shopId);
    if (error) return { ok: false as const, error: "บันทึกไม่สำเร็จ" };
    revalidatePath("/dashboard/assistant/memory");
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "ไม่มีสิทธิ์ หรือเชื่อมต่อไม่สำเร็จ" };
  }
}

export async function deleteMemory(shopId: string, id: string) {
  try {
    await assertMember(shopId, ROLES);
    if (!UUID_RE.test(id)) return { ok: false as const, error: "รายการไม่ถูกต้อง" };
    const svc = createServiceClient();
    const { error } = await svc.from("business_memories").delete().eq("id", id).eq("shop_id", shopId);
    if (error) return { ok: false as const, error: "ลบไม่สำเร็จ" };
    revalidatePath("/dashboard/assistant/memory");
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "ไม่มีสิทธิ์ หรือเชื่อมต่อไม่สำเร็จ" };
  }
}
