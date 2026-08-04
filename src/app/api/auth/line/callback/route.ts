import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// ============================================================
//  ปลายทาง LINE Login — แลก code เป็น id_token, ตรวจกับ LINE, แล้วพาเข้าระบบ
//
//  ทำไมถึงหน้าตาแบบนี้:
//  · Supabase ไม่มี LINE provider — สร้าง/ค้นผู้ใช้ผ่าน admin API เอง
//  · อีเมล alias คงที่ line-{userId}@line.sudochatbot.online (โดเมนของเราเอง ไม่รับเมลจริง)
//    เพราะ auth.users ต้องมีอีเมล และ LINE ไม่การันตีว่าให้อีเมลจริงมา
//  · สร้าง session ด้วย generateLink(magiclink) -> verifyOtp ฝั่ง server
//    เป็นทางเดียวที่ได้ session cookie โดย secret ไม่หลุดถึง client
//  · id_token ตรวจกับ endpoint ของ LINE เอง (ไม่พก JWT lib ไม่ต้อง cache คีย์)
//
//  ทุกทางล้มเหลว = เด้งกลับ /login พร้อมรหัสเหตุผล — ห้ามค้างหน้าขาว
// ============================================================

function fail(origin: string, reason: string) {
  const res = NextResponse.redirect(new URL(`/login?line_error=${reason}`, origin));
  res.cookies.delete("line_oauth_state");
  return res;
}

export async function GET(request: Request) {
  const u = new URL(request.url);
  const origin = u.origin;
  try {
    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    const secret = process.env.LINE_LOGIN_CHANNEL_SECRET;
    if (!channelId || !secret) return fail(origin, "unavailable");

    const code = u.searchParams.get("code");
    const state = u.searchParams.get("state");
    const savedState = request.headers.get("cookie")?.match(/(?:^|;\s*)line_oauth_state=([^;]+)/)?.[1];
    if (!code || !state || !savedState || savedState !== state) return fail(origin, "state");

    // ---- แลก code เป็น token ----
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code", code,
        redirect_uri: `${origin}/api/auth/line/callback`,
        client_id: channelId, client_secret: secret,
      }),
    });
    const tok = await tokenRes.json();
    if (!tokenRes.ok || !tok.id_token) return fail(origin, "token");

    // ---- ตรวจ id_token กับ LINE (กัน token ปลอม/หมดอายุ/ผิด channel) ----
    const vRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: String(tok.id_token), client_id: channelId }),
    });
    const v = await vRes.json();
    if (!vRes.ok || !v?.sub || v.aud !== channelId) return fail(origin, "verify");

    const lineUserId = String(v.sub);
    const displayName = typeof v.name === "string" ? v.name.slice(0, 80) : "";
    const picture = typeof v.picture === "string" ? v.picture : null;
    const realEmail = typeof v.email === "string" ? v.email : null;
    // alias คงที่ต่อคน — ล็อกอินซ้ำกี่ครั้งก็เจอบัญชีเดิมเสมอ ไม่มีทางชนกับอีเมลคนอื่น
    const aliasEmail = `line-${lineUserId.toLowerCase()}@line.sudochatbot.online`;

    const svc = createServiceClient();
    const { data: map } = await svc.from("line_identities")
      .select("user_id").eq("line_user_id", lineUserId).maybeSingle();

    if (!map?.user_id) {
      // ผู้ใช้ LINE คนใหม่ — สร้างบัญชี (ถ้า alias เคยถูกสร้างแต่ mapping หาย
      // createUser จะชนอีเมลซ้ำ ปล่อยผ่านได้เพราะ generateLink ด้านล่างหาเจอด้วยอีเมลเดิม)
      await svc.auth.admin.createUser({
        email: aliasEmail, email_confirm: true,
        user_metadata: {
          provider: "line", line_user_id: lineUserId,
          full_name: displayName, avatar_url: picture, contact_email: realEmail,
        },
      });
    }

    // ---- สร้าง session: magiclink token -> verifyOtp ฝั่ง server (ตั้งคุกกี้ให้เอง) ----
    const { data: link, error: linkErr } = await svc.auth.admin.generateLink({ type: "magiclink", email: aliasEmail });
    const tokenHash = link?.properties?.hashed_token;
    const userId = link?.user?.id ?? map?.user_id ?? null;
    if (linkErr || !tokenHash || !userId) return fail(origin, "session");

    // mapping ต้องคงอยู่เสมอ — ใช้หาบัญชีรอบหน้า (upsert กันแถวหายจากเคสค้างกลางทาง)
    await svc.from("line_identities").upsert({ line_user_id: lineUserId, user_id: userId }, { onConflict: "line_user_id" });

    const supabase = await createClient();
    const { error: otpErr } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (otpErr) return fail(origin, "session");

    const res = NextResponse.redirect(new URL("/dashboard", origin));
    res.cookies.delete("line_oauth_state");
    return res;
  } catch {
    return fail(origin, "unexpected");
  }
}
