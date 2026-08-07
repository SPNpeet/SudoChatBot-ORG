import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/shop";
import { APP_ORIGIN } from "@/lib/app-origin";

// ============================================================
//  สร้าง/อัปเดต Rich Menu ของ LINE OA กลาง (แอดมินแพลตฟอร์มเท่านั้น)
//
//  ⚠️ ทำไมเขียนใหม่ทั้งใบ (8 ส.ค. 2569)
//  เจ้าของดูเมนูเดิมแล้วบอกว่า "รูปในเมนูไม่ดีเลย อะไรก็ไม่รู้ เหมือนไม่ใส่ใจ"
//  ของเดิมคือ 6 ช่องขาวล้วน คั่นด้วยเส้นบาง ไอคอนเส้นสีเดียวกันหมด
//  บนจอมือถือจริงเมนูสูงแค่ ~40% ของจอ ตัวหนังสือเล็กมาก และทุกช่องหน้าตาเท่ากันหมด
//  ผลคือกวาดตาแล้วแยกไม่ออกว่าอันไหนคืออะไร ต้องอ่านทีละช่อง = ช้ากว่าเปิดเว็บเอง
//
//  ที่แก้:
//   · ช่องแรกเป็น "ช่องเด่น" กินสองช่อง พื้นเขียวเข้ม = ตาไปตกที่งานหลักก่อนเสมอ
//   · ช่องที่เหลือมีแผ่นสีอ่อนรองไอคอน แต่ละงานคนละเฉดในโทนเดียวกัน แยกออกด้วยการกวาดตา
//   · ตัวหนังสือใหญ่ขึ้น (96/52 จากเดิม 76/44) เพราะเมนูจริงถูกย่อลงเหลือ ~1/3
//   · ปลายทางตั้งค่าได้: LIFF (แอปในไลน์) · เว็บ · เพจ Facebook · โทรหาร้าน
//
//  ⚠️ ปลายทางสำคัญที่สุดคือ LIFF ไม่ใช่ลิงก์เว็บธรรมดา
//  ลิงก์เว็บธรรมดาเปิดในเบราว์เซอร์ในแอป LINE ซึ่ง cookie คนละที่กับเบราว์เซอร์หลัก
//  = เจอหน้าล็อกอินทุกครั้ง คนส่วนใหญ่ปิดทิ้งตรงนั้น เมนูจึงไม่มีใครใช้
//  ตั้ง LIFF ID แล้วระบบจะสลับไปใช้ลิงก์ LIFF ให้เองทุกปุ่มที่ชี้เข้าระบบ
// ============================================================

export const maxDuration = 60;

const FONT_600 = "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-thai@latest/thai-600-normal.ttf";
const FONT_400 = "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-thai@latest/thai-400-normal.ttf";

const BRAND = "#0F9D76";
const BRAND_DEEP = "#0B7355";
const INK = "#0B1F1A";
const MUTED = "#6F817B";
const HAIRLINE = "#E9F0ED";

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
  phone: ["M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L16 12l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 6.2 2 2 0 0 1 6.5 3Z"],
  facebook: ["M14 8.5V7a1.5 1.5 0 0 1 1.5-1.5H17V2.5h-2.2A4.3 4.3 0 0 0 10.5 7v1.5H8V12h2.5v9.5H14V12h2.6l.4-3.5H14Z"],
};

interface Cell {
  icon: string; t1: string; t2: string;
  /** path ในระบบเรา — จะถูกแปลงเป็นลิงก์ LIFF ถ้าตั้งค่าไว้ */
  path?: string;
  /** ปลายทางนอกระบบ (เพจ Facebook / โทร) */
  external?: "facebook" | "phone";
  /** สีแผ่นรองไอคอน */
  tint: string;
}

/**
 * 6 ช่อง — ช่องแรกเป็นช่องเด่นกินสองช่องบนแถวแรก
 * เรียงตาม "งานที่คนเปิด LINE มาทำ" ไม่ใช่ตามโครงเมนูของเว็บ
 */
const CELLS: Cell[] = [
  { icon: "camera", t1: "ถ่ายรูปบิล", t2: "ให้ AI ลงบัญชีให้ทันที", path: "/dashboard/expenses/new", tint: "#0B7355" },
  { icon: "doc", t1: "ออกเอกสาร", t2: "ใบแจ้งหนี้ · ใบเสร็จ", path: "/dashboard/sales", tint: "#E3F4EE" },
  { icon: "ai", t1: "ผู้ช่วยบัญชี AI", t2: "สั่งเป็นภาษาคน", path: "/dashboard/assistant", tint: "#E7F1FB" },
  { icon: "wallet", t1: "ยอดค้าง", t2: "ลูกหนี้ · เจ้าหนี้", path: "/dashboard/money", tint: "#FDF1E3" },
  { icon: "chart", t1: "รายงาน + ภาษี", t2: "ภ.พ.30 · ภ.ง.ด.", path: "/dashboard/reports", tint: "#F1ECFB" },
  { icon: "help", t1: "ช่วยเหลือ", t2: "คู่มือ · ตั้งค่า", path: "/dashboard/help", tint: "#EFF1F0" },
];

const W = 2500, H = 1686;
const COL = Math.floor(W / 3), ROW = H / 2;

function Icon({ name, size, color }: { name: string; size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name].map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/** ช่องเด่น — กินสองช่องแถวบน พื้นเขียวเข้ม ตัวหนังสือขาว */
function HeroCell({ c }: { c: Cell }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "56px",
      width: `${COL * 2}px`, height: `${ROW}px`, padding: "0 90px",
      background: BRAND_DEEP,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "270px", height: "270px", borderRadius: "76px", background: "rgba(255,255,255,0.14)",
      }}>
        <Icon name={c.icon} size={150} color="#FFFFFF" />
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 108, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.15 }}>{c.t1}</div>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 400, color: "rgba(255,255,255,0.82)", marginTop: 18 }}>{c.t2}</div>
      </div>
    </div>
  );
}

function PlainCell({ c, borderRight, borderTop }: { c: Cell; borderRight: boolean; borderTop: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      width: `${COL}px`, height: `${ROW}px`, background: "#FFFFFF",
      borderRight: borderRight ? `3px solid ${HAIRLINE}` : "none",
      borderTop: borderTop ? `3px solid ${HAIRLINE}` : "none",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "200px", height: "200px", borderRadius: "58px", background: c.tint,
      }}>
        <Icon name={c.icon} size={112} color={BRAND} />
      </div>
      <div style={{ display: "flex", fontSize: 78, fontWeight: 600, color: INK, marginTop: 34 }}>{c.t1}</div>
      <div style={{ display: "flex", fontSize: 48, fontWeight: 400, color: MUTED, marginTop: 14 }}>{c.t2}</div>
    </div>
  );
}

async function buildImage(cells: Cell[]): Promise<Buffer> {
  const [r6, r4] = await Promise.all([fetch(FONT_600), fetch(FONT_400)]);
  if (!r6.ok || !r4.ok) throw new Error("โหลดฟอนต์ไทยไม่สำเร็จ");
  const [f600, f400] = await Promise.all([r6.arrayBuffer(), r4.arrayBuffer()]);

  const img = new ImageResponse(
    (
      <div style={{ display: "flex", flexWrap: "wrap", width: `${W}px`, height: `${H}px`, background: "#FFFFFF" }}>
        <HeroCell c={cells[0]} />
        <PlainCell c={cells[1]} borderRight={false} borderTop={false} />
        {cells.slice(2, 5).map((c, i) => (
          <PlainCell key={i} c={c} borderRight={i < 2} borderTop />
        ))}
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

/** พิกัดของแต่ละช่องบนรูป — ต้องตรงกับ layout ใน buildImage เป๊ะ ๆ */
const BOUNDS = [
  { x: 0, y: 0, width: COL * 2, height: ROW },              // ช่องเด่น
  { x: COL * 2, y: 0, width: W - COL * 2, height: ROW },
  { x: 0, y: ROW, width: COL, height: ROW },
  { x: COL, y: ROW, width: COL, height: ROW },
  { x: COL * 2, y: ROW, width: W - COL * 2, height: ROW },
];

export async function POST() {
  try {
    const { supabase } = await requireUser();
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    if (!isAdmin) return NextResponse.json({ ok: false, error: "เฉพาะผู้ดูแลแพลตฟอร์ม" }, { status: 403 });

    const svc = createServiceClient();
    const { data: pf } = await svc.from("platform_billing_settings")
      .select("line_oa_token,line_liff_id,line_facebook_url,line_phone").eq("id", true).maybeSingle();
    const token = pf?.line_oa_token;
    if (!token) return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่า OA token" }, { status: 400 });
    const auth = { Authorization: `Bearer ${token}` };

    const liffId = (pf?.line_liff_id ?? "").trim();
    const fbUrl = (pf?.line_facebook_url ?? "").trim();
    const phone = (pf?.line_phone ?? "").replace(/[^0-9+]/g, "");

    // ⚠️ ตรงนี้คือหัวใจ: มี LIFF ID = ทุกปุ่มที่ชี้เข้าระบบเปลี่ยนเป็นลิงก์ LIFF
    // เปิดแล้วรู้เลยว่าใครกด จึงพาเข้าระบบให้เองได้ ไม่ต้องพิมพ์รหัสผ่านซ้ำ
    // ไม่มี LIFF ID = ยังใช้ลิงก์เว็บธรรมดาได้เหมือนเดิม (เมนูต้องใช้งานได้เสมอ)
    const linkFor = (path: string) =>
      liffId ? `https://liff.line.me/${liffId}?to=${encodeURIComponent(path)}` : `${APP_ORIGIN}${path}`;

    // ช่องสุดท้ายสลับเป็น "เพจ Facebook" หรือ "โทรหาเรา" ถ้าเจ้าของตั้งไว้
    // (เจ้าของขอ: เมนูไม่ควรไปเว็บอย่างเดียว) — ไม่ตั้งก็ยังเป็นช่วยเหลือเหมือนเดิม
    const cells = [...CELLS];
    if (fbUrl) cells[5] = { icon: "facebook", t1: "เพจของเรา", t2: "ข่าวสาร · ทักแชท", external: "facebook", tint: "#E7F1FB" };
    else if (phone) cells[5] = { icon: "phone", t1: "โทรหาเรา", t2: phone, external: "phone", tint: "#E3F4EE" };

    // เอาช่องที่ 6 มาต่อท้ายช่องที่ 5 บนพื้นที่เดียวกัน (layout มี 5 พื้นที่)
    // ⚠️ ช่องที่ 6 ของ CELLS เดิมถูกยุบเข้าไปเป็นช่องสุดท้าย — จำนวนพื้นที่ต้องเท่ากับ BOUNDS เสมอ
    const shown = [cells[0], cells[1], cells[2], cells[3], cells[5]];

    const uriOf = (c: Cell): string => {
      if (c.external === "facebook") return fbUrl;
      if (c.external === "phone") return `tel:${phone}`;
      return linkFor(c.path ?? "/dashboard");
    };

    const areas = shown.map((c, i) => ({
      bounds: BOUNDS[i],
      action: { type: "uri", label: c.t1.slice(0, 20), uri: uriOf(c) },
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

    const png = await buildImage(shown);
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

    return NextResponse.json({
      ok: true, richMenuId, buttons: shown.length,
      mode: liffId ? "liff" : "web",
      note: liffId
        ? "ใช้ลิงก์แอปในไลน์ (LIFF) — กดแล้วเข้าระบบให้อัตโนมัติ"
        : "ยังใช้ลิงก์เว็บธรรมดา — ตั้ง LIFF ID เพื่อให้กดแล้วไม่ต้องล็อกอินใหม่",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 200) }, { status: 500 });
  }
}
