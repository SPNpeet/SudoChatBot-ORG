import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertMember } from "@/lib/shop";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const fail = (e: string) => NextResponse.redirect(`${origin}/dashboard/channels?error=${encodeURIComponent(e)}`);

  if (!code || !stateRaw) return fail(searchParams.get("error_description") ?? "no_code");
  let state: { shopId: string; nonce: string };
  try { state = JSON.parse(stateRaw); } catch { return fail("bad_state"); }

  const cookieStore = await cookies();
  if (cookieStore.get("meta_oauth_nonce")?.value !== state.nonce) return fail("csrf");
  try { await assertMember(state.shopId, ["owner", "admin"]); } catch { return fail("forbidden"); }

  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = `${origin}/api/channels/meta/callback`;

  // 1) code -> user token -> long-lived
  const tokenRes = await fetch(`${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`);
  if (!tokenRes.ok) return fail("token_exchange");
  const { access_token: shortToken } = await tokenRes.json();
  const longRes = await fetch(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(shortToken)}`);
  const { access_token: userToken } = longRes.ok ? await longRes.json() : { access_token: shortToken };

  // 2) ดึงเพจทั้งหมดที่ user ดูแล
  const pagesRes = await fetch(`${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=50&access_token=${encodeURIComponent(userToken)}`);
  if (!pagesRes.ok) return fail("list_pages");
  const pages = (await pagesRes.json()).data ?? [];
  if (!pages.length) return fail("no_pages_found");

  // 3) เชื่อมทุกเพจ + subscribe webhook + เก็บ token ใน Vault
  const supabase = await createClient();
  const svc = createServiceClient();
  let connected = 0;
  for (const p of pages) {
    // Facebook Page
    const { data: ch, error } = await supabase.from("channels").upsert({
      shop_id: state.shopId, platform: "facebook", platform_page_id: p.id,
      page_name: p.name, status: "active",
    }, { onConflict: "platform,platform_page_id" }).select("id").single();
    if (!error && ch) {
      await svc.rpc("store_channel_token", { p_channel_id: ch.id, p_token: p.access_token });
      await fetch(`${GRAPH}/${p.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${encodeURIComponent(p.access_token)}`, { method: "POST" });
      connected++;
    }
    // Instagram (ถ้าเพจผูก IG business ไว้)
    const ig = p.instagram_business_account;
    if (ig?.id) {
      const { data: igc, error: igErr } = await supabase.from("channels").upsert({
        shop_id: state.shopId, platform: "instagram", platform_page_id: ig.id,
        page_name: ig.username ? `@${ig.username}` : p.name, status: "active",
      }, { onConflict: "platform,platform_page_id" }).select("id").single();
      if (!igErr && igc) {
        await svc.rpc("store_channel_token", { p_channel_id: igc.id, p_token: p.access_token });
        connected++;
      }
    }
  }

  await svc.from("audit_logs").insert({
    shop_id: state.shopId, actor_type: "user", action: "meta_channels_connected",
    details: { pages: pages.length, connected },
  });
  return NextResponse.redirect(`${origin}/dashboard/channels`);
}
