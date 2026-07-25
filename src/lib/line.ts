// ============================================================
//  แจ้งเตือนเข้า LINE — รองรับ 2 โหมด
//   1) 'platform' (ค่าเริ่มต้น ใช้ง่ายสุด): ร้านกด "เชื่อมต่อ LINE" ครั้งเดียว
//      ระบบส่งผ่าน OA กลางของแพลตฟอร์ม ร้านไม่ต้องสร้าง OA เอง
//   2) 'own' (ขั้นสูง): ร้านมี LINE OA ของตัวเอง อยากให้ข้อความมาจากแบรนด์ตัวเอง
//  หมายเหตุ: LINE Notify ปิดบริการถาวรแล้ว (มี.ค. 2025) จึงใช้ Messaging API
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";

export interface LineSender { token: string; to: string; source: "platform" | "own" }

/** ดึง token+ปลายทางที่ควรใช้ของร้านนี้ — ไม่มี = null (ยังไม่ได้เชื่อม) */
export async function resolveLineSender(svc: SupabaseClient, shopId: string): Promise<LineSender | null> {
  const { data: s } = await svc.from("shop_notify_settings")
    .select("line_channel_token,line_to_id,notify_approval,link_source").eq("shop_id", shopId).maybeSingle();
  if (!s?.line_to_id || s.notify_approval === false) return null;

  if (s.link_source === "own") {
    return s.line_channel_token ? { token: s.line_channel_token, to: s.line_to_id, source: "own" } : null;
  }
  const { data: pf } = await svc.from("platform_billing_settings").select("line_oa_token").eq("id", true).maybeSingle();
  return pf?.line_oa_token ? { token: pf.line_oa_token, to: s.line_to_id, source: "platform" } : null;
}

/** ยิงข้อความเข้า LINE — คืน {ok, error} ไม่ throw */
export async function pushLineMessage(channelToken: string, to: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Authorization": `Bearer ${channelToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.text()).slice(0, 300);
    console.error("line push failed", res.status, body);
    // 403 = ยังไม่ได้เพิ่มบอทเป็นเพื่อน (เคสที่เจอบ่อยสุด) — บอกให้ผู้ใช้เข้าใจได้เอง
    if (res.status === 403) return { ok: false, error: "ยังไม่ได้เพิ่มบัญชี LINE ของระบบเป็นเพื่อน — เพิ่มเพื่อนแล้วลองใหม่อีกครั้ง" };
    return { ok: false, error: `ส่งไม่สำเร็จ (${res.status})` };
  } catch (e) {
    console.error("line push error", (e as Error).message);
    return { ok: false, error: "เชื่อมต่อ LINE ไม่ได้ ลองใหม่อีกครั้ง" };
  }
}

/** แจ้งเตือนกิจการ (ถ้าเชื่อมไว้) — เงียบเสมอ ห้ามทำให้งานบัญชีล้ม */
export async function notifyShopLine(svc: SupabaseClient, shopId: string, text: string): Promise<void> {
  try {
    const sender = await resolveLineSender(svc, shopId);
    if (!sender) return;
    await pushLineMessage(sender.token, sender.to, text);
  } catch { /* แจ้งเตือนพังไม่กระทบงานบัญชี */ }
}
