import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/shop";
import { getVapid } from "@/lib/push";

// ============================================================
//  ลงทะเบียน/ถอนอุปกรณ์รับแจ้งเตือน Web Push
//  GET  = ขอ public key ไปใช้ subscribe (สร้างอัตโนมัติครั้งแรก)
//  POST = บันทึก subscription · DELETE = ถอนออก
// ============================================================

export async function GET() {
  try {
    await requireUser();
    const { publicKey } = await getVapid(createServiceClient());
    return NextResponse.json({ ok: true, publicKey });
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const { subscription, shop_id } = await request.json() as {
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      shop_id?: string;
    };
    const ep = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!ep || !p256dh || !auth) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ครบ" }, { status: 400 });

    const svc = createServiceClient();
    // ⚠️ ต้องตรวจว่าเป็นสมาชิกกิจการนั้นจริง — เดิมรับ shop_id จาก body ตรง ๆ
    // ใครที่ล็อกอินอยู่และรู้ UUID ของกิจการอื่น สมัครรับแจ้งเตือนของกิจการนั้นได้
    // แล้วจะได้รับสรุปรายสัปดาห์ซึ่งมี "ยอดค้างรับรวม / ใบเกินกำหนด / ภาษีที่ต้องนำส่ง" ของเขา
    if (shop_id) {
      const { data: mem, error: memErr } = await svc.from("shop_members")
        .select("user_id").eq("shop_id", shop_id).eq("user_id", user.id).maybeSingle();
      if (memErr || !mem) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    // ผูก endpoint กับเจ้าของเดิมเสมอ — กันเขียนทับแถวของคนอื่นด้วย endpoint ที่รู้มา
    const { data: existing } = await svc.from("push_subscriptions")
      .select("user_id").eq("endpoint", ep).maybeSingle();
    if (existing && existing.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const { error } = await svc.from("push_subscriptions").upsert({
      user_id: user.id,
      shop_id: shop_id ?? null,
      endpoint: ep, p256dh, auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
    }, { onConflict: "endpoint" });
    if (error) return NextResponse.json({ ok: false, error: "บันทึกไม่สำเร็จ" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireUser();
    const { endpoint } = await request.json() as { endpoint?: string };
    if (!endpoint) return NextResponse.json({ ok: false }, { status: 400 });
    // ลบได้เฉพาะของตัวเอง — เดิมลบด้วย endpoint อย่างเดียว ใครรู้ endpoint ของคนอื่นก็ถอนให้เขาได้
    await createServiceClient().from("push_subscriptions").delete()
      .eq("endpoint", endpoint).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
