"use server";
// ============================================================
//  AI Ads Agent actions — กติกาเหล็ก:
//  · ทุก action คืน {ok} เสมอ ห้าม throw
//  · การใช้เงินทุกกรณีต้องผ่าน proposal ที่ร้านกดยืนยันเอง
//  · server ตรวจเพดานงบซ้ำตอน execute เสมอ (ไม่เชื่อ AI)
// ============================================================
import { assertMember } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { friendlyAdsError } from "@/lib/ads-errors";
import { friendlyAiError } from "@/lib/ai-errors";
import { revalidatePath } from "next/cache";
import {
  runAdsAgent, executeProposalPayload, pauseCampaign, syncCampaigns,
  type AdsCtx, type AdAccountInfo, type ProposalPayload,
} from "./engine";

export interface AdsTurn { role: "user" | "assistant"; content: string }
export interface AdsReply {
  ok: boolean;
  text?: string;
  proposals?: { id: string; summary: string; type: string }[];
  toolCalls?: { name: string; label: string }[];
  error?: string;
}
export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_HISTORY = 16;
const MAX_LEN = 1000;
const ADS_LIMIT_PER_DAY = 30;

async function loadAccount(svc: ReturnType<typeof createServiceClient>, shopId: string): Promise<{ account: AdAccountInfo; token: string } | { error: string }> {
  const { data: acc } = await svc.from("ad_accounts")
    .select("id, ad_account_id, account_name, currency, page_id, status, daily_cap_per_campaign, daily_cap_total, token_expires_at")
    .eq("shop_id", shopId).eq("status", "active")
    .order("connected_at", { ascending: false }).limit(1).maybeSingle();
  if (!acc) return { error: "ยังไม่ได้เชื่อมบัญชีโฆษณา — กดปุ่ม \"เชื่อมต่อบัญชีโฆษณา Meta\" ก่อน" };
  if (acc.token_expires_at && new Date(acc.token_expires_at) < new Date()) {
    await svc.from("ad_accounts").update({ status: "token_expired" }).eq("id", acc.id);
    return { error: "การเชื่อมต่อหมดอายุแล้ว — กดเชื่อมต่อใหม่ (Meta ให้ ~60 วันต่อครั้ง)" };
  }
  const { data: token } = await svc.rpc("get_ad_token", { p_ad_account_row_id: acc.id });
  if (!token) return { error: "ไม่พบ token — กดเชื่อมต่อใหม่" };
  return {
    account: {
      rowId: acc.id, adAccountId: acc.ad_account_id, accountName: acc.account_name ?? acc.ad_account_id,
      currency: acc.currency ?? "THB", pageId: acc.page_id,
      dailyCapPerCampaign: Number(acc.daily_cap_per_campaign), dailyCapTotal: Number(acc.daily_cap_total),
    },
    token: String(token),
  };
}

export async function adsAgentReply(shopId: string, history: AdsTurn[]): Promise<AdsReply> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();

    // โควตาแชท agent (แพลตฟอร์มออกค่า AI)
    const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count } = await svc.from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId).eq("purpose", "ads").gte("created_at", dayAgo);
    if ((count ?? 0) >= ADS_LIMIT_PER_DAY) {
      return { ok: false, error: `ครบโควตาคุยกับผู้ช่วยแอดวันนี้แล้ว (${ADS_LIMIT_PER_DAY} ข้อความ/วัน) — พรุ่งนี้คุยต่อได้` };
    }

    const loaded = await loadAccount(svc, shopId);
    if ("error" in loaded) return { ok: false, error: loaded.error };

    const { data: shop } = await svc.from("shops").select("name").eq("id", shopId).single();
    const trimmed = history
      .filter((h) => (h.role === "user" || h.role === "assistant") && typeof h.content === "string" && h.content.trim())
      .slice(-MAX_HISTORY)
      .map((h) => ({ role: h.role, content: h.content.slice(0, MAX_LEN) }));
    if (!trimmed.length || trimmed[trimmed.length - 1].role !== "user") {
      return { ok: false, error: "ไม่มีข้อความให้ตอบ" };
    }

    const ctx: AdsCtx = {
      svc, shopId, shopName: shop?.name ?? "ร้านค้า",
      account: loaded.account, token: loaded.token, history: trimmed,
    };
    const r = await runAdsAgent(ctx);
    return { ok: true, text: r.text, proposals: r.proposals, toolCalls: r.toolCalls };
  } catch (e) {
    const m = (e as Error).message;
    if (m === "AI_NOT_CONFIGURED") return { ok: false, error: "แพลตฟอร์มยังไม่ได้ตั้งค่า AI — ผู้ดูแลระบบต้องใส่ API key ก่อน" };
    if (m.includes("forbidden")) return { ok: false, error: "เฉพาะเจ้าของ/ผู้ดูแลร้านใช้ผู้ช่วยแอดได้" };
    if (m.startsWith("meta ")) return { ok: false, error: friendlyAdsError(m) };
    return { ok: false, error: friendlyAiError(m) };
  }
}

// ร้านกดยืนยันข้อเสนอ — จุดเดียวที่เงินเริ่มขยับ: ตรวจสิทธิ์ + เพดาน + หมดอายุ ซ้ำทั้งหมด
export async function executeAdProposal(shopId: string, proposalId: string): Promise<ActionResult> {
  try {
    const { user } = await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();

    const { data: prop } = await svc.from("ad_proposals")
      .select("id, type, payload, summary, status, expires_at")
      .eq("id", proposalId).eq("shop_id", shopId).single();
    if (!prop) return { ok: false, error: "ไม่พบข้อเสนอนี้" };
    if (prop.status !== "pending") return { ok: false, error: "ข้อเสนอนี้ถูกใช้ไปแล้วหรือถูกยกเลิก" };
    if (new Date(prop.expires_at) < new Date()) {
      await svc.from("ad_proposals").update({ status: "expired" }).eq("id", prop.id);
      return { ok: false, error: "ข้อเสนอหมดอายุแล้ว (24 ชม.) — ให้ผู้ช่วยเสนอใหม่" };
    }

    const loaded = await loadAccount(svc, shopId);
    if ("error" in loaded) return { ok: false, error: loaded.error };
    const payload = prop.payload as unknown as ProposalPayload;

    // ---- ตรวจเพดานซ้ำฝั่ง server (ไม่เชื่อค่าใน proposal เฉยๆ) ----
    const acc = loaded.account;
    const budgetOf = payload.kind === "create_campaign" ? payload.daily_budget_thb
      : payload.kind === "update_budget" ? payload.new_daily_budget_thb : null;
    if (budgetOf !== null) {
      if (budgetOf <= 0 || budgetOf > acc.dailyCapPerCampaign) {
        return { ok: false, error: `งบ ${budgetOf} บาท/วัน เกินเพดานร้าน (${acc.dailyCapPerCampaign} บาท/วัน/แคมเปญ) — ปรับเพดานในหน้านี้ก่อนถ้าต้องการ` };
      }
      // เพดานรวม: งบรวมของแคมเปญ ACTIVE ทั้งหมด + งบใหม่ ต้องไม่เกิน cap รวม
      const { data: actives } = await svc.from("ad_campaigns")
        .select("campaign_id, daily_budget, status").eq("shop_id", shopId).eq("ad_account_id", acc.adAccountId);
      const currentTotal = (actives ?? [])
        .filter((c) => c.status === "ACTIVE" && (payload.kind !== "update_budget" || c.campaign_id !== payload.campaign_id))
        .reduce((s, c) => s + Number(c.daily_budget ?? 0), 0);
      if (currentTotal + budgetOf > acc.dailyCapTotal && payload.kind !== "create_campaign") {
        // create = สร้างแบบ PAUSED ไม่นับใน total จนกว่าจะ resume
        return { ok: false, error: `งบรวมจะเป็น ${currentTotal + budgetOf} บาท/วัน เกินเพดานรวมของร้าน (${acc.dailyCapTotal} บาท/วัน)` };
      }
    }
    if (payload.kind === "resume_campaign") {
      const { data: target } = await svc.from("ad_campaigns").select("daily_budget").eq("campaign_id", payload.campaign_id).maybeSingle();
      const { data: actives } = await svc.from("ad_campaigns")
        .select("daily_budget,status,campaign_id").eq("shop_id", shopId).eq("ad_account_id", acc.adAccountId);
      const currentTotal = (actives ?? []).filter((c) => c.status === "ACTIVE").reduce((s, c) => s + Number(c.daily_budget ?? 0), 0);
      const adding = Number(target?.daily_budget ?? 0);
      if (currentTotal + adding > acc.dailyCapTotal) {
        return { ok: false, error: `เปิดแคมเปญนี้แล้วงบรวมจะเป็น ${currentTotal + adding} บาท/วัน เกินเพดานรวม (${acc.dailyCapTotal} บาท/วัน) — หยุดแคมเปญอื่นก่อน หรือเพิ่มเพดาน` };
      }
    }

    // ---- ยิงจริง ----
    const campaignId = await executeProposalPayload({ token: loaded.token, account: acc }, payload);
    await svc.from("ad_proposals").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", prop.id);
    await syncCampaigns(svc, shopId, acc.adAccountId, loaded.token);
    await svc.from("audit_logs").insert({
      shop_id: shopId, actor_type: "user", actor_id: user.id, action: `ad_proposal_executed_${prop.type}`,
      resource_type: "ad_campaign", resource_id: campaignId, details: { summary: prop.summary },
    });
    revalidatePath("/dashboard/ads");
    return { ok: true };
  } catch (e) {
    const m = (e as Error).message;
    const svc = createServiceClient();
    await svc.from("ad_proposals").update({ status: "failed", error: m.slice(0, 300) }).eq("id", proposalId).eq("shop_id", shopId);
    if (m.includes("forbidden")) return { ok: false, error: "เฉพาะเจ้าของ/ผู้ดูแลร้านยืนยันได้" };
    return { ok: false, error: friendlyAdsError(m) };
  }
}

export async function rejectAdProposal(shopId: string, proposalId: string): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    await svc.from("ad_proposals").update({ status: "rejected" }).eq("id", proposalId).eq("shop_id", shopId).eq("status", "pending");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message.includes("forbidden") ? "ไม่มีสิทธิ์" : "ทำรายการไม่สำเร็จ" };
  }
}

// หยุดแคมเปญจากปุ่มในตาราง (นอกแชท) — หยุดเงินปลอดภัยเสมอ ไม่ต้องยืนยัน
export async function pauseAdCampaign(shopId: string, campaignId: string): Promise<ActionResult> {
  try {
    const { user } = await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    const { data: camp } = await svc.from("ad_campaigns").select("campaign_id").eq("campaign_id", campaignId).eq("shop_id", shopId).maybeSingle();
    if (!camp) return { ok: false, error: "ไม่พบแคมเปญนี้ในร้าน" };
    const loaded = await loadAccount(svc, shopId);
    if ("error" in loaded) return { ok: false, error: loaded.error };
    await pauseCampaign(loaded.token, campaignId);
    await svc.from("ad_campaigns").update({ status: "PAUSED" }).eq("campaign_id", campaignId);
    await svc.from("audit_logs").insert({
      shop_id: shopId, actor_type: "user", actor_id: user.id, action: "ad_campaign_paused",
      resource_type: "ad_campaign", resource_id: campaignId,
    });
    revalidatePath("/dashboard/ads");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyAdsError((e as Error).message) };
  }
}

export async function saveAdCaps(shopId: string, perCampaign: number, total: number): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const cap1 = Math.max(50, Math.min(100000, Number(perCampaign) || 300));
    const cap2 = Math.max(cap1, Math.min(500000, Number(total) || 1000));
    const svc = createServiceClient();
    await svc.from("ad_accounts").update({ daily_cap_per_campaign: cap1, daily_cap_total: cap2 })
      .eq("shop_id", shopId).eq("status", "active");
    revalidatePath("/dashboard/ads");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message.includes("forbidden") ? "เฉพาะเจ้าของ/ผู้ดูแลร้าน" : "บันทึกไม่สำเร็จ" };
  }
}

export async function refreshCampaigns(shopId: string): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    const loaded = await loadAccount(svc, shopId);
    if ("error" in loaded) return { ok: false, error: loaded.error };
    await syncCampaigns(svc, shopId, loaded.account.adAccountId, loaded.token);
    revalidatePath("/dashboard/ads");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyAdsError((e as Error).message) };
  }
}
