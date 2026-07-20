"use server";
// ============================================================
//  ตั้งค่า + ทดลอง "บอทตอบคอมเมนต์ → ทัก inbox"
//  กติกาเดิม: คืน {ok} เสมอ ห้าม throw ถึง client
// ============================================================
import { assertMember } from "@/lib/shop";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { friendlyAiError } from "@/lib/ai-errors";
import { runCommentPreview, type PlaygroundCtx } from "../playground/engine";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveCommentSettings(shopId: string, formData: FormData): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const supabase = await createClient();
    const keywords = String(formData.get("comment_keywords") ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("bot_settings").upsert({
      shop_id: shopId,
      comment_reply_enabled: formData.get("comment_reply_enabled") === "on",
      comment_public_reply: String(formData.get("comment_public_reply") ?? "").trim() || null,
      comment_keywords: keywords,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "เฉพาะเจ้าของ/ผู้ดูแลร้านตั้งค่าได้" : `บันทึกไม่สำเร็จ: ${m.slice(0, 150)}` };
  }
}

export interface CommentPreview {
  ok: boolean;
  dm?: string;
  publicReply?: string | null;
  toolCalls?: { name: string; label: string }[];
  error?: string;
}

const PREVIEW_LIMIT_PER_DAY = 30;

// ทดลอง: พิมพ์คอมเมนต์ตัวอย่าง -> เห็น DM ที่บอทจะส่งจริง (ไม่หักเครดิต แพลตฟอร์มออกค่า AI จึงมีเพดาน)
export async function previewCommentReply(shopId: string, commentText: string): Promise<CommentPreview> {
  try {
    await assertMember(shopId, ["owner", "admin", "agent"]);
    const text = commentText.trim().slice(0, 500);
    if (!text) return { ok: false, error: "พิมพ์คอมเมนต์ตัวอย่างก่อน" };

    const svc = createServiceClient();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count } = await svc.from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId).is("conversation_id", null).gte("created_at", dayAgo);
    if ((count ?? 0) >= PREVIEW_LIMIT_PER_DAY + 50) {
      return { ok: false, error: "ครบโควตาทดลองวันนี้แล้ว — พรุ่งนี้ลองต่อได้" };
    }

    const [{ data: shop }, { data: bot }] = await Promise.all([
      svc.from("shops").select("id,name,description,currency").eq("id", shopId).single(),
      svc.from("bot_settings").select("*").eq("shop_id", shopId).maybeSingle(),
    ]);
    if (!shop) return { ok: false, error: "ไม่พบร้าน" };

    const ctx: PlaygroundCtx = {
      svc,
      shop: { id: shop.id, name: shop.name, description: shop.description, currency: shop.currency ?? "THB" },
      bot: {
        persona_name: bot?.persona_name ?? "แอดมิน", tone: bot?.tone ?? "friendly", language: bot?.language ?? "th",
        auto_close_sale: false, upsell_enabled: false,
        model_tier: bot?.model_tier ?? "standard",
        fallback_message: "สนใจสินค้าทักแชทมาได้เลยนะคะ",
      },
      payment: { promptpay_id: null, account_name: null, shipping_options: [] },
      history: [],
    };
    const r = await runCommentPreview(ctx, text);
    return { ok: true, dm: r.text, publicReply: bot?.comment_public_reply ?? "ตอบใน DM แล้วนะคะ ❤️", toolCalls: r.toolCalls };
  } catch (e) {
    const m = (e as Error).message;
    if (m === "AI_NOT_CONFIGURED") return { ok: false, error: "แพลตฟอร์มยังไม่ได้ตั้งค่า AI — ผู้ดูแลระบบต้องใส่ API key ก่อน" };
    if (m.includes("forbidden")) return { ok: false, error: "คุณไม่มีสิทธิ์ในร้านนี้" };
    return { ok: false, error: friendlyAiError(m) };
  }
}
