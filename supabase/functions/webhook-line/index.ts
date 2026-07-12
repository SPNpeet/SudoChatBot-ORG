// ============================================================
//  WEBHOOK GATEWAY: LINE Messaging API
//  URL ต่อร้าน: /functions/v1/webhook-line?channel={channel_id}
// ============================================================
import { sb, qSend } from "../_shared/supabase.ts";
import { json, hmacSha256Base64, timingSafeEqual, kick } from "../_shared/utils.ts";
import { QueueIncoming } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const url = new URL(req.url);
  const channelId = url.searchParams.get("channel");
  const rawBody = await req.text();

  // ---- หา channel + ตรวจลายเซ็นด้วย secret ของร้านนั้น ----
  let channel: { id: string; shop_id: string; webhook_secret: string | null; status: string } | null = null;
  if (channelId) {
    const { data } = await sb().from("channels")
      .select("id,shop_id,webhook_secret,status")
      .eq("id", channelId).eq("platform", "line").maybeSingle();
    channel = data;
  }
  let signatureValid = false;
  const sig = req.headers.get("x-line-signature") ?? "";
  if (channel?.webhook_secret && sig) {
    const expected = await hmacSha256Base64(channel.webhook_secret, rawBody);
    signatureValid = timingSafeEqual(sig, expected);
  }

  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch { body = { unparseable: rawBody.slice(0, 2000) }; }
  const events = (body.events ?? []) as Record<string, unknown>[];

  // LINE verify button ส่ง events ว่าง -> ตอบ 200
  if (!events.length) return json({ ok: true });

  const { data: evt } = await sb().from("webhook_events").insert({
    platform: "line", channel_id: channel?.id ?? null, shop_id: channel?.shop_id ?? null,
    event_type: "line_webhook", payload: body, signature_valid: signatureValid,
    status: signatureValid && channel ? "received" : "skipped",
    error: !channel ? "unknown channel" : (!signatureValid ? "invalid signature" : null),
  }).select("id").single();

  if (!channel || !signatureValid || channel.status !== "active") return json({ ok: true });

  let queued = 0;
  try {
    for (const ev of events) {
      const type = ev.type as string;
      const src = ev.source as Record<string, string> | undefined;
      const userId = src?.userId;
      if (!userId) continue;

      if (type === "message") {
        const msg = ev.message as Record<string, unknown>;
        const msgType = msg.type as string;
        const item: QueueIncoming = {
          webhook_event_id: evt?.id, shop_id: channel.shop_id, channel_id: channel.id,
          platform: "line", platform_user_id: userId,
          platform_message_id: String(msg.id ?? ""),
          reply_token: ev.replyToken as string,
          content_type: (["text", "image", "sticker", "video", "audio", "file", "location"].includes(msgType) ? msgType : "file") as QueueIncoming["content_type"],
          text: (msg.text as string) ?? undefined,
          attachments: msgType === "image" || msgType === "video" || msgType === "file"
            ? [{ type: msgType, media_id: String(msg.id) }] : undefined,
          timestamp: Number(ev.timestamp ?? Date.now()),
        };
        if (await qSend("incoming_messages", item) !== null) queued++;
      } else if (type === "follow") {
        const item: QueueIncoming = {
          webhook_event_id: evt?.id, shop_id: channel.shop_id, channel_id: channel.id,
          platform: "line", platform_user_id: userId,
          reply_token: ev.replyToken as string,
          content_type: "postback", text: "__follow__",
          timestamp: Number(ev.timestamp ?? Date.now()),
        };
        if (await qSend("incoming_messages", item) !== null) queued++;
      }
    }
    if (evt) {
      await sb().from("webhook_events").update({
        status: queued ? "queued" : "skipped",
        processed_at: queued ? null : new Date().toISOString(),
      }).eq("id", evt.id);
    }
  } catch (e) {
    console.error("line webhook error", (e as Error).message);
    if (evt) await sb().from("webhook_events").update({ status: "failed", error: (e as Error).message }).eq("id", evt.id);
  }

  if (queued) kick("queue-worker");
  return json({ ok: true, queued });
});
