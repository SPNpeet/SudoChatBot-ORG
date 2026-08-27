import { NextResponse } from "next/server";
import { getLineLoginKeys } from "@/lib/line-login";

// ============================================================
//  เริ่ม LINE Login (OAuth 2.1 ของ LINE) — Supabase ไม่รองรับ LINE ตรง จึงทำเอง
//  ด่านความปลอดภัย: state สุ่มเก็บใน httpOnly cookie แล้วตรวจกลับที่ callback (กัน CSRF)
//  ไม่มี env = เด้งกลับหน้า login พร้อมข้อความ ไม่พังอะไร
// ============================================================
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  // คีย์มาจากที่เดียวกับเส้น /api/line/* — env มาก่อน แล้วค่อยถอยไปอ่านจากหน้าแอดมิน
  const keys = await getLineLoginKeys();
  if (!keys) {
    return NextResponse.redirect(new URL("/login?line_error=unavailable", origin));
  }
  const channelId = keys.channelId;

  const state = crypto.randomUUID();
  const auth = new URL("https://access.line.me/oauth2/v2.1/authorize");
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("client_id", channelId);
  auth.searchParams.set("redirect_uri", `${origin}/api/auth/line/callback`);
  auth.searchParams.set("state", state);
  // email ขอไว้ด้วย — LINE จะให้ก็ต่อเมื่อ channel ผ่านการขอสิทธิ์ email ไม่ให้ก็ยังล็อกอินได้
  auth.searchParams.set("scope", "profile openid email");

  const res = NextResponse.redirect(auth);
  res.cookies.set("line_oauth_state", state, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/",
  });
  return res;
}
