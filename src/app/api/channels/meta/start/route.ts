import { NextResponse } from "next/server";
import { assertMember } from "@/lib/shop";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const shopId = searchParams.get("shop_id");
  if (!shopId) return NextResponse.redirect(`${origin}/dashboard/channels?error=missing_shop`);
  try { await assertMember(shopId, ["owner", "admin"]); }
  catch { return NextResponse.redirect(`${origin}/dashboard/channels?error=forbidden`); }

  const appId = process.env.META_APP_ID;
  if (!appId) return NextResponse.redirect(`${origin}/dashboard/channels?error=META_APP_ID_not_set`);

  const nonce = crypto.randomUUID();
  const redirectUri = `${origin}/api/channels/meta/callback`;
  // ขอเท่าที่ใช้จริงเท่านั้น — ทุก scope ที่ขอต้องโชว์การใช้งานในวิดีโอ review ได้
  // (pages_read_engagement เคยอยู่ในลิสต์แต่ callback ไม่ได้ใช้ — ตัดออก กันตกรีวิว)
  const scope = [
    "pages_show_list", "pages_messaging", "pages_manage_metadata",
    "instagram_basic", "instagram_manage_messages",
    "business_management",
  ].join(",");
  const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&state=${encodeURIComponent(JSON.stringify({ shopId, nonce }))}`
    + `&scope=${encodeURIComponent(scope)}`;

  const res = NextResponse.redirect(url);
  res.cookies.set("meta_oauth_nonce", nonce, { httpOnly: true, secure: true, maxAge: 600, path: "/" });
  return res;
}
