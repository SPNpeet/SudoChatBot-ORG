// ==== LINE Messaging API ====
import { OutMessage } from "./types.ts";

const LINE_API = "https://api.line.me/v2/bot";
const LINE_DATA = "https://api-data.line.me/v2/bot";

function toLineMessages(messages: OutMessage[]) {
  return messages.slice(0, 5).map((m) =>
    m.type === "text"
      ? { type: "text", text: m.text.slice(0, 4990) }
      : { type: "image", originalContentUrl: m.url, previewImageUrl: m.url }
  );
}

/** ตอบด้วย replyToken ก่อน (ฟรี) ถ้าหมดอายุ fallback เป็น push */
export async function lineSend(
  channelToken: string,
  userId: string,
  messages: OutMessage[],
  replyToken?: string,
): Promise<{ ok: boolean; error?: string }> {
  const payload = toLineMessages(messages);
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${channelToken}`,
  };
  if (replyToken) {
    const res = await fetch(`${LINE_API}/message/reply`, {
      method: "POST", headers,
      body: JSON.stringify({ replyToken, messages: payload }),
    });
    if (res.ok) return { ok: true };
    console.warn("line reply failed -> fallback push", res.status, await res.text());
  }
  const res = await fetch(`${LINE_API}/message/push`, {
    method: "POST", headers,
    body: JSON.stringify({ to: userId, messages: payload }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("linePush fail", res.status, err);
    return { ok: false, error: `line ${res.status}: ${err.slice(0, 300)}` };
  }
  return { ok: true };
}

export async function lineProfile(channelToken: string, userId: string): Promise<{ display_name?: string; avatar_url?: string }> {
  try {
    const res = await fetch(`${LINE_API}/profile/${userId}`, {
      headers: { "Authorization": `Bearer ${channelToken}` },
    });
    if (!res.ok) return {};
    const j = await res.json();
    return { display_name: j.displayName, avatar_url: j.pictureUrl };
  } catch { return {}; }
}

/** ดาวน์โหลดรูป/ไฟล์ที่ลูกค้าส่ง (เช่น สลิป) */
export async function lineGetContent(channelToken: string, messageId: string): Promise<Uint8Array | null> {
  const res = await fetch(`${LINE_DATA}/message/${messageId}/content`, {
    headers: { "Authorization": `Bearer ${channelToken}` },
  });
  if (!res.ok) { console.error("lineGetContent", res.status); return null; }
  return new Uint8Array(await res.arrayBuffer());
}
