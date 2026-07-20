import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertMember } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";

const GRAPH = "https://graph.facebook.com/v21.0";

// callback เชื่อมบัญชีโฆษณา — เก็บ token ลง Vault + บันทึกทุก ad account ที่ user มีสิทธิ์
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const fail = (e: string) => NextResponse.redirect(`${origin}/dashboard/ads?error=${encodeURIComponent(e)}`);

  if (!code || !stateRaw) return fail(searchParams.get("error_description") ?? "no_code");
  let state: { shopId: string; nonce: string };
  try { state = JSON.parse(stateRaw); } catch { return fail("bad_state"); }

  const cookieStore = await cookies();
  if (cookieStore.get("ads_oauth_nonce")?.value !== state.nonce) return fail("csrf");
  let userId: string;
  try { const { user } = await assertMember(state.shopId, ["owner", "admin"]); userId = user.id; }
  catch { return fail("forbidden"); }

  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = `${origin}/api/ads/meta/callback`;

  // code -> user token -> long-lived (~60 วัน)
  const tokenRes = await fetch(`${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`);
  if (!tokenRes.ok) return fail("token_exchange");
  const { access_token: shortToken } = await tokenRes.json();
  const longRes = await fetch(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(shortToken)}`);
  const longJson = longRes.ok ? await longRes.json() : { access_token: shortToken, expires_in: 5184000 };
  const userToken: string = longJson.access_token;
  const expiresAt = new Date(Date.now() + (Number(longJson.expires_in) || 5184000) * 1000).toISOString();

  // ดึง ad accounts ที่ user มีสิทธิ์
  const actRes = await fetch(`${GRAPH}/me/adaccounts?fields=id,name,currency,account_status,funding_source_details&limit=25&access_token=${encodeURIComponent(userToken)}`);
  if (!actRes.ok) return fail("list_ad_accounts");
  const accounts = ((await actRes.json()).data ?? []) as {
    id: string; name?: string; currency?: string; account_status?: number;
    funding_source_details?: { display_string?: string };
  }[];
  if (!accounts.length) return fail("no_ad_accounts");

  // เพจของร้าน (ใช้เป็น identity ของแอด CTM)
  const svc = createServiceClient();
  const { data: fbChannel } = await svc.from("channels")
    .select("platform_page_id").eq("shop_id", state.shopId).eq("platform", "facebook").eq("status", "active")
    .limit(1).maybeSingle();

  let connected = 0;
  let noFunding = 0;
  for (const a of accounts) {
    const { data: row, error } = await svc.from("ad_accounts").upsert({
      shop_id: state.shopId, platform: "meta", ad_account_id: a.id,
      account_name: a.name ?? a.id, currency: a.currency ?? "THB",
      page_id: fbChannel?.platform_page_id ?? null,
      status: "active", connected_by: userId, connected_at: new Date().toISOString(),
      token_expires_at: expiresAt,
    }, { onConflict: "shop_id,platform,ad_account_id" }).select("id").single();
    if (!error && row) {
      await svc.rpc("store_ad_token", { p_ad_account_row_id: row.id, p_token: userToken });
      connected++;
      if (!a.funding_source_details?.display_string) noFunding++;
    }
  }

  await svc.from("audit_logs").insert({
    shop_id: state.shopId, actor_type: "user", actor_id: userId, action: "ad_accounts_connected",
    details: { accounts: accounts.length, connected, no_funding: noFunding },
  });
  const warn = noFunding > 0 ? "&warn=no_funding" : "";
  return NextResponse.redirect(`${origin}/dashboard/ads?connected=${connected}${warn}`);
}
