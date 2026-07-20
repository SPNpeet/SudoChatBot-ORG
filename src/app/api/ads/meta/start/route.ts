import { NextResponse } from "next/server";
import { assertMember } from "@/lib/shop";

// เชื่อมบัญชีโฆษณา Meta ของร้าน — แยกเส้นจาก page connect (คนละ scope คนละ review)
// ร้านจ่ายค่าแอดตรงกับ Meta ผ่านบัตรของบัญชีโฆษณาตัวเอง — แพลตฟอร์มไม่แตะเงินค่าแอดเลย
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const shopId = searchParams.get("shop_id");
  if (!shopId) return NextResponse.redirect(`${origin}/dashboard/ads?error=missing_shop`);
  try { await assertMember(shopId, ["owner", "admin"]); }
  catch { return NextResponse.redirect(`${origin}/dashboard/ads?error=forbidden`); }

  const appId = process.env.META_APP_ID;
  if (!appId) return NextResponse.redirect(`${origin}/dashboard/ads?error=META_APP_ID_not_set`);

  const nonce = crypto.randomUUID();
  const redirectUri = `${origin}/api/ads/meta/callback`;
  const scope = ["ads_management", "ads_read"].join(",");
  const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&state=${encodeURIComponent(JSON.stringify({ shopId, nonce }))}`
    + `&scope=${encodeURIComponent(scope)}`;

  const res = NextResponse.redirect(url);
  res.cookies.set("ads_oauth_nonce", nonce, { httpOnly: true, secure: true, maxAge: 600, path: "/" });
  return res;
}
