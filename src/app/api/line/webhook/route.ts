import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { APP_ORIGIN } from "@/lib/app-origin";

// ============================================================
//  Webhook ของ LINE OA — คุมข้อความทางการทั้งหมดจากโค้ด (ไม่ต้องไปพิมพ์ในหน้า OA Manager)
//   · follow    = คนเพิ่มเพื่อน -> ส่งข้อความต้อนรับ + บอกวิธีเริ่มใช้
//   · message   = ตอบกลับอัตโนมัติแบบมีประโยชน์ (ไม่ใช่ "ขอบคุณสำหรับข้อความ" ลอยๆ)
//   · unfollow  = บล็อก/ลบเพื่อน -> ตัดการเชื่อมของกิจการนั้น จะได้ไม่ยิงข้อความทิ้งเปล่าๆ
//  ความปลอดภัย: ตรวจลายเซ็น x-line-signature ทุกครั้ง ไม่ผ่าน = 401 (กันคนปลอม event)
// ============================================================

export const maxDuration = 30;

const HELP = [
  "พิมพ์คุยที่นี่ได้เลย หรือกดเมนูด้านล่างเพื่อเข้าใช้งานระบบครับ",
  "",
  "เมนูลัด",
  "• ผู้ช่วยบัญชี AI — สั่งงานเป็นภาษาคน",
  "• ถ่ายรูปบิล — ให้ AI อ่านแล้วลงบัญชีให้",
  "• ออกเอกสาร — ใบแจ้งหนี้ / ใบเสร็จ",
  "• ยอดค้าง — ดูว่าใครค้างเรา เราค้างใคร",
  "",
  `เปิดระบบ: ${APP_ORIGIN}/dashboard`,
].join("\n");

const WELCOME = [
  "ยินดีต้อนรับสู่ SudoChatBot 🎉",
  "ระบบบัญชี + ผู้ช่วย AI สำหรับธุรกิจไทย",
  "",
  "จากนี้เราจะแจ้งเรื่องสำคัญมาที่แชทนี้ เช่น เอกสารรออนุมัติ และประกาศสถานะระบบ",
  "",
  "เริ่มใช้งาน",
  `1) เข้าระบบที่ ${APP_ORIGIN}`,
  "2) ไปที่ ตั้งค่า → การแจ้งเตือน → กด \"เชื่อมต่อ LINE\"",
  "3) เสร็จแล้วกดเมนูด้านล่างใช้งานได้ทันที",
].join("\n");

function verify(bodyRaw: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(bodyRaw).digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function reply(token: string, replyToken: string, text: string) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
  });
  if (!res.ok) console.error("line reply failed", res.status, (await res.text()).slice(0, 200));
}

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type?: string; text?: string };
}

export async function POST(request: Request) {
  const raw = await request.text();
  try {
    const svc = createServiceClient();
    const { data: pf } = await svc.from("platform_billing_settings")
      .select("line_oa_token,line_oa_channel_secret").eq("id", true).maybeSingle();
    if (!pf?.line_oa_channel_secret || !pf?.line_oa_token) {
      return NextResponse.json({ ok: true });   // ยังไม่ตั้งค่า — ตอบ 200 ไม่ให้ LINE retry รัว
    }
    if (!verify(raw, request.headers.get("x-line-signature"), pf.line_oa_channel_secret)) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const { events } = JSON.parse(raw || "{}") as { events?: LineEvent[] };
    const token = pf.line_oa_token;

    await Promise.allSettled((events ?? []).map(async (ev) => {
      const uid = ev.source?.userId;

      if (ev.type === "follow" && ev.replyToken) {
        await reply(token, ev.replyToken, WELCOME);
        return;
      }

      if (ev.type === "unfollow" && uid) {
        // บล็อก/ลบเพื่อนแล้ว = ส่งไปก็ไม่ถึง ตัดการเชื่อมทิ้งเพื่อไม่ให้ระบบยิงเปล่า
        await svc.from("shop_notify_settings")
          .update({ line_to_id: null, line_display_name: null, linked_at: null, updated_at: new Date().toISOString() })
          .eq("line_to_id", uid).eq("link_source", "platform");
        return;
      }

      if (ev.type === "message" && ev.replyToken) {
        const text = (ev.message?.text ?? "").trim();
        // ถ้ายังไม่ได้เชื่อมบัญชี บอกวิธีเชื่อมก่อน (คำถามที่เจอบ่อยที่สุด)
        let linked = false;
        if (uid) {
          const { data } = await svc.from("shop_notify_settings").select("shop_id").eq("line_to_id", uid).maybeSingle();
          linked = !!data;
        }
        const body = /ช่วย|help|เมนู|เริ่ม|ทำอะไร/i.test(text) || !text
          ? HELP
          : linked
            ? `รับข้อความแล้วครับ 🙌\nงานบัญชีสั่งได้ที่ผู้ช่วย AI ในระบบ (ตอบได้ละเอียดกว่าและลงบัญชีให้จริง)\n${APP_ORIGIN}/dashboard/assistant\n\nพิมพ์ "เมนู" เพื่อดูทางลัดทั้งหมด`
            : `สวัสดีครับ 🙌\nแชทนี้ใช้แจ้งเตือนเรื่องสำคัญจากระบบบัญชี SudoChatBot\n\nยังไม่ได้เชื่อมบัญชีใช่ไหมครับ — เข้า ${APP_ORIGIN}/dashboard/settings แล้วกด "เชื่อมต่อ LINE" ครั้งเดียวจบ\n\nพิมพ์ "เมนู" เพื่อดูทางลัด`;
        await reply(token, ev.replyToken, body);
      }
    }));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("line webhook error", (e as Error).message);
    return NextResponse.json({ ok: true });   // ห้ามตอบ error ให้ LINE retry ถล่ม
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, note: "LINE webhook endpoint" });
}
