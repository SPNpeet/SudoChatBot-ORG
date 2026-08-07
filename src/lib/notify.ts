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

/**
 * แจ้งเตือนกิจการหนึ่ง — กล่องในระบบ + LINE + Web Push พร้อมกัน
 *
 * ⚠️ เดิมส่งแค่ LINE กับ Web Push ไม่ได้เขียนลงตาราง notifications เลย
 * พบ 6 ส.ค. 2569 ตอนยิงสลิปทดสอบผ่านเส้นทาง manual จริง แล้ววัดพบว่า
 * ไฟล์แนบเข้าเรียบร้อย แต่ notifications = 0 แถว
 *
 * ผลจริง: ร้านที่ยังไม่ได้เชื่อม LINE และยังไม่ได้กดอนุญาต Web Push
 * (ซึ่งคือร้านส่วนใหญ่ เพราะทั้งสองอย่างต้องไปตั้งค่าเอง) **ไม่ได้รับอะไรเลยสักช่องทาง**
 * ทั้งที่หน้าแดชบอร์ดมีกล่องแจ้งเตือนอยู่แล้ว แต่ไม่เคยมีใครเขียนลงไป
 *
 * เรื่องที่ส่งผ่านทางนี้คือเรื่องที่ "มีคนรออยู่" — ลูกค้าส่งสลิปมา / ระบบตรวจสลิปล่ม
 * เงียบตรงนี้แปลว่าลูกค้าของร้านโอนเงินไปแล้วแต่ไม่มีใครมาดู
 *
 * กติกา: กล่องในระบบต้องเขียนเสมอ เพราะเป็นช่องทางเดียวที่ไม่ต้องตั้งค่าอะไรก่อน
 * LINE/Push เป็นของเสริมที่เร็วกว่า — ช่องไหนล้มก็ต้องไม่ทำให้ช่องอื่นล้มตาม
 */
export async function notifyShop(svc: SupabaseClient, shopId: string, n: NotifyInput): Promise<void> {
  const url = n.url ? (n.url.startsWith("http") ? n.url : `https://sudochatbot.online${n.url}`) : undefined;
  await Promise.allSettled([
    svc.from("notifications").insert({
      shop_id: shopId,
      type: "system",
      title: n.title.slice(0, 200),
      body: `${n.body}${url ? `\n${url}` : ""}`.slice(0, 1000),
    }),
    notifyShopLine(svc, shopId, `${n.title}\n${n.body}${url ? `\n${url}` : ""}`),
    pushToShop(svc, shopId, { title: n.title, body: n.body, url: n.url, tag: n.tag } as PushPayload),
  ]);
}

/**
 * แจ้งผู้ดูแลแพลตฟอร์ม (เจ้าของระบบ) — ใช้กับเรื่องที่ "มีคนรอเราอยู่"
 *
 * ทำไมต้องมี: 4 ส.ค. 2569 พบว่าตอนลูกค้าอัปสลิปจ่ายค่าแพ็กเกจแล้วระบบตรวจอัตโนมัติ
 * ไม่ได้เปิดใช้ รายการจะไปกองรออนุมัติมือ **โดยไม่มีการแจ้งใครเลย**
 * เจ้าของไม่มีทางรู้ว่ามีคนถือเงินรออยู่ คนจ่ายตอนกลางคืนจึงต้องรอถึงเช้า แล้วเลิกสนใจ
 * นี่คือด่านสุดท้ายของทางจ่ายเงินที่ลูกค้าคุมไม่ได้เลย — เงียบตรงนี้ = เสียลูกค้าที่ตั้งใจจ่ายแล้ว
 *
 * ส่งเข้าช่องทางของ "กิจการที่ผู้ดูแลเป็นเจ้าของ" เพราะการเชื่อม LINE/Push ผูกกับกิจการ ไม่ได้ผูกกับคน
 */
export async function notifyPlatformAdmins(svc: SupabaseClient, n: NotifyInput): Promise<void> {
  try {
    const { data: admins } = await svc.from("platform_admins").select("user_id");
    const ids = (admins ?? []).map((a) => a.user_id as string).filter(Boolean);
    if (!ids.length) return;
    const { data: shops } = await svc.from("shop_members")
      .select("shop_id").in("user_id", ids).eq("role", "owner");
    const targets = [...new Set((shops ?? []).map((s) => s.shop_id as string))];
    await Promise.allSettled(targets.map((shopId) => notifyShop(svc, shopId, n)));
  } catch (e) {
    // แจ้งเตือนพังห้ามทำให้การรับเงินล้ม — ลูกค้าต้องจ่ายได้เสมอแม้เราไม่รู้เรื่อง
    console.error("notifyPlatformAdmins error", (e as Error).message);
  }
}

/** ประกาศถึงทุกกิจการ (ระบบขัดข้อง/ปิดปรับปรุง/ฟีเจอร์ใหม่) — คืนจำนวนที่ส่งถึง */
export async function notifyEveryone(svc: SupabaseClient, n: NotifyInput): Promise<{ push: number; line: number }> {
  const url = n.url ? (n.url.startsWith("http") ? n.url : `https://sudochatbot.online${n.url}`) : undefined;
  const text = `${n.title}\n${n.body}${url ? `\n${url}` : ""}`;

  // ⚠️ ประกาศถึงทุกกิจการก็ต้องลงกล่องในระบบด้วย (แก้ 6 ส.ค. 2569 พร้อมกับ notifyShop)
  // เหตุผลเดียวกัน: ร้านที่ไม่ได้ต่อ LINE และไม่ได้เปิด Push จะไม่เห็นประกาศเลย
  // เขียนรวดเดียวด้วย insert หลายแถว (ไม่ใช่ยิงทีละร้าน) เพราะประกาศมีไม่บ่อย
  // แต่จำนวนร้านโตได้เรื่อย ๆ — ยิงทีละแถวจะกลายเป็นภาระตอนมีร้านหลักพัน
  try {
    const { data: allShops } = await svc.from("shops").select("id").eq("status", "active");
    const rows = (allShops ?? []).map((s) => ({
      shop_id: s.id as string,
      type: "system",
      title: n.title.slice(0, 200),
      body: `${n.body}${url ? `\n${url}` : ""}`.slice(0, 1000),
    }));
    if (rows.length) await svc.from("notifications").insert(rows);
  } catch (e) {
    console.error("notifyEveryone inbox error", (e as Error).message);
  }

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
