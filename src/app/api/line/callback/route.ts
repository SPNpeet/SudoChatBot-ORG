import { NextResponse } from "next/server";
import { handleLineLoginCallback } from "@/lib/line-login-flow";
import { createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { pushLineMessage } from "@/lib/line";
import { signState } from "@/lib/line-state";
import { APP_ORIGIN, LINE_CALLBACK_URL } from "@/lib/app-origin";

// ============================================================
//  LINE Login กลับมา -> แลก code เป็น userId แล้วผูกกับกิจการ
//  แล้วยิงข้อความต้อนรับทันที เพื่อ "พิสูจน์ว่าใช้ได้จริง" ในจังหวะเดียว
//  (ไม่ต้องให้ผู้ใช้ไปกดปุ่มทดสอบเองอีกที)
// ============================================================

export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/dashboard/settings?line=${q}`, APP_ORIGIN));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";

  // ⚠️ เส้นนี้เป็น callback เดียวที่ลงทะเบียนไว้ในคอนโซล LINE จึงรับสองงาน
  // แยกด้วย state: ล็อกอินใช้ UUID ที่ต้องตรงกับคุกกี้ line_oauth_state เป๊ะ
  // ส่วนการผูก OA ใช้ shopId.nonce.signature ซึ่งมีจุดคั่นและลายเซ็น
  // เงื่อนไขนี้แคบมากโดยตั้งใจ ไม่เข้าเงื่อนไขเมื่อไหร่ = ทำงานเหมือนเดิมทุกบรรทัด
  {
    const savedState = request.headers.get("cookie")?.match(/(?:^|;\s*)line_oauth_state=([^;]+)/)?.[1];
    if (savedState && state && savedState === state && !state.includes(".")) {
      return handleLineLoginCallback(request, LINE_CALLBACK_URL);
    }
  }

  if (url.searchParams.get("error")) return back("cancelled");
  const [shopId, nonce, sig] = state.split(".");
  if (!code || !shopId || !nonce || sig !== signState(`${shopId}.${nonce}`)) return back("bad_state");

  try {
    await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    const { data: pf } = await svc.from("platform_billing_settings")
      .select("line_login_channel_id,line_login_channel_secret,line_oa_token").eq("id", true).maybeSingle();
    if (!pf?.line_login_channel_id || !pf?.line_login_channel_secret) return back("not_configured");

    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: LINE_CALLBACK_URL,
        client_id: pf.line_login_channel_id,
        client_secret: pf.line_login_channel_secret,
      }),
    });
    if (!tokenRes.ok) {
      console.error("line token exchange failed", tokenRes.status, (await tokenRes.text()).slice(0, 200));
      return back("token_failed");
    }
    const tok = await tokenRes.json() as { access_token?: string; friendship_status_changed?: boolean };
    if (!tok.access_token) return back("token_failed");

    const profRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (!profRes.ok) return back("profile_failed");
    const prof = await profRes.json() as { userId?: string; displayName?: string };
    if (!prof.userId) return back("profile_failed");

    await svc.from("shop_notify_settings").upsert({
      shop_id: shopId,
      line_to_id: prof.userId,
      line_display_name: prof.displayName ?? null,
      link_source: "platform",
      notify_approval: true,
      linked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "shop_id" });

    // ทักทายทันที = ผู้ใช้เห็นกับตาว่าเชื่อมสำเร็จจริง (ถ้ายังไม่ได้เพิ่มเพื่อนจะได้รู้ตรงนี้เลย)
    if (pf.line_oa_token) {
      const r = await pushLineMessage(pf.line_oa_token, prof.userId,
        "เชื่อมต่อ SudoChatBot สำเร็จแล้ว\nจากนี้ระบบจะแจ้งเตือนเรื่องสำคัญ เช่น ค่าใช้จ่ายรออนุมัติ มาที่แชทนี้ค่ะ");
      if (!r.ok) return back("need_friend");
    }
    return back("ok");
  } catch (e) {
    console.error("line callback error", (e as Error).message);
    return back("failed");
  }
}
