// ==== TikTok Business Messaging API ====
// หมายเหตุ: ต้องเป็น TikTok Business Messaging partner ก่อนใช้งานจริง
// (สมัคร developers.tiktok.com → Business Messaging API access)
import { OutMessage } from "./types.ts";

const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";

/** ตรวจลายเซ็น webhook: header TikTok-Signature = "t=<timestamp>,s=<hex hmac-sha256(client_secret, t + '.' + rawBody)>" */
export async function tiktokVerifySignature(clientSecret: string, header: string, rawBody: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = parts["t"]; const s = parts["s"];
  if (!t || !s) return false;
  // กัน replay: timestamp ต้องไม่เก่ากว่า 5 นาที
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(clientSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${rawBody}`));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== s.length) return false;
  let out = 0;
  for (let i = 0; i < expected.length; i++) out |= expected.charCodeAt(i) ^ s.charCodeAt(i);
  return out === 0;
}

/** ส่งข้อความหาลูกค้าผ่าน Business Messaging (token ของร้านจาก Vault) */
export async function tiktokSend(
  accessToken: string,
  businessId: string,
  userId: string,
  messages: OutMessage[],
): Promise<{ ok: boolean; error?: string }> {
  for (const m of messages.slice(0, 5)) {
    const body = m.type === "text"
      ? { business_id: businessId, recipient_id: userId, message: { type: "text", text: m.text.slice(0, 4990) } }
      : { business_id: businessId, recipient_id: userId, message: { type: "image", image_url: m.url } };
    const res = await fetch(`${TIKTOK_API}/business/message/send/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": accessToken },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || (j as { code?: number }).code !== 0) {
      const err = JSON.stringify(j).slice(0, 300);
      console.error("tiktokSend fail", res.status, err);
      return { ok: false, error: `tiktok ${res.status}: ${err}` };
    }
  }
  return { ok: true };
}
