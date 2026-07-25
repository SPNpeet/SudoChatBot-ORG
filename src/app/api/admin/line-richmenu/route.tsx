import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/shop";
import { APP_ORIGIN } from "@/lib/app-origin";

// ============================================================
//  สร้าง/อัปเดต Rich Menu ของ LINE OA กลาง (แอดมินแพลตฟอร์มเท่านั้น)
//  ดีไซน์: ไอคอนเส้นสีแบรนด์ในวงกลมนุ่ม + ฟอนต์ไทย 2 น้ำหนัก + เส้นแบ่งบาง
//  จงใจไม่ใช้อีโมจิ — อีโมจิทำให้ดูเหมือนงานสไลด์ ไม่ใช่ผลิตภัณฑ์จริง
// ============================================================

export const maxDuration = 60;

const FONT_600 = "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-thai@latest/thai-600-normal.ttf";
const FONT_400 = "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-thai@latest/thai-400-normal.ttf";

const BRAND = "#0F9D76";
const INK = "#0B1F1A";
const MUTED = "#7C8B86";
const LINE_COLOR = "#E8EFEC";
const CHIP = "#EAF7F2";

/** ไอคอนเส้น (แนว lucide) — วาดเป็น path ตรงๆ ให้คมทุกขนาด ไม่พึ่งอีโมจิของระบบ */
const ICONS: Record<string, string[]> = {
  ai: [
    "M8 3h8a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H9l-4 3v-3a3 3 0 0 1-1-2V6a3 3 0 0 1 3-3Z",
    "M9.2 9.2h.01", "M14.8 9.2h.01", "M9.4 12.4c1.6 1.1 3.6 1.1 5.2 0",
  ],
  camera: [
    "M4 8h3l1.6-2.4A1 1 0 0 1 9.4 5h5.2a1 1 0 0 1 .83.44L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z",
    "M12 17.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  ],
  doc: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z", "M14 3v5h5", "M9 13h6", "M9 17h4"],
  wallet: ["M3 8a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z", "M3 8V7a2 2 0 0 1 2-2h11", "M17.5 13h.01"],
  chart: ["M4 20V10", "M10 20V4", "M16 20v-7", "M2 20h20"],
  help: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M9.2 9.4a3 3 0 0 1 5.6 1.2c0 2-3 2.4-3 3.9", "M12 17.6h.01"],
};

const CELLS = [
  { icon: "ai", t1: "ผู้ช่วยบัญชี AI", t2: "สั่งงานเป็นภาษาคน", path: "/dashboard/assistant" },
  { icon: "camera", t1: "ถ่ายรูปบิล", t2: "ให้ AI ลงบัญชีให้", path: "/dashboard/expenses/new" },
  { icon: "doc", t1: "ออกเอกสาร", t2: "ใบแจ้งหนี้ · ใบเสร็จ", path: "/dashboard/sales" },
  { icon: "wallet", t1: "ยอดค้าง", t2: "ลูกหนี้ · เจ้าหนี้", path: "/dashboard/money" },
  { icon: "chart", t1: "รายงาน + ภาษี", t2: "ภ.พ.30 · ภ.ง.ด.", path: "/dashboard/reports" },
  { icon: "help", t1: "ช่วยเหลือ", t2: "คู่มือ · ตั้งค่า", path: "/dashboard/help" },
];

const W = 2500, H = 1686, COL = Math.floor(W / 3), ROW = H / 2;

function Icon({ name }: { name: string }) {
  return (
    <svg width="168" height="168" viewBox="0 0 24 24" fill="none"
      stroke={BRAND} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name].map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

async function buildImage(): Promise<Buffer> {
  const [r6, r4] = await Promise.all([fetch(FONT_600), fetch(FONT_400)]);
  if (!r6.ok || !r4.ok) throw new Error("โหลดฟอนต์ไทยไม่สำเร็จ");
  const [f600, f400] = await Promise.all([r6.arrayBuffer(), r4.arrayBuffer()]);

  const img = new ImageResponse(
    (
      <div style={{ display: "flex", flexWrap: "wrap", width: `${W}px`, height: `${H}px`, background: "#FFFFFF" }}>
        {CELLS.map((c, i) => {
          const col = i % 3, row = Math.floor(i / 3);
          return (
            <div key={i} style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              width: `${col === 2 ? W - COL * 2 : COL}px`, height: `${ROW}px`,
              background: "#FFFFFF",
              borderRight: col === 2 ? "none" : `3px solid ${LINE_COLOR}`,
              borderBottom: row === 0 ? `3px solid ${LINE_COLOR}` : "none",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "292px", height: "292px", borderRadius: "146px", background: CHIP,
              }}>
                <Icon name={c.icon} />
              </div>
              <div style={{ display: "flex", fontSize: 76, fontWeight: 600, color: INK, marginTop: 42 }}>{c.t1}</div>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 400, color: MUTED, marginTop: 16 }}>{c.t2}</div>
            </div>
          );
        })}
      </div>
    ),
    {
      width: W, height: H,
      fonts: [
        { name: "NotoThai", data: f600, weight: 600, style: "normal" },
        { name: "NotoThai", data: f400, weight: 400, style: "normal" },
      ],
    },
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

    const areas = CELLS.map((c, i) => ({
      bounds: {
        x: (i % 3) * COL, y: Math.floor(i / 3) * ROW,
        width: i % 3 === 2 ? W - COL * 2 : COL, height: ROW,
      },
      action: { type: "uri", label: c.t1.slice(0, 20), uri: `${APP_ORIGIN}${c.path}` },
    }));

    const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
      method: "POST", headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        size: { width: W, height: H },
        selected: true,
        name: `SudoChatBot menu ${new Date().toISOString().slice(0, 10)}`,
        chatBarText: "เมนูใช้งาน",
        areas,
      }),
    });
    if (!createRes.ok) {
      return NextResponse.json({ ok: false, error: `สร้างเมนูไม่สำเร็จ: ${(await createRes.text()).slice(0, 200)}` }, { status: 502 });
    }
    const { richMenuId } = await createRes.json() as { richMenuId: string };

    const png = await buildImage();
    const upRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
      method: "POST", headers: { ...auth, "Content-Type": "image/png" }, body: new Uint8Array(png),
    });
    if (!upRes.ok) {
      await fetch(`https://api.line.me/v2/bot/richmenu/${richMenuId}`, { method: "DELETE", headers: auth });
      return NextResponse.json({ ok: false, error: `อัปโหลดรูปไม่สำเร็จ: ${(await upRes.text()).slice(0, 200)}` }, { status: 502 });
    }

    const setRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST", headers: auth });
    if (!setRes.ok) {
      return NextResponse.json({ ok: false, error: `ตั้งเป็นเมนูหลักไม่สำเร็จ: ${(await setRes.text()).slice(0, 200)}` }, { status: 502 });
    }

    // ลบเมนูเก่าทิ้ง กันสะสมจนเต็มโควตา
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
