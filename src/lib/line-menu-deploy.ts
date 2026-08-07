// ============================================================
//  เอาเมนูขึ้น LINE จริง — สร้างรูป · สร้าง rich menu · ตั้งเป็นเมนูหลัก · ลบของเก่า
//  ใช้ร่วมกันระหว่างปุ่มในหน้าแอดมินกับสคริปต์ที่รันจากเครื่อง (ดูหมายเหตุใน line-menu.tsx)
//
//  ⚠️ ลำดับสำคัญ: สร้าง rich menu ก่อน แล้วค่อยอัปรูป
//  ถ้าอัปรูปไม่สำเร็จต้องลบ rich menu ที่เพิ่งสร้างทิ้งทันที
//  ไม่งั้นจะเหลือเมนูเปล่าไม่มีรูปค้างในบัญชี และกินโควตาเมนูของ OA
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildRichMenuImage, menuCellsFor, menuUri, MENU_BOUNDS, MENU_W, MENU_H } from "./line-menu";

export type DeployResult =
  | { ok: true; richMenuId: string; buttons: number; mode: "liff" | "web"; note: string }
  | { ok: false; error: string; status?: number };

export async function deployRichMenu(svc: SupabaseClient, origin: string): Promise<DeployResult> {
  const { data: pf } = await svc.from("platform_billing_settings")
    .select("line_oa_token,line_liff_id,line_facebook_url,line_phone").eq("id", true).maybeSingle();

  const token = pf?.line_oa_token as string | undefined;
  if (!token) return { ok: false, error: "ยังไม่ได้ตั้งค่า OA token", status: 400 };
  const auth = { Authorization: `Bearer ${token}` };

  const liffId = ((pf?.line_liff_id as string | null) ?? "").trim();
  const facebookUrl = (pf?.line_facebook_url as string | null) ?? null;
  const phone = (pf?.line_phone as string | null) ?? null;

  const cells = menuCellsFor({ facebookUrl, phone });
  const areas = cells.map((c, i) => ({
    bounds: MENU_BOUNDS[i],
    action: { type: "uri", label: c.t1.slice(0, 20), uri: menuUri(c, { origin, liffId, facebookUrl, phone }) },
  }));

  const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      size: { width: MENU_W, height: MENU_H },
      selected: true,
      name: `SudoChatBot menu ${new Date().toISOString().slice(0, 10)}`,
      chatBarText: "เมนูใช้งาน",
      areas,
    }),
  });
  if (!createRes.ok) return { ok: false, error: `สร้างเมนูไม่สำเร็จ: ${(await createRes.text()).slice(0, 200)}` };
  const { richMenuId } = await createRes.json() as { richMenuId: string };

  const png = await buildRichMenuImage(cells);
  const upRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST", headers: { ...auth, "Content-Type": "image/png" }, body: new Uint8Array(png),
  });
  if (!upRes.ok) {
    await fetch(`https://api.line.me/v2/bot/richmenu/${richMenuId}`, { method: "DELETE", headers: auth });
    return { ok: false, error: `อัปโหลดรูปไม่สำเร็จ: ${(await upRes.text()).slice(0, 200)}` };
  }

  const setRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST", headers: auth });
  if (!setRes.ok) return { ok: false, error: `ตั้งเป็นเมนูหลักไม่สำเร็จ: ${(await setRes.text()).slice(0, 200)}` };

  // ลบเมนูเก่าทิ้ง กันสะสมจนเต็มโควตา — ลบไม่ได้ไม่ถือว่าล้มเหลว เมนูใหม่ใช้ได้แล้ว
  try {
    const listRes = await fetch("https://api.line.me/v2/bot/richmenu/list", { headers: auth });
    const list = await listRes.json() as { richmenus?: { richMenuId: string }[] };
    await Promise.all((list.richmenus ?? [])
      .filter((m) => m.richMenuId !== richMenuId)
      .map((m) => fetch(`https://api.line.me/v2/bot/richmenu/${m.richMenuId}`, { method: "DELETE", headers: auth })));
  } catch { /* ข้าม */ }

  return {
    ok: true, richMenuId, buttons: cells.length,
    mode: liffId ? "liff" : "web",
    note: liffId
      ? "ใช้ลิงก์แอปในไลน์ (LIFF) — เปิดในแอปเลย ไม่เด้งออกเบราว์เซอร์"
      : "ยังใช้ลิงก์เว็บธรรมดา — ตั้ง LIFF ID เพื่อให้เปิดในแอปไลน์",
  };
}

/**
 * สร้าง LIFF app ให้อัตโนมัติถ้ายังไม่มี แล้วคืน liffId
 *
 * ⚠️ ทำไมสร้างเองได้: LIFF app ผูกกับ LINE Login channel ซึ่งเรามี id/secret อยู่แล้ว
 * ขอ access token ของ channel ด้วย client_credentials แล้วเรียก LIFF API ได้เลย
 * ไม่ต้องให้ใครไปกดในหน้า console — และเป็นการ "เพิ่ม" อย่างเดียว ไม่แตะของเดิม
 *
 * ⚠️ ถ้ามี LIFF app ที่ endpoint เดียวกันอยู่แล้ว ให้ใช้ตัวนั้น ห้ามสร้างซ้ำ
 * สร้างซ้ำ = มีหลายตัวชี้ที่เดียวกัน แล้วตอนจะแก้/ลบจะไม่รู้ว่าตัวไหนที่ใช้อยู่จริง
 */
export async function ensureLiffApp(svc: SupabaseClient, endpointUrl: string): Promise<
  { ok: true; liffId: string; created: boolean } | { ok: false; error: string }
> {
  const { data: pf } = await svc.from("platform_billing_settings")
    .select("line_login_channel_id,line_login_channel_secret,line_liff_id").eq("id", true).maybeSingle();

  const existing = ((pf?.line_liff_id as string | null) ?? "").trim();
  if (existing) return { ok: true, liffId: existing, created: false };

  const id = pf?.line_login_channel_id as string | undefined;
  const secret = pf?.line_login_channel_secret as string | undefined;
  if (!id || !secret) return { ok: false, error: "ยังไม่ได้ตั้ง LINE Login channel (ID/Secret)" };

  const tokRes = await fetch("https://api.line.me/v2/oauth/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
  });
  if (!tokRes.ok) return { ok: false, error: `ขอ token ของ channel ไม่สำเร็จ: ${(await tokRes.text()).slice(0, 200)}` };
  const { access_token } = await tokRes.json() as { access_token?: string };
  if (!access_token) return { ok: false, error: "ไม่ได้ token ของ channel" };
  const auth = { Authorization: `Bearer ${access_token}` };

  // มีอยู่แล้วที่ชี้ endpoint เดียวกันไหม
  try {
    const listRes = await fetch("https://api.line.me/liff/v1/apps", { headers: auth });
    if (listRes.ok) {
      const { apps } = await listRes.json() as { apps?: { liffId: string; view?: { url?: string } }[] };
      const hit = (apps ?? []).find((a) => (a.view?.url ?? "").replace(/\/$/, "") === endpointUrl.replace(/\/$/, ""));
      if (hit) {
        await svc.from("platform_billing_settings").update({ line_liff_id: hit.liffId }).eq("id", true);
        return { ok: true, liffId: hit.liffId, created: false };
      }
    }
  } catch { /* อ่านรายการไม่ได้ ก็สร้างใหม่ */ }

  const createRes = await fetch("https://api.line.me/liff/v1/apps", {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      view: { type: "full", url: endpointUrl },
      description: "SudoChatBot",
      features: { ble: false, qrCode: true },
      scope: ["profile", "openid"],
      botPrompt: "none",
    }),
  });
  if (!createRes.ok) return { ok: false, error: `สร้าง LIFF ไม่สำเร็จ: ${(await createRes.text()).slice(0, 300)}` };
  const { liffId } = await createRes.json() as { liffId?: string };
  if (!liffId) return { ok: false, error: "สร้าง LIFF แล้วแต่ไม่ได้ liffId กลับมา" };

  const { error } = await svc.from("platform_billing_settings").update({ line_liff_id: liffId }).eq("id", true);
  if (error) return { ok: false, error: `สร้าง LIFF แล้วแต่บันทึกลงระบบไม่สำเร็จ: ${error.message}` };
  return { ok: true, liffId, created: true };
}
