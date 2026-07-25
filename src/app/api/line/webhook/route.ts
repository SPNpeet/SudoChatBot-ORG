import { NextResponse, after } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { APP_ORIGIN } from "@/lib/app-origin";

// ============================================================
//  Webhook ของ LINE OA — คุมข้อความทางการทั้งหมดจากโค้ด (ไม่ต้องพิมพ์ในหน้า OA Manager)
//   · follow    = เพิ่มเพื่อน -> ข้อความต้อนรับ + วิธีเริ่มใช้
//   · message   = ตอบกลับแบบมีประโยชน์ แยกกรณีเชื่อมบัญชีแล้ว/ยังไม่เชื่อม
//   · unfollow  = บล็อก/ลบเพื่อน -> ตัดการเชื่อมของกิจการนั้น จะได้ไม่ยิงข้อความทิ้งเปล่า
//
//  ⚡ สำคัญ: LINE รอคำตอบแค่ระดับวินาที ถ้าช้าจะขึ้น REQUEST_TIMEOUT แล้ว retry รัว
//  (เจอจริงตอนทดสอบ: อ่าน DB ก่อนตอบ + cold start = timeout)
//  จึงตอบ 200 ทันที แล้วยกงานทั้งหมดไปทำใน after() หลังส่ง response ไปแล้ว
//
//  ความปลอดภัย: ยังตรวจลายเซ็น x-line-signature เหมือนเดิม แค่ย้ายไปตรวจใน after()
//  — ไม่ผ่าน = ไม่ประมวลผลอะไรเลย ผู้โจมตีจึงไม่ได้อะไรจากการยิงมั่ว
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** cache config ระดับโมดูล — invocation ที่ยัง warm อยู่ไม่ต้องวิ่ง DB ซ้ำ */
let cachedCfg: { token: string; secret: string; at: number } | null = null;
const CFG_TTL = 5 * 60_000;

async function getCfg(force = false) {
  if (!force && cachedCfg && Date.now() - cachedCfg.at < CFG_TTL) return cachedCfg;
  const { data } = await createServiceClient()
    .from("platform_billing_settings").select("line_oa_token,line_oa_channel_secret").eq("id", true).maybeSingle();
  if (!data?.line_oa_token || !data?.line_oa_channel_secret) return null;
  cachedCfg = { token: data.line_oa_token, secret: data.line_oa_channel_secret, at: Date.now() };
  return cachedCfg;
}

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

async function handle(raw: string, signature: string | null) {
  let cfg = await getCfg();
  if (!cfg) return;                                   // ยังไม่ตั้งค่า — เงียบไว้
  if (!verify(raw, signature, cfg.secret)) {
    // ลายเซ็นไม่ผ่านอาจเพราะเพิ่ง rotate secret แล้ว cache ยังเป็นตัวเก่า — โหลดใหม่ลองอีกรอบ
    // (ไม่งั้นหลัง rotate ระบบจะเงียบไปจนกว่า cache หมดอายุ)
    cfg = await getCfg(true);
    if (!cfg || !verify(raw, signature, cfg.secret)) {
      console.warn("line webhook: bad signature — ไม่ประมวลผล");
      return;
    }
  }
  const { events } = JSON.parse(raw || "{}") as { events?: LineEvent[] };
  if (!events?.length) return;                        // test ping ของ LINE ไม่มี event

  const svc = createServiceClient();
  await Promise.allSettled(events.map(async (ev) => {
    const uid = ev.source?.userId;

    if (ev.type === "follow" && ev.replyToken) {
      await reply(cfg.token, ev.replyToken, WELCOME);
      return;
    }
    if (ev.type === "unfollow" && uid) {
      await svc.from("shop_notify_settings")
        .update({ line_to_id: null, line_display_name: null, linked_at: null, updated_at: new Date().toISOString() })
        .eq("line_to_id", uid).eq("link_source", "platform");
      return;
    }
    if (ev.type === "message" && ev.replyToken) {
      const text = (ev.message?.text ?? "").trim();
      let linked = false;
      if (uid) {
        const { data } = await svc.from("shop_notify_settings").select("shop_id").eq("line_to_id", uid).maybeSingle();
        linked = !!data;
      }
      const body = /ช่วย|help|เมนู|เริ่ม|ทำอะไร/i.test(text) || !text
        ? HELP
        : linked
          ? `รับข้อความแล้วครับ 🙌\nงานบัญชีสั่งได้ที่ผู้ช่วย AI ในระบบ (ตอบละเอียดกว่าและลงบัญชีให้จริง)\n${APP_ORIGIN}/dashboard/assistant\n\nพิมพ์ "เมนู" เพื่อดูทางลัดทั้งหมด`
          : `สวัสดีครับ 🙌\nแชทนี้ใช้แจ้งเตือนเรื่องสำคัญจากระบบบัญชี SudoChatBot\n\nยังไม่ได้เชื่อมบัญชีใช่ไหมครับ — เข้า ${APP_ORIGIN}/dashboard/settings แล้วกด "เชื่อมต่อ LINE" ครั้งเดียวจบ\n\nพิมพ์ "เมนู" เพื่อดูทางลัด`;
      await reply(cfg.token, ev.replyToken, body);
    }
  }));
}

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-line-signature");
  // ตอบ LINE ก่อนเลย แล้วค่อยทำงานจริงหลังส่ง response (กัน REQUEST_TIMEOUT + retry ถล่ม)
  after(async () => {
    try { await handle(raw, signature); }
    catch (e) { console.error("line webhook error", (e as Error).message); }
  });
  return new NextResponse(null, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ ok: true, note: "LINE webhook endpoint" });
}
