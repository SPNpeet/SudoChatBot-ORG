// ============================================================
//  ศูนย์กลางการแจ้งเตือน — ยิงออกทุกช่องทางที่ผู้ใช้เปิดไว้พร้อมกัน
//   · LINE (ช่องหลักของลูกค้าไทย — เห็นแน่นอนที่สุด)
//   · Web Push (ฟรี ไม่มีเพดาน เข้าถึงได้แม้ไม่ได้เชื่อม LINE)
//  ใช้ที่เดียวทั้งระบบ เพิ่มช่องทางใหม่ทีหลังก็แก้แค่ไฟล์นี้
//  กติกา: แจ้งเตือนพังห้ามทำให้งานบัญชีล้ม — จับ error ทุกชั้น
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyShopLine, pushLineMessage, resolveLineSender } from "./line";
import { pushToShop, pushToEveryone, type PushPayload } from "./push";

export interface NotifyInput {
  title: string;          // หัวข้อสั้นๆ (ขึ้นบน notification)
  body: string;           // รายละเอียด
  url?: string;           // กดแล้วเปิดหน้าไหน
  tag?: string;           // กันเด้งซ้ำเรื่องเดิม
}

/** แจ้งเตือนกิจการหนึ่ง — LINE + Web Push พร้อมกัน */
export async function notifyShop(svc: SupabaseClient, shopId: string, n: NotifyInput): Promise<void> {
  const url = n.url ? (n.url.startsWith("http") ? n.url : `https://sudochatbot.online${n.url}`) : undefined;
  await Promise.allSettled([
    notifyShopLine(svc, shopId, `${n.title}\n${n.body}${url ? `\n${url}` : ""}`),
    pushToShop(svc, shopId, { title: n.title, body: n.body, url: n.url, tag: n.tag } as PushPayload),
  ]);
}

/** ประกาศถึงทุกกิจการ (ระบบขัดข้อง/ปิดปรับปรุง/ฟีเจอร์ใหม่) — คืนจำนวนที่ส่งถึง */
export async function notifyEveryone(svc: SupabaseClient, n: NotifyInput): Promise<{ push: number; line: number }> {
  const url = n.url ? (n.url.startsWith("http") ? n.url : `https://sudochatbot.online${n.url}`) : undefined;
  const text = `${n.title}\n${n.body}${url ? `\n${url}` : ""}`;

  const pushCount = await pushToEveryone(svc, { title: n.title, body: n.body, url: n.url, tag: n.tag } as PushPayload);

  // LINE: ยิงทีละกิจการที่เชื่อมไว้ (คนละ token/ปลายทางกัน)
  let lineCount = 0;
  try {
    const { data: shops } = await svc.from("shop_notify_settings").select("shop_id").not("line_to_id", "is", null);
    await Promise.allSettled((shops ?? []).map(async (s) => {
      const sender = await resolveLineSender(svc, s.shop_id as string);
      if (!sender) return;
      const r = await pushLineMessage(sender.token, sender.to, text);
      if (r.ok) lineCount++;
    }));
  } catch (e) {
    console.error("notifyEveryone line error", (e as Error).message);
  }
  return { push: pushCount, line: lineCount };
}
