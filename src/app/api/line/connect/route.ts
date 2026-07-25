import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { signState } from "@/lib/line-state";
import { APP_ORIGIN, LINE_CALLBACK_URL } from "@/lib/app-origin";

// ============================================================
//  เริ่มเชื่อม LINE แบบคลิกเดียว — พาไปหน้า LINE Login ของแพลตฟอร์ม
//  bot_prompt=aggressive = ให้ LINE ชวนเพิ่มเพื่อน OA ในขั้นตอนเดียวกัน
//  (ไม่เพิ่มเพื่อน = push ไม่ได้ 403 — จึงต้องรวบให้จบในจังหวะเดียว)
//  state = shopId.nonce.signature — กัน CSRF และกันสลับร้าน
// ============================================================

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shopId = url.searchParams.get("shop_id") ?? "";
  const back = "/dashboard/settings";
  try {
    if (!shopId) return NextResponse.redirect(new URL(`${back}?line=bad_request`, APP_ORIGIN));
    await assertMember(shopId, ["owner", "admin"]);

    const svc = createServiceClient();
    const { data: pf } = await svc.from("platform_billing_settings")
      .select("line_login_channel_id,line_oa_token").eq("id", true).maybeSingle();
    if (!pf?.line_login_channel_id || !pf?.line_oa_token) {
      return NextResponse.redirect(new URL(`${back}?line=not_configured`, APP_ORIGIN));
    }

    const nonce = randomBytes(8).toString("hex");
    const raw = `${shopId}.${nonce}`;
    const state = `${raw}.${signState(raw)}`;

    const auth = new URL("https://access.line.me/oauth2/v2.1/authorize");
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("client_id", pf.line_login_channel_id);
    auth.searchParams.set("redirect_uri", LINE_CALLBACK_URL);
    auth.searchParams.set("state", state);
    auth.searchParams.set("scope", "profile openid");
    auth.searchParams.set("bot_prompt", "aggressive");
    return NextResponse.redirect(auth.toString());
  } catch {
    return NextResponse.redirect(new URL(`${back}?line=forbidden`, APP_ORIGIN));
  }
}
