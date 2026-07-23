"use server";
// ============================================================
//  ผู้จัดการร้าน AI — server action
//  · ตรวจสิทธิ์ owner/admin ก่อนเสมอ (agent สั่งแก้ราคา/ตั้งค่าไม่ได้)
//  · โควตา 100 ข้อความ/วัน/ร้าน (แพลตฟอร์มออกค่า AI — purpose 'assistant')
//  · คืน {ok} เสมอ ห้าม throw
// ============================================================
import { assertMember } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { friendlyAiError } from "@/lib/ai-errors";
import { runAssistant, type AssistantCtx } from "./engine";

export interface AssistantTurn { role: "user" | "assistant"; content: string }
export interface AssistantReply {
  ok: boolean;
  text?: string;
  toolCalls?: { name: string; label: string }[];
  error?: string;
}

const MAX_HISTORY = 20;
const MAX_LEN = 2000;
const ASSISTANT_LIMIT_PER_DAY = 100;

export async function assistantReply(shopId: string, history: AssistantTurn[]): Promise<AssistantReply> {
  try {
    const { user } = await assertMember(shopId, ["owner", "admin", "agent"]);
    const svc = createServiceClient();

    const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count } = await svc.from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId).eq("purpose", "assistant").gte("created_at", dayAgo);
    if ((count ?? 0) >= ASSISTANT_LIMIT_PER_DAY) {
      return { ok: false, error: `ครบโควตาผู้ช่วยบัญชี AI วันนี้แล้ว (${ASSISTANT_LIMIT_PER_DAY} ข้อความ/วัน) — พรุ่งนี้คุยต่อได้` };
    }

    const { data: shop } = await svc.from("shops").select("name,status").eq("id", shopId).single();
    if (!shop || shop.status !== "active") return { ok: false, error: "บัญชีธุรกิจถูกระงับการใช้งาน — ติดต่อผู้ดูแลระบบ" };

    const trimmed = history
      .filter((h) => (h.role === "user" || h.role === "assistant") && typeof h.content === "string" && h.content.trim())
      .slice(-MAX_HISTORY)
      .map((h) => ({ role: h.role, content: h.content.slice(0, MAX_LEN) }));
    if (!trimmed.length || trimmed[trimmed.length - 1].role !== "user") {
      return { ok: false, error: "ไม่มีข้อความให้ตอบ" };
    }

    const ctx: AssistantCtx = {
      svc, shopId, shopName: shop.name, userId: user.id, history: trimmed,
    };
    const r = await runAssistant(ctx);
    return { ok: true, text: r.text, toolCalls: r.toolCalls };
  } catch (e) {
    const m = (e as Error).message;
    if (m === "AI_NOT_CONFIGURED") return { ok: false, error: "แพลตฟอร์มยังไม่ได้ตั้งค่า AI — ผู้ดูแลระบบต้องใส่ API key ก่อน" };
    if (m.includes("forbidden")) return { ok: false, error: "สิทธิ์ของคุณใช้ผู้ช่วยบัญชี AI สั่งงานไม่ได้" };
    return { ok: false, error: friendlyAiError(m) };
  }
}
