// ============================================================
//  Health check — ตรวจความพร้อมของ deployment (ไม่เปิดเผย secret)
//  GET /api/health → { ok, env: {...}, db }
//  ใช้เช็คหลังตั้ง env ใน Vercel ว่าระบบพร้อมใช้จริง
// ============================================================
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ทดสอบ query จริงด้วย service key (ถ้ามี) — พิสูจน์ว่า key ใช้งานได้ ไม่ใช่แค่มีค่า
  let db = false;
  if (url && hasService) {
    try {
      const r = await fetch(`${url}/rest/v1/plans?select=code&limit=1`, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        cache: "no-store",
      });
      db = r.ok;
    } catch { /* db = false */ }
  }

  // commit ที่กำลังให้บริการอยู่จริง — ต้องมี ไม่งั้นยืนยัน deploy ไม่ได้
  // เคยพลาดมาแล้ว: เช็คแค่ /login = 200 แล้วสรุปว่า deploy ใหม่ขึ้นแล้ว
  // ทั้งที่หน้าที่พังคือหน้าหลัง login ซึ่ง status code ไม่มีทางบอก
  // (เป็นข้อมูลสาธารณะอยู่แล้วเพราะ repo เปิด ไม่ใช่ความลับ)
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? null;

  return NextResponse.json({
    ok: hasAnon && hasService && db,
    env: { anonKey: hasAnon, serviceRoleKey: hasService },
    db,
    commit: commit ? commit.slice(0, 7) : "local",
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
    now: new Date().toISOString(),
  });
}
