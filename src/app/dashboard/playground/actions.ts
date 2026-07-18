"use server";
// ============================================================
//  Playground actions — ทดลองคุยกับบอท (ไม่หักเครดิต ไม่เขียนออเดอร์จริง)
//  กติกาเหล็ก: assertMember ก่อนแตะ service client เสมอ
// ============================================================
import { assertMember } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { runPlayground, type PlaygroundCtx } from "./engine";

export interface PlaygroundTurn { role: "user" | "assistant"; content: string }
export interface PlaygroundReply {
  ok: boolean;
  text?: string;
  toolCalls?: { name: string; label: string }[];
  error?: string;
}

const MAX_HISTORY = 12;
const MAX_LEN = 500;

export async function playgroundReply(shopId: string, history: PlaygroundTurn[]): Promise<PlaygroundReply> {
  try {
    await assertMember(shopId);
    const svc = createServiceClient();

    const trimmed = history
      .filter((h) => (h.role === "user" || h.role === "assistant") && typeof h.content === "string" && h.content.trim())
      .slice(-MAX_HISTORY)
      .map((h) => ({ role: h.role, content: h.content.slice(0, MAX_LEN) }));
    if (!trimmed.length || trimmed[trimmed.length - 1].role !== "user") {
      return { ok: false, error: "ไม่มีข้อความให้ตอบ" };
    }

    const [{ data: shop }, { data: bot }, { data: pay }] = await Promise.all([
      svc.from("shops").select("id,name,description,currency").eq("id", shopId).single(),
      svc.from("bot_settings").select("*").eq("shop_id", shopId).maybeSingle(),
      svc.from("shop_payment_settings").select("promptpay_id,account_name,shipping_options").eq("shop_id", shopId).maybeSingle(),
    ]);
    if (!shop) return { ok: false, error: "ไม่พบร้าน" };

    const ctx: PlaygroundCtx = {
      svc,
      shop: { id: shop.id, name: shop.name, description: shop.description, currency: shop.currency ?? "THB" },
      bot: {
        persona_name: bot?.persona_name ?? "แอดมิน",
        tone: bot?.tone ?? "friendly",
        language: bot?.language ?? "th",
        custom_instructions: bot?.custom_instructions ?? null,
        auto_close_sale: bot?.auto_close_sale ?? true,
        upsell_enabled: bot?.upsell_enabled ?? true,
        model_tier: bot?.model_tier ?? "standard",
        fallback_message: bot?.fallback_message ?? "ขออภัยค่ะ เดี๋ยวแอดมินจะรีบมาตอบนะคะ",
      },
      payment: {
        promptpay_id: pay?.promptpay_id ?? null,
        account_name: pay?.account_name ?? null,
        shipping_options: (pay?.shipping_options as PlaygroundCtx["payment"]["shipping_options"]) ?? [],
      },
      history: trimmed,
    };

    const result = await runPlayground(ctx);
    return { ok: true, text: result.text, toolCalls: result.toolCalls };
  } catch (e) {
    const m = (e as Error).message;
    if (m === "AI_NOT_CONFIGURED") {
      return { ok: false, error: "แพลตฟอร์มยังไม่ได้ตั้งค่า AI — ผู้ดูแลระบบต้องใส่ API key ในหน้า ศูนย์ AI (Admin) ก่อน" };
    }
    if (m.includes("forbidden")) return { ok: false, error: "คุณไม่มีสิทธิ์ในร้านนี้" };
    return { ok: false, error: `เกิดข้อผิดพลาด: ${m.slice(0, 200)}` };
  }
}
