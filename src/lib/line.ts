// ============================================================
//  แจ้งเตือนเข้า LINE ของกิจการ — ใช้ LINE Messaging API (push)
//  หมายเหตุ: LINE Notify ปิดบริการถาวรแล้ว (มี.ค. 2025) จึงใช้
//  Channel access token ของ LINE Official Account แทน
//  token เก็บใน shop_notify_settings (RLS ไม่มี policy = service role เท่านั้น)
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";

/** ยิงข้อความเข้า LINE — คืน true/false ไม่ throw */
export async function pushLineMessage(channelToken: string, to: string, text: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Authorization": `Bearer ${channelToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
    });
    if (!res.ok) console.error("line push failed", res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (e) {
    console.error("line push error", (e as Error).message);
    return false;
  }
}

/** แจ้งเตือนกิจการ (ถ้าตั้งค่าไว้) — เงียบเสมอ ห้ามทำให้งานหลักล้ม */
export async function notifyShopLine(svc: SupabaseClient, shopId: string, text: string): Promise<void> {
  try {
    const { data: s } = await svc.from("shop_notify_settings")
      .select("line_channel_token,line_to_id,notify_approval").eq("shop_id", shopId).maybeSingle();
    if (!s?.line_channel_token || !s?.line_to_id) return;
    if (s.notify_approval === false) return; // ผู้ใช้ปิดแจ้งเตือนไว้
    await pushLineMessage(s.line_channel_token, s.line_to_id, text);
  } catch { /* แจ้งเตือนพังไม่กระทบงานบัญชี */ }
}
