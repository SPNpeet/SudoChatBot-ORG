// ============================================================
//  WEBHOOK GATEWAY: Meta (Facebook Messenger + Instagram DM)
//  หลักการ: เขียน raw event ลง DB ก่อนเสมอ -> เข้าคิว -> ตอบ 200 เร็วที่สุด
// ============================================================
import { sb, qSend } from "../_shared/supabase.ts";
import { json, hmacSha256Hex, timingSafeEqual, kick } from "../_shared/utils.ts";
import { QueueIncoming } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // ---- Meta webhook verification (ตอนตั้งค่า app) ----
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === Deno.env.get("META_VERIFY_TOKEN")) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const rawBody = await req.text();

  // ---- ตรวจลายเซ็น ----
  let signatureValid = false;
  const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
  const appSecret = Deno.env.get("META_APP_SECRET");
  if (appSecret && sigHeader.startsWith("sha256=")) {
    const expected = await hmacSha256Hex(appSecret, rawBody);
    signatureValid = timingSafeEqual(sigHeader.slice(7), expected);
  }

  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch { body = { unparseable: rawBody.slice(0, 2000) }; }
  const objectType = (body.object as string) ?? "unknown";
  const platform = objectType === "instagram" ? "instagram" : "facebook";

  // ---- 1) เก็บ raw event ก่อนเสมอ (audit / กันข้อมูลหาย) ----
  const { data: evt, error: evtErr } = await sb().from("webhook_events").insert({
    platform, event_type: objectType, payload: body,
    signature_valid: signatureValid,
    status: signatureValid ? "received" : "skipped",
    error: signatureValid ? null : "invalid signature",
  }).select("id").single();
  if (evtErr) console.error("webhook_events insert failed", evtErr.message);
  if (!signatureValid) return json({ ok: true }); // ตอบ 200 เสมอ กัน Meta ปิด webhook

  // ---- 2) แปลง event -> คิว ----
  let queued = 0;
  try {
    const entries = (body.entry ?? []) as Record<string, unknown>[];
    for (const entry of entries) {
      const pageId = String(entry.id ?? "");
      const messagings = [
        ...((entry.messaging ?? []) as Record<string, unknown>[]),
        ...((entry.standby ?? []) as Record<string, unknown>[]),
      ];
      if (!messagings.length) continue;

      const { data: channel } = await sb().from("channels")
        .select("id,shop_id,status").eq("platform", platform).eq("platform_page_id", pageId).maybeSingle();
      if (!channel || channel.status !== "active") continue;

      for (const m of messagings) {
        const msg = m.message as Record<string, unknown> | undefined;
        const postback = m.postback as Record<string, unknown> | undefined;
        if (msg?.is_echo) continue;                    // ข้อความที่เพจส่งเอง
        if (!msg && !postback) continue;               // delivery/read/อื่นๆ
        const sender = (m.sender as Record<string, string>)?.id;
        if (!sender || sender === pageId) continue;

        const attachments = ((msg?.attachments ?? []) as Record<string, unknown>[]).map((a) => ({
          type: String(a.type ?? "file"),
          url: (a.payload as Record<string, string>)?.url,
        }));
        const item: QueueIncoming = {
          webhook_event_id: evt?.id, shop_id: channel.shop_id, channel_id: channel.id,
          platform: platform as QueueIncoming["platform"],
          platform_user_id: sender,
          platform_message_id: (msg?.mid as string) ?? undefined,
          content_type: postback ? "postback" : attachments.length ? (attachments[0].type as QueueIncoming["content_type"]) : "text",
          text: (msg?.text as string) ?? (postback?.payload as string) ?? (postback?.title as string) ?? undefined,
          attachments: attachments.length ? attachments : undefined,
          timestamp: Number(m.timestamp ?? Date.now()),
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
    console.error("meta webhook parse error", (e as Error).message);
    if (evt) await sb().from("webhook_events").update({ status: "failed", error: (e as Error).message }).eq("id", evt.id);
  }

  if (queued) kick("queue-worker");
  return json({ ok: true, queued });
});
