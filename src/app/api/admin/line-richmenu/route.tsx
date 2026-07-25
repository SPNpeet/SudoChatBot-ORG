import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/shop";

// ============================================================
//  สร้าง/อัปเดต Rich Menu ของ LINE OA กลาง (แอดมินแพลตฟอร์มเท่านั้น)
//  ลูกค้าเปิดแชท OA แล้วเห็นเมนู 6 ปุ่ม กดเข้าใช้งานได้ทันที เช่น ผู้ช่วยบัญชี AI
//  รูปสร้างเองด้วย ImageResponse (โหลดฟอนต์ไทยจาก CDN) — ไม่ต้องออกแบบรูปเอง
// ============================================================

export const maxDuration = 60;

const BASE = "https://sudochatbot.online";
const FONT_URL = "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-thai@latest/thai-600-normal.ttf";

const CELLS = [
  { icon: "🤖", t1: "ผู้ช่วยบัญชี AI", t2: "สั่งงานเป็นภาษาคน", url: `${BASE}/dashboard/assistant` },
  { icon: "📸", t1: "ถ่ายรูปบิล", t2: "ให้ AI ลงบัญชีให้", url: `${BASE}/dashboard/expenses/new` },
  { icon: "🧾", t1: "ออกเอกสาร", t2: "ใบแจ้งหนี้/ใบเสร็จ", url: `${BASE}/dashboard/sales` },
  { icon: "💰", t1: "ยอดค้าง", t2: "ใครค้างเรา เราค้างใคร", url: `${BASE}/dashboard/money` },
  { icon: "📊", t1: "รายงาน + ภาษี", t2: "ภ.พ.30 / ภ.ง.ด.", url: `${BASE}/dashboard/reports` },
  { icon: "⚙️", t1: "ตั้งค่า / ช่วยเหลือ", t2: "คู่มือใช้งาน", url: `${BASE}/dashboard/help` },
];

const W = 2500, H = 1686, COL = Math.floor(W / 3), ROW = H / 2;

async function buildImage(): Promise<Buffer> {
  const fres = await fetch(FONT_URL);
  if (!fres.ok) throw new Error(`โหลดฟอนต์ไทยไม่ได้ (${fres.status})`);
  const font = await fres.arrayBuffer();

  const img = new ImageResponse(
    (
      <div style={{ display: "flex", flexWrap: "wrap", width: `${W}px`, height: `${H}px`, background: "#d1fae5" }}>
        {CELLS.map((c, i) => (
          <div key={i} style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            width: `${i % 3 === 2 ? W - COL * 2 : COL}px`, height: `${ROW}px`,
            background: (Math.floor(i / 3) + i) % 2 === 0 ? "#ffffff" : "#f0fdfa",
            borderRight: "5px solid #d1fae5", borderBottom: "5px solid #d1fae5",
          }}>
            <div style={{ display: "flex", fontSize: 180 }}>{c.icon}</div>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 600, color: "#0f172a", marginTop: 26 }}>{c.t1}</div>
            <div style={{ display: "flex", fontSize: 46, color: "#64748b", marginTop: 14 }}>{c.t2}</div>
          </div>
        ))}
      </div>
    ),
    { width: W, height: H, fonts: [{ name: "NotoThai", data: font, weight: 600, style: "normal" }] },
  );
  return Buffer.from(await img.arrayBuffer());
}

export async function POST() {
  try {
    const { supabase } = await requireUser();
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    if (!isAdmin) return NextResponse.json({ ok: false, error: "เฉพาะผู้ดูแลแพลตฟอร์ม" }, { status: 403 });

    const svc = createServiceClient();
    const { data: pf } = await svc.from("platform_billing_settings").select("line_oa_token").eq("id", true).maybeSingle();
    const token = pf?.line_oa_token;
    if (!token) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า OA token" }, { status: 400 });
    const auth = { Authorization: `Bearer ${token}` };

    // 1) สร้างโครงเมนู (พื้นที่กด 6 ช่อง)
    const areas = CELLS.map((c, i) => ({
      bounds: {
        x: (i % 3) * COL, y: Math.floor(i / 3) * ROW,
        width: i % 3 === 2 ? W - COL * 2 : COL, height: ROW,
      },
      action: { type: "uri", label: c.t1.slice(0, 20), uri: c.url },
    }));
    const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
      method: "POST", headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        size: { width: W, height: H },
        selected: true,
        name: "SudoChatBot main",
        chatBarText: "เมนูใช้งาน",
        areas,
      }),
    });
    if (!createRes.ok) {
      return NextResponse.json({ ok: false, error: `สร้างเมนูไม่สำเร็จ: ${(await createRes.text()).slice(0, 200)}` }, { status: 502 });
    }
    const { richMenuId } = await createRes.json() as { richMenuId: string };

    // 2) อัปโหลดรูปพื้นหลัง
    const png = await buildImage();
    const upRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
      method: "POST", headers: { ...auth, "Content-Type": "image/png" }, body: new Uint8Array(png),
    });
    if (!upRes.ok) {
      await fetch(`https://api.line.me/v2/bot/richmenu/${richMenuId}`, { method: "DELETE", headers: auth });
      return NextResponse.json({ ok: false, error: `อัปโหลดรูปไม่สำเร็จ: ${(await upRes.text()).slice(0, 200)}` }, { status: 502 });
    }

    // 3) ตั้งเป็นเมนูเริ่มต้นของทุกคน
    const setRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST", headers: auth });
    if (!setRes.ok) {
      return NextResponse.json({ ok: false, error: `ตั้งเป็นเมนูหลักไม่สำเร็จ: ${(await setRes.text()).slice(0, 200)}` }, { status: 502 });
    }

    // 4) ลบเมนูเก่าทิ้ง กันสะสมจนเต็มโควตา
    try {
      const listRes = await fetch("https://api.line.me/v2/bot/richmenu/list", { headers: auth });
      const list = await listRes.json() as { richmenus?: { richMenuId: string }[] };
      await Promise.all((list.richmenus ?? [])
        .filter((m) => m.richMenuId !== richMenuId)
        .map((m) => fetch(`https://api.line.me/v2/bot/richmenu/${m.richMenuId}`, { method: "DELETE", headers: auth })));
    } catch { /* ลบไม่ได้ไม่เป็นไร */ }

    return NextResponse.json({ ok: true, richMenuId, buttons: CELLS.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
