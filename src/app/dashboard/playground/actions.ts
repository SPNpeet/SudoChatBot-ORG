"use server";
// ============================================================
//  Playground actions — ทดลองคุยกับบอท (ไม่หักเครดิต ไม่เขียนออเดอร์จริง)
//  กติกาเหล็ก: assertMember ก่อนแตะ service client เสมอ
// ============================================================
import { assertMember } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { friendlyAiError } from "@/lib/ai-errors";
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
const PLAYGROUND_LIMIT_PER_MIN = 15;
// เพดานรายวัน — playground ไม่หักเครดิตร้าน (แพลตฟอร์มจ่ายค่า AI) ต้องมีเพดานกันเผาเงิน
const PLAYGROUND_LIMIT_PER_DAY = 50;

export async function playgroundReply(shopId: string, history: PlaygroundTurn[]): Promise<PlaygroundReply> {
  try {
    // viewer อ่านอย่างเดียว ห้ามสั่งเรียก AI จริง (มีต้นทุนค่าคีย์ของร้าน)
    await assertMember(shopId, ["owner", "admin", "agent"]);
    const svc = createServiceClient();

    // throttle แยกจาก check_shop_rate_limit ของโปรดักชัน (ไม่แชร์โควตากับลูกค้าจริง) กันสแปมยิง action ตรงๆ
    // นับเฉพาะ purpose='reply' + conversation_id ว่าง = เฉพาะ playground/preview (ไม่ปนกับ assistant/ads/comment)
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await svc.from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId).eq("purpose", "reply").is("conversation_id", null).gte("created_at", since);
    if ((count ?? 0) >= PLAYGROUND_LIMIT_PER_MIN) {
      return { ok: false, error: "ทดลองถี่เกินไป รอสักครู่แล้วลองใหม่นะคะ" };
    }
    const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count: dayCount } = await svc.from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId).eq("purpose", "reply").is("conversation_id", null).gte("created_at", dayAgo);
    if ((dayCount ?? 0) >= PLAYGROUND_LIMIT_PER_DAY) {
      return { ok: false, error: `ครบโควตาทดลองบอทวันนี้แล้ว (${PLAYGROUND_LIMIT_PER_DAY} ข้อความ/วัน) — พรุ่งนี้ทดลองต่อได้ หรือเชื่อมช่องทางจริงเพื่อใช้กับลูกค้าได้เลย` };
    }

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
        greeting: bot?.greeting ?? null,
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
    return { ok: false, error: friendlyAiError(m) };
  }
}
