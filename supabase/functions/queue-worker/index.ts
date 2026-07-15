// ============================================================
//  QUEUE WORKER — ตัวประมวลผลกลาง
//  incoming_messages -> AI ตอบ + ปิดการขาย | outbound_messages -> ส่งซ้ำ
// ============================================================
import { sb, qRead, qDelete, qArchive, qSend, getChannelToken, auditLog } from "../_shared/supabase.ts";
import { json } from "../_shared/utils.ts";
import { QueueIncoming, QueueOutbound, QueueSlip, OutMessage } from "../_shared/types.ts";
import { runSalesAgent, AgentContext } from "../_shared/ai.ts";
import { metaSend, metaProfile } from "../_shared/meta.ts";
import { lineSend, lineProfile } from "../_shared/line.ts";
import { tiktokSend } from "../_shared/tiktok.ts";

const MAX_READS = 4; // อ่านเกินนี้ = ย้ายเข้า archive กัน loop ไม่รู้จบ

async function sendToPlatform(
  platform: string, channelId: string, userId: string,
  messages: OutMessage[], replyToken?: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = await getChannelToken(channelId);
  if (!token) return { ok: false, error: "no channel token" };
  if (platform === "line") return await lineSend(token, userId, messages, replyToken);
  if (platform === "tiktok") {
    const { data: ch } = await sb().from("channels").select("platform_page_id").eq("id", channelId).single();
    if (!ch?.platform_page_id) return { ok: false, error: "no tiktok business id" };
    return await tiktokSend(token, ch.platform_page_id, userId, messages);
  }
  return await metaSend(token, userId, messages);
}

// ---------- ประมวลผลข้อความเข้า 1 รายการ ----------
async function processIncoming(item: QueueIncoming): Promise<void> {
  const s = sb();
  const t0 = Date.now();

  // โหลดบริบทร้าน
  const [{ data: shop }, { data: bot }, { data: pay }] = await Promise.all([
    s.from("shops").select("id,name,description,currency,status").eq("id", item.shop_id).single(),
    s.from("bot_settings").select("*").eq("shop_id", item.shop_id).maybeSingle(),
    s.from("shop_payment_settings").select("promptpay_id,account_name,bank_name,shipping_options").eq("shop_id", item.shop_id).maybeSingle(),
  ]);
  if (!shop || shop.status !== "active") throw new Error("shop inactive");

  // ---- ลูกค้า ----
  const { data: customer } = await s.from("customers").upsert({
    shop_id: item.shop_id, channel_id: item.channel_id,
    platform_user_id: item.platform_user_id,
    last_active_at: new Date().toISOString(),
  }, { onConflict: "channel_id,platform_user_id" }).select("id,display_name").single();
  if (!customer) throw new Error("customer upsert failed");

  // เติมโปรไฟล์ครั้งแรก
  if (!customer.display_name) {
    const token = await getChannelToken(item.channel_id);
    if (token) {
      const prof = item.platform === "line"
        ? await lineProfile(token, item.platform_user_id)
        : await metaProfile(token, item.platform_user_id);
      if (prof.display_name || prof.avatar_url) {
        await s.from("customers").update(prof).eq("id", customer.id);
      }
    }
  }

  // ---- บทสนทนา (active ห้องเดียวต่อลูกค้า) ----
  let { data: conv } = await s.from("conversations")
    .select("id,status,bot_enabled").eq("customer_id", customer.id).neq("status", "closed")
    .limit(1).maybeSingle();
  if (!conv) {
    const { data: created, error } = await s.from("conversations").insert({
      shop_id: item.shop_id, channel_id: item.channel_id, customer_id: customer.id,
    }).select("id,status,bot_enabled").single();
    if (error) { // race: มีคนสร้างพร้อมกัน
      const { data: again } = await s.from("conversations")
        .select("id,status,bot_enabled").eq("customer_id", customer.id).neq("status", "closed").limit(1).maybeSingle();
      conv = again;
    } else conv = created;
  }
  if (!conv) throw new Error("conversation create failed");

  // ---- บันทึกข้อความเข้า (กันซ้ำด้วย unique index) ----
  const isFollow = item.text === "__follow__";
  const { data: inMsg, error: msgErr } = await s.from("messages").insert({
    shop_id: item.shop_id, conversation_id: conv.id,
    direction: "inbound", sender_type: "customer",
    content_type: item.content_type === "postback" ? "text" : item.content_type,
    content: isFollow ? "[ลูกค้าเพิ่มเพื่อน]" : item.text ?? (item.attachments?.length ? `[${item.attachments[0].type}]` : null),
    attachments: item.attachments ?? [],
    platform_message_id: item.platform_message_id ?? null,
    status: "received",
  }).select("id").single();
  if (msgErr) {
    if (msgErr.code === "23505") { console.log("duplicate message, skip", item.platform_message_id); return; }
    throw new Error(`message insert: ${msgErr.message}`);
  }
  await s.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);
  if (item.webhook_event_id) {
    await s.from("webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", item.webhook_event_id);
  }

  // ---- รูปภาพ + มีออเดอร์รอจ่าย = สลิป -> คิวตรวจสลิป ----
  if (item.content_type === "image" && item.attachments?.length) {
    const { data: pendingOrder } = await s.from("orders").select("id")
      .eq("conversation_id", conv.id).eq("status", "pending_payment").limit(1).maybeSingle();
    if (pendingOrder) {
      const slipItem: QueueSlip = {
        shop_id: item.shop_id, channel_id: item.channel_id, conversation_id: conv.id,
        customer_id: customer.id, platform: item.platform, platform_user_id: item.platform_user_id,
        order_id: pendingOrder.id,
        media: { url: item.attachments[0].url, line_message_id: item.attachments[0].media_id },
        webhook_event_id: item.webhook_event_id,
      };
      await qSend("slip_verification", slipItem);
      const ack: OutMessage[] = [{ type: "text", text: "ได้รับสลิปแล้วค่ะ กำลังตรวจสอบสักครู่นะคะ 🙏" }];
      const sent = await sendToPlatform(item.platform, item.channel_id, item.platform_user_id, ack, item.reply_token);
      await s.from("messages").insert({
        shop_id: item.shop_id, conversation_id: conv.id, direction: "outbound", sender_type: "system",
        content_type: "text", content: ack[0].type === "text" ? ack[0].text : "", status: sent.ok ? "sent" : "failed", error: sent.error,
      });
      return;
    }
  }

  // ---- บอทปิดอยู่ / คนคุมอยู่ -> เก็บอย่างเดียว ----
  if (!bot?.enabled || !conv.bot_enabled || conv.status === "human") return;

  // ---- Rate limit ต่อร้าน (ต่อนาที/ต่อวัน ตามแพ็กเกจ) — เกินลิมิต = เก็บข้อความแต่ไม่ตอบ ----
  const { data: withinLimit } = await s.rpc("check_shop_rate_limit", { p_shop_id: item.shop_id });
  if (withinLimit === false) {
    console.log("rate limit exceeded, skip reply", item.shop_id);
    return;
  }

  // ---- keyword ส่งต่อมนุษย์ ----
  const text = (item.text ?? "").toLowerCase();
  if (text && (bot.handoff_keywords ?? []).some((k: string) => k && text.includes(k.toLowerCase()))) {
    await s.from("conversations").update({ status: "human" }).eq("id", conv.id);
    const msgs: OutMessage[] = [{ type: "text", text: bot.fallback_message }];
    await sendToPlatform(item.platform, item.channel_id, item.platform_user_id, msgs, item.reply_token);
    await s.from("messages").insert({
      shop_id: item.shop_id, conversation_id: conv.id, direction: "outbound", sender_type: "system",
      content_type: "text", content: bot.fallback_message, status: "sent",
    });
    await auditLog({ shop_id: item.shop_id, actor_type: "bot", action: "handoff_keyword", resource_type: "conversation", resource_id: conv.id });
    return;
  }

  // ---- เตรียมบริบทให้ AI ----
  const { data: historyRows } = await s.from("messages")
    .select("direction,sender_type,content,content_type")
    .eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(20);
  const history = (historyRows ?? []).reverse().map((m) => ({
    role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
    content: m.content ?? `[${m.content_type}]`,
  })).filter((m) => m.content);
  // รวมข้อความ user ติดกัน (Claude ต้องการ alternating; เผื่อ user ส่งรัว)
  const merged: { role: "user" | "assistant"; content: string }[] = [];
  for (const h of history) {
    const last = merged[merged.length - 1];
    if (last && last.role === h.role) last.content += "\n" + h.content;
    else merged.push({ ...h });
  }
  if (!merged.length || merged[merged.length - 1].role !== "user") {
    merged.push({ role: "user", content: item.text ?? "[ข้อความใหม่]" });
  }

  const { data: draft } = await s.from("orders")
    .select("order_number,status,subtotal,shipping_fee,total,shipping_method,shipping_name,shipping_phone,shipping_address")
    .eq("conversation_id", conv.id).in("status", ["draft", "pending_payment"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  const ctx: AgentContext = {
    shop: { id: shop.id, name: shop.name, description: shop.description ?? undefined, currency: shop.currency },
    bot: {
      persona_name: bot.persona_name, tone: bot.tone, language: bot.language,
      greeting: bot.greeting ?? undefined, custom_instructions: bot.custom_instructions ?? undefined,
      auto_close_sale: bot.auto_close_sale, upsell_enabled: bot.upsell_enabled,
      model_tier: bot.model_tier, fallback_message: bot.fallback_message,
    },
    payment: pay ? {
      promptpay_id: pay.promptpay_id ?? undefined, account_name: pay.account_name ?? undefined,
      bank_name: pay.bank_name ?? undefined,
      shipping_options: (pay.shipping_options ?? []) as { name: string; fee: number; free_over?: number }[],
    } : null,
    conversation_id: conv.id, customer_id: customer.id,
    history: merged, draftOrder: draft ?? null,
  };

  const result = await runSalesAgent(ctx);

  // ---- เครดิต/โควตาหมด: แจ้งเจ้าของร้าน (dedupe 24 ชม. ใน RPC) แล้วจบงาน ----
  if (result.billBlocked) {
    await sb().rpc("notify_bot_blocked", { p_shop_id: item.shop_id });
    return;
  }

  // ---- กันตอบข้าม: ถ้ามีข้อความใหม่กว่าเข้ามาแล้ว ให้ข้าม (ข้อความล่าสุดจะตอบแทน) ----
  const { data: latest } = await s.from("messages").select("id")
    .eq("conversation_id", conv.id).eq("direction", "inbound")
    .order("created_at", { ascending: false }).limit(1).single();
  if (latest && inMsg && latest.id !== inMsg.id) {
    console.log("newer message arrived, skip reply");
    return;
  }

  if (result.handoff) {
    await s.from("conversations").update({ status: "human" }).eq("id", conv.id);
    await auditLog({ shop_id: item.shop_id, actor_type: "bot", action: "handoff_ai", resource_type: "conversation", resource_id: conv.id });
  }

  const sent = await sendToPlatform(item.platform, item.channel_id, item.platform_user_id, result.messages, item.reply_token);
  const latency = Date.now() - t0;
  for (const m of result.messages) {
    await s.from("messages").insert({
      shop_id: item.shop_id, conversation_id: conv.id, direction: "outbound", sender_type: "bot",
      content_type: m.type, content: m.type === "text" ? m.text : m.url,
      status: sent.ok ? "sent" : "failed", error: sent.error,
      ai_model: result.model, input_tokens: result.input_tokens, output_tokens: result.output_tokens,
      latency_ms: latency,
    });
  }
  await s.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id);

  if (!sent.ok) {
    const retry: QueueOutbound = {
      shop_id: item.shop_id, channel_id: item.channel_id, conversation_id: conv.id,
      platform: item.platform, platform_user_id: item.platform_user_id,
      messages: result.messages, attempt: 1,
    };
    await qSend("outbound_messages", retry);
  }
}

// ---------- ส่งซ้ำข้อความออกที่ล้มเหลว ----------
async function processOutbound(item: QueueOutbound): Promise<void> {
  const sent = await sendToPlatform(item.platform, item.channel_id, item.platform_user_id, item.messages);
  if (!sent.ok) {
    if (item.attempt >= 5) {
      await auditLog({
        shop_id: item.shop_id, actor_type: "system", action: "outbound_gave_up",
        resource_type: "conversation", resource_id: item.conversation_id,
        details: { error: sent.error, attempts: item.attempt },
      });
      return; // เลิกส่ง (บันทึกแล้ว)
    }
    throw new Error(sent.error ?? "send failed"); // ปล่อยให้ vt หมดอายุแล้วลองใหม่
  }
}

Deno.serve(async (_req: Request) => {
  let inOk = 0, inFail = 0, outOk = 0, outFail = 0;

  // ---- incoming ----
  const incoming = await qRead<QueueIncoming>("incoming_messages", 90, 5);
  for (const row of incoming) {
    try {
      await processIncoming(row.message);
      await qDelete("incoming_messages", row.msg_id);
      inOk++;
    } catch (e) {
      console.error("processIncoming error", (e as Error).message);
      inFail++;
      if (row.read_ct >= MAX_READS) {
        await qArchive("incoming_messages", row.msg_id);
        if (row.message.webhook_event_id) {
          await sb().from("webhook_events").update({
            status: "failed", error: (e as Error).message, retry_count: row.read_ct,
          }).eq("id", row.message.webhook_event_id);
        }
        await auditLog({
          shop_id: row.message.shop_id, actor_type: "system", action: "incoming_archived",
          details: { error: (e as Error).message, msg_id: row.msg_id },
        });
      }
    }
  }

  // ---- outbound retries ----
  const outbound = await qRead<QueueOutbound>("outbound_messages", 60, 5);
  for (const row of outbound) {
    try {
      row.message.attempt = (row.message.attempt ?? 1) + (row.read_ct - 1);
      await processOutbound(row.message);
      await qDelete("outbound_messages", row.msg_id);
      outOk++;
    } catch (e) {
      outFail++;
      if (row.read_ct >= MAX_READS) await qArchive("outbound_messages", row.msg_id);
    }
  }

  return json({ incoming: { ok: inOk, fail: inFail }, outbound: { ok: outOk, fail: outFail } });
});
