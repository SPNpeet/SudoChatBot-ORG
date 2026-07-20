// ============================================================
//  ADS WATCHDOG — เฝ้างบโฆษณาให้ทุกร้าน (cron ทุก 30 นาที)
//  spend วันนี้เกินเพดานรวมของร้าน -> pause ทุกแคมเปญ + แจ้งเตือน + audit
//  หลักการ: การหยุดเงินปลอดภัยเสมอ ระบบหยุดให้ก่อน ร้านค่อยเปิดใหม่เอง
// ============================================================
import { sb, auditLog } from "../_shared/supabase.ts";
import { json } from "../_shared/utils.ts";

const GRAPH = "https://graph.facebook.com/v21.0";

async function metaGet(path: string, token: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ ...params, access_token: token }).toString();
  const res = await fetch(`${GRAPH}/${path}?${qs}`);
  if (!res.ok) throw new Error(`meta ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return await res.json();
}

Deno.serve(async (_req: Request) => {
  const s = sb();
  let checked = 0, autoPaused = 0, errors = 0;

  const { data: accounts } = await s.from("ad_accounts")
    .select("id, shop_id, ad_account_id, daily_cap_total, token_expires_at")
    .eq("status", "active");

  for (const acc of accounts ?? []) {
    try {
      // token หมดอายุ -> ปรับสถานะ + แจ้ง (ครั้งเดียว)
      if (acc.token_expires_at && new Date(acc.token_expires_at) < new Date()) {
        await s.from("ad_accounts").update({ status: "token_expired" }).eq("id", acc.id);
        await s.from("notifications").insert({
          shop_id: acc.shop_id, type: "system",
          title: "การเชื่อมต่อบัญชีโฆษณาหมดอายุ",
          body: "เข้าหน้า ยิงแอด AI แล้วกดเชื่อมต่อใหม่ เพื่อให้ระบบเฝ้างบต่อได้",
        });
        continue;
      }
      const { data: token } = await s.rpc("get_ad_token", { p_ad_account_row_id: acc.id });
      if (!token) continue;
      checked++;

      // spend วันนี้ระดับแคมเปญ + sync cache
      const ins = await metaGet(`${acc.ad_account_id}/insights`, String(token), {
        date_preset: "today", level: "campaign", fields: "campaign_id,campaign_name,spend", limit: "50",
      });
      const rows = (ins.data ?? []) as { campaign_id: string; spend?: string }[];
      let total = 0;
      for (const r of rows) {
        const spend = Number(r.spend ?? 0);
        total += spend;
        await s.from("ad_campaigns").update({ spend_today: spend, synced_at: new Date().toISOString() })
          .eq("campaign_id", r.campaign_id);
      }

      const cap = Number(acc.daily_cap_total ?? 0);
      if (cap > 0 && total >= cap) {
        // เกินเพดานรวม -> pause แคมเปญ ACTIVE ทุกตัวของบัญชีนี้
        const { data: actives } = await s.from("ad_campaigns")
          .select("campaign_id, name").eq("shop_id", acc.shop_id)
          .eq("ad_account_id", acc.ad_account_id).eq("status", "ACTIVE");
        for (const c of actives ?? []) {
          try {
            await fetch(`${GRAPH}/${c.campaign_id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "PAUSED", access_token: String(token) }),
            });
            await s.from("ad_campaigns").update({ status: "PAUSED" }).eq("campaign_id", c.campaign_id);
          } catch (e) { console.error("pause failed", c.campaign_id, (e as Error).message); }
        }
        autoPaused++;
        await s.from("notifications").insert({
          shop_id: acc.shop_id, type: "system",
          title: "หยุดโฆษณาอัตโนมัติ — ใช้งบครบเพดานวันนี้แล้ว",
          body: `ใช้ไป ${total.toFixed(0)} บาท จากเพดาน ${cap.toFixed(0)} บาท/วัน — ระบบหยุดทุกแคมเปญให้แล้ว เปิดใหม่พรุ่งนี้หรือเพิ่มเพดานได้ที่หน้า ยิงแอด AI`,
        });
        await auditLog({
          shop_id: acc.shop_id, actor_type: "system", action: "ads_auto_paused_cap",
          resource_type: "ad_account", resource_id: acc.ad_account_id,
          details: { spend_today: total, cap },
        });
      }
    } catch (e) {
      errors++;
      console.error("watchdog account error", acc.ad_account_id, (e as Error).message);
    }
  }

  return json({ checked, autoPaused, errors });
});
