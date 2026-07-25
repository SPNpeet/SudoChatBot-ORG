// ============================================================
//  Web Push — ช่องทางแจ้งเตือนหลัก (ฟรี ไม่มีเพดานข้อความเหมือน LINE OA)
//  · VAPID key สร้างอัตโนมัติครั้งแรกที่ใช้ แล้วเก็บใน DB — เจ้าของไม่ต้องตั้งค่าอะไร
//  · subscription ที่ตายแล้ว (404/410) ลบทิ้งอัตโนมัติ กันส่งซ้ำเปล่าๆ
//  · ส่งพังห้ามทำให้งานบัญชีล้ม — คืนจำนวนที่ส่งสำเร็จพอ
// ============================================================
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

const CONTACT = "mailto:support@sudochatbot.online";

/** อ่าน VAPID key จาก DB — ยังไม่มีก็สร้างให้เลย (idempotent พอสำหรับงานนี้) */
export async function getVapid(svc: SupabaseClient): Promise<{ publicKey: string; privateKey: string }> {
  const { data } = await svc.from("platform_billing_settings")
    .select("vapid_public_key,vapid_private_key").eq("id", true).maybeSingle();
  if (data?.vapid_public_key && data?.vapid_private_key) {
    return { publicKey: data.vapid_public_key, privateKey: data.vapid_private_key };
  }
  const keys = webpush.generateVAPIDKeys();
  await svc.from("platform_billing_settings").upsert({
    id: true, vapid_public_key: keys.publicKey, vapid_private_key: keys.privateKey, updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  return keys;
}

export interface PushPayload { title: string; body: string; url?: string; tag?: string }

interface SubRow { id: string; endpoint: string; p256dh: string; auth: string }

async function sendToSubs(svc: SupabaseClient, subs: SubRow[], payload: PushPayload): Promise<number> {
  if (!subs.length) return 0;
  const { publicKey, privateKey } = await getVapid(svc);
  webpush.setVapidDetails(CONTACT, publicKey, privateKey);
  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 86400, urgency: "normal" },
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.id);   // ผู้ใช้ถอนสิทธิ์/ลบแอปแล้ว
      else console.error("web push failed", code, (e as Error).message?.slice(0, 120));
    }
  }));

  if (dead.length) await svc.from("push_subscriptions").delete().in("id", dead);
  if (sent) {
    await svc.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() })
      .in("id", subs.filter((s) => !dead.includes(s.id)).map((s) => s.id));
  }
  return sent;
}

/** แจ้งเตือนทุกคนในกิจการ (ทุกอุปกรณ์ที่เปิดไว้) */
export async function pushToShop(svc: SupabaseClient, shopId: string, payload: PushPayload): Promise<number> {
  try {
    const { data } = await svc.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("shop_id", shopId);
    return await sendToSubs(svc, (data ?? []) as SubRow[], payload);
  } catch (e) {
    console.error("pushToShop error", (e as Error).message);
    return 0;
  }
}

/** ประกาศถึงผู้ใช้ทุกคนในระบบ (ใช้ตอนระบบขัดข้อง/ปิดปรับปรุง) */
export async function pushToEveryone(svc: SupabaseClient, payload: PushPayload): Promise<number> {
  try {
    const { data } = await svc.from("push_subscriptions").select("id,endpoint,p256dh,auth");
    return await sendToSubs(svc, (data ?? []) as SubRow[], payload);
  } catch (e) {
    console.error("pushToEveryone error", (e as Error).message);
    return 0;
  }
}
