// ============================================================
//  ดีไซน์ + พิกัดของเมนูในแชท LINE (Rich Menu) — แหล่งเดียวของทั้งระบบ
//
//  ⚠️ ทำไมต้องแยกออกมาเป็นไฟล์กลาง (8 ส.ค. 2569)
//  เมนูถูกสร้างได้จากสองทาง: ปุ่มในหน้าแอดมิน และสคริปต์ที่รันจากเครื่อง
//  ถ้าปล่อยให้ต่างคนต่างวาดรูป จะกลายเป็นเมนูคนละหน้าตาแล้วแต่ว่าใครกดสร้าง
//  และตอนแก้ดีไซน์จะแก้ไม่ครบ — พิกัดปุ่ม (BOUNDS) ต้องตรงกับรูปเป๊ะ ๆ เสมอ
//  ไม่งั้นกดตรงหนึ่งแล้วไปอีกที่ ซึ่งหาสาเหตุยากมากเพราะรูปดูปกติทุกอย่าง
// ============================================================
// ⚠️ ต้อง import React ตรง ๆ แม้ Next จะไม่ต้องใช้แล้ว
// เพราะไฟล์นี้ถูกรันจากสคริปต์นอก Next ด้วย (npm run line:menu) ซึ่งแปลง JSX
// แบบเก่าที่อ้างถึง React.createElement — ไม่มีบรรทัดนี้แล้วสคริปต์ล้มที่ตอนวาดรูป
import React from "react";
import { ImageResponse } from "next/og";

const FONT_600 = "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-thai@latest/thai-600-normal.ttf";
const FONT_400 = "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-thai@latest/thai-400-normal.ttf";

const BRAND = "#0F9D76";
const BRAND_DEEP = "#0B7355";
const INK = "#0B1F1A";
const MUTED = "#6F817B";
const HAIRLINE = "#E9F0ED";

/** ไอคอนเส้น (แนว lucide) — วาดเป็น path ตรง ๆ ให้คมทุกขนาด ไม่พึ่งอีโมจิของระบบ */
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

export interface Cell {
  icon: string; t1: string; t2: string;
  /** path ในระบบเรา — จะถูกแปลงเป็นลิงก์ LIFF ถ้าตั้งค่าไว้ */
  path?: string;
  /** ปลายทางนอกระบบ (เพจ Facebook / โทร) */
  external?: "facebook" | "phone";
  /** สีแผ่นรองไอคอน */
  tint: string;
}

/**
 * 5 ช่องที่แสดงจริง — เรียงตาม "งานที่คนเปิด LINE มาทำ" ไม่ใช่ตามโครงเมนูของเว็บ
 * ช่องแรกเป็นช่องเด่นกินสองช่องบนแถวแรก
 */
export const MENU_CELLS: Cell[] = [
  { icon: "camera", t1: "ถ่ายรูปบิล", t2: "ให้ AI ลงบัญชีให้ทันที", path: "/dashboard/expenses/new", tint: "#0B7355" },
  { icon: "doc", t1: "ออกเอกสาร", t2: "ใบแจ้งหนี้ · ใบเสร็จ", path: "/dashboard/sales", tint: "#E3F4EE" },
  { icon: "ai", t1: "ผู้ช่วยบัญชี AI", t2: "สั่งเป็นภาษาคน", path: "/dashboard/assistant", tint: "#E7F1FB" },
  { icon: "wallet", t1: "ยอดค้าง", t2: "ลูกหนี้ · เจ้าหนี้", path: "/dashboard/money", tint: "#FDF1E3" },
  // ⚠️ ป้ายต้องตรงกับปลายทางเป๊ะ ๆ (แก้ 8 ส.ค. 2569 หลังดูรูปเมนูจริงที่ขึ้น LINE แล้ว)
  // ตอนยุบจาก 6 ช่องเหลือ 5 ผมเอาคำว่า "รายงานภาษี" ไปต่อท้ายป้ายช่วยเหลือ
  // แต่ปลายทางยังเป็น /dashboard/help = ปุ่มสัญญาสิ่งที่กดแล้วไม่ได้
  // ปุ่มที่โกหกในเมนูแรกที่ลูกค้าเห็น แย่กว่าไม่มีปุ่มนั้นเลย
  // เลือกรายงาน+ภาษีเพราะเป็นงานที่มีกำหนดส่ง ส่วนคู่มือหาเจอในระบบอยู่แล้ว
  { icon: "chart", t1: "รายงาน + ภาษี", t2: "ภ.พ.30 · ภ.ง.ด.", path: "/dashboard/reports", tint: "#EFF1F0" },
];

export const MENU_W = 2500, MENU_H = 1686;
const COL = Math.floor(MENU_W / 3), ROW = MENU_H / 2;

/** พิกัดของแต่ละช่องบนรูป — ต้องตรงกับ layout ใน buildRichMenuImage เป๊ะ ๆ */
export const MENU_BOUNDS = [
  { x: 0, y: 0, width: COL * 2, height: ROW },                   // ช่องเด่น
  { x: COL * 2, y: 0, width: MENU_W - COL * 2, height: ROW },
  { x: 0, y: ROW, width: COL, height: ROW },
  { x: COL, y: ROW, width: COL, height: ROW },
  { x: COL * 2, y: ROW, width: MENU_W - COL * 2, height: ROW },
];

function Icon({ name, size, color }: { name: string; size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {(ICONS[name] ?? ICONS.help).map((d, i) => <path key={i} d={d} />)}
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

function PlainCell({ c, width, borderRight, borderTop }: {
  c: Cell; width: number; borderRight: boolean; borderTop: boolean;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      width: `${width}px`, height: `${ROW}px`, background: "#FFFFFF",
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

/** วาดรูปเมนู — cells ต้องมี 5 ช่องพอดี ตรงกับ MENU_BOUNDS */
export async function buildRichMenuImage(cells: Cell[]): Promise<Buffer> {
  const [r6, r4] = await Promise.all([fetch(FONT_600), fetch(FONT_400)]);
  if (!r6.ok || !r4.ok) throw new Error("โหลดฟอนต์ไทยไม่สำเร็จ");
  const [f600, f400] = await Promise.all([r6.arrayBuffer(), r4.arrayBuffer()]);

  const img = new ImageResponse(
    (
      <div style={{ display: "flex", flexWrap: "wrap", width: `${MENU_W}px`, height: `${MENU_H}px`, background: "#FFFFFF" }}>
        <HeroCell c={cells[0]} />
        <PlainCell c={cells[1]} width={MENU_W - COL * 2} borderRight={false} borderTop={false} />
        <PlainCell c={cells[2]} width={COL} borderRight borderTop />
        <PlainCell c={cells[3]} width={COL} borderRight borderTop />
        <PlainCell c={cells[4]} width={MENU_W - COL * 2} borderRight={false} borderTop />
      </div>
    ),
    {
      width: MENU_W, height: MENU_H,
      fonts: [
        { name: "NotoThai", data: f600, weight: 600, style: "normal" },
        { name: "NotoThai", data: f400, weight: 400, style: "normal" },
      ],
    },
  );
  return Buffer.from(await img.arrayBuffer());
}

/**
 * ประกอบชุดช่องตามการตั้งค่า — ช่องสุดท้ายสลับเป็นเพจ Facebook หรือโทรหาเรา
 * (เจ้าของขอ: เมนูไม่ควรไปเว็บอย่างเดียว) · ไม่ตั้งก็เป็นปุ่มช่วยเหลือเหมือนเดิม
 */
export function menuCellsFor(opts: { facebookUrl?: string | null; phone?: string | null }): Cell[] {
  const cells = [...MENU_CELLS];
  const fb = (opts.facebookUrl ?? "").trim();
  const tel = (opts.phone ?? "").replace(/[^0-9+]/g, "");
  if (fb) cells[4] = { icon: "facebook", t1: "เพจของเรา", t2: "ข่าวสาร · ทักแชท", external: "facebook", tint: "#E7F1FB" };
  else if (tel) cells[4] = { icon: "phone", t1: "โทรหาเรา", t2: tel, external: "phone", tint: "#E3F4EE" };
  return cells;
}

/**
 * ปลายทางของแต่ละช่อง
 *
 * ⚠️ มี LIFF ID = ทุกปุ่มที่ชี้เข้าระบบเปลี่ยนเป็นลิงก์ LIFF
 * เปิดแล้วอยู่ในแอปไลน์ ไม่เด้งออกไปเบราว์เซอร์ที่ต้องล็อกอินใหม่ทุกครั้ง
 * ไม่มี LIFF ID = ใช้ลิงก์เว็บธรรมดา (เมนูต้องใช้งานได้เสมอ ไม่ว่าตั้งค่าครบหรือยัง)
 */
export function menuUri(c: Cell, opts: {
  origin: string; liffId?: string | null; facebookUrl?: string | null; phone?: string | null;
}): string {
  if (c.external === "facebook") return (opts.facebookUrl ?? "").trim();
  if (c.external === "phone") return `tel:${(opts.phone ?? "").replace(/[^0-9+]/g, "")}`;
  const path = c.path ?? "/dashboard";
  const liffId = (opts.liffId ?? "").trim();
  return liffId ? `https://liff.line.me/${liffId}?to=${encodeURIComponent(path)}` : `${opts.origin}${path}`;
}
