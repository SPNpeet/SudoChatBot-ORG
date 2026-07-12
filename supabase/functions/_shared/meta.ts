// ==== Meta Graph API (Facebook Messenger + Instagram DM) ====
import { OutMessage } from "./types.ts";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function metaSend(
  pageToken: string,
  recipientId: string,
  messages: OutMessage[],
): Promise<{ ok: boolean; error?: string }> {
  for (const m of messages) {
    const body: Record<string, unknown> = {
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: m.type === "text"
        ? { text: m.text.slice(0, 1990) }
        : { attachment: { type: "image", payload: { url: m.url, is_reusable: false } } },
    };
    const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(pageToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("metaSend fail", res.status, err);
      return { ok: false, error: `meta ${res.status}: ${err.slice(0, 300)}` };
    }
  }
  return { ok: true };
}

/** โปรไฟล์ลูกค้า (ชื่อ/รูป) */
export async function metaProfile(pageToken: string, psid: string): Promise<{ display_name?: string; avatar_url?: string }> {
  try {
    const res = await fetch(`${GRAPH}/${psid}?fields=name,profile_pic&access_token=${encodeURIComponent(pageToken)}`);
    if (!res.ok) return {};
    const j = await res.json();
    return { display_name: j.name, avatar_url: j.profile_pic };
  } catch { return {}; }
}

/** แลก short-lived user token -> long-lived + ดึงเพจทั้งหมด (ใช้ตอนเชื่อมต่อช่องทาง) */
export async function metaExchangeAndListPages(userToken: string): Promise<{
  pages: { id: string; name: string; access_token: string; platform: "facebook" }[];
  error?: string;
}> {
  const appId = Deno.env.get("META_APP_ID")!;
  const appSecret = Deno.env.get("META_APP_SECRET")!;
  const ex = await fetch(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(userToken)}`,
  );
  if (!ex.ok) return { pages: [], error: await ex.text() };
  const { access_token: longToken } = await ex.json();
  const res = await fetch(`${GRAPH}/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(longToken)}`);
  if (!res.ok) return { pages: [], error: await res.text() };
  const j = await res.json();
  return {
    pages: (j.data ?? []).map((p: Record<string, string>) => ({
      id: p.id, name: p.name, access_token: p.access_token, platform: "facebook" as const,
    })),
  };
}
