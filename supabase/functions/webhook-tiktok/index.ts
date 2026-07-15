// ============================================================
//  WEBHOOK GATEWAY: TikTok Business Messaging
//  URL ต่อร้าน: /functions/v1/webhook-tiktok?channel={channel_id}
//  ตรวจลายเซ็นด้วย webhook_secret (TikTok app client secret) ของ channel
//  deploy ด้วย verify_jwt=false (ตรวจลายเซ็นเองเหมือน webhook-meta/line)
// ============================================================
import { sb, qSend } from "../_shared/supabase.ts";
import { json, kick } from "../_shared/utils.ts";
import { tiktokVerifySignature } from "../_shared/tiktok.ts";
import { QueueIncoming } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
  // TikTok ใช้ GET + echo challenge ตอน verify endpoint
  if (req.method === "GET") {
    const challenge = new URL(req.url).searchParams.get("challenge");
    return challenge ? new Response(challenge) : json({ ok: true });
  }
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = new URL(req.url);
  const channelId = url.searchParams.get("channel");
  const rawBody = await req.text();

  // ---- หา channel + ตรวจลายเซ็นด้วย secret ของร้านนั้น ----
  let channel: { id: string; shop_id: string; webhook_secret: string | null; status: string } | null = null;
  if (channelId) {
    const { data } = await sb().from("channels")
      .select("id,shop_id,webhook_secret,status")
      .eq("id", channelId).eq("platform", "tiktok").maybeSingle();
    channel = data;
  }
  let signatureValid = false;
  const sig = req.headers.get("tiktok-signature") ?? "";
  if (channel?.webhook_secret && sig) {
    signatureValid = await tiktokVerifySignature(channel.webhook_secret, sig, rawBody);
  }

  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch { body = { unparseable: rawBody.slice(0, 2000) }; }

  // ---- 1) เก็บ raw event ก่อนเสมอ ----
  const { data: evt } = await sb().from("webhook_events").insert({
    platform: "tiktok", channel_id: channel?.id ?? null, shop_id: channel?.shop_id ?? null,
    event_type: (body.event as string) ?? "tiktok_webhook", payload: body, signature_valid: signatureValid,
    status: signatureValid && channel ? "received" : "skipped",
    error: !channel ? "unknown channel" : (!signatureValid ? "invalid signature" : null),
  }).select("id").single();

  if (!channel || !signatureValid || channel.status !== "active") return json({ ok: true });

  // ---- 2) แปลง event -> คิว ----
  let queued = 0;
  try {
    // โครง payload Business Messaging: { event: "im_message_received", data: { messages: [...] } }
    const data = (body.data ?? {}) as Record<string, unknown>;
    const messages = (data.messages ?? (data.message ? [data.message] : [])) as Record<string, unknown>[];
    for (const msg of messages) {
      const userId = String(msg.sender_id ?? msg.from_user_id ?? "");
      if (!userId) continue;
      const msgType = String(msg.type ?? "text");
      const item: QueueIncoming = {
        webhook_event_id: evt?.id, shop_id: channel.shop_id, channel_id: channel.id,
        platform: "tiktok", platform_user_id: userId,
        platform_message_id: String(msg.message_id ?? msg.id ?? ""),
        content_type: msgType === "image" ? "image" : "text",
        text: (msg.text as string) ?? ((msg.content as Record<string, string>)?.text) ?? undefined,
        attachments: msgType === "image" && (msg.image_url || (msg.content as Record<string, string>)?.image_url)
          ? [{ type: "image", url: String(msg.image_url ?? (msg.content as Record<string, string>)?.image_url) }] : undefined,
        timestamp: Number(msg.create_time ?? Date.now()),
      };
      if (await qSend("incoming_messages", item) !== null) queued++;
    }
    if (evt) {
      await sb().from("webhook_events").update({
        status: queued ? "queued" : "skipped",
        processed_at: queued ? null : new Date().toISOString(),
      }).eq("id", evt.id);
    }
  } catch (e) {
    console.error("tiktok webhook error", (e as Error).message);
    if (evt) await sb().from("webhook_events").update({ status: "failed", error: (e as Error).message }).eq("id", evt.id);
  }

  if (queued) kick("queue-worker");
  return json({ ok: true, queued });
});
