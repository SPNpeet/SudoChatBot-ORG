import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runWeeklyDigest } from "@/lib/weekly-digest-run";

// ============================================================
//  สรุปประจำสัปดาห์ส่งถึงผู้ใช้ (LINE + Web Push) — ทางเข้าที่ 1: Vercel Cron
//
//  ตรรกะจริงทั้งหมดอยู่ใน lib/weekly-digest-run.ts (เหตุผล/กติกาครบอยู่ที่นั่น)
//  ทางเข้าที่ 2 คือปุ่มในหน้าแอดมิน — ใช้ฟังก์ชันเดียวกันทุกบรรทัด
//  จึงไม่มีทางที่สองเส้นส่งข้อความคนละแบบ หรือคนละกฎภาษี
//
//  ⚠️ ยังต้องมี CRON_SECRET ถึงจะยิงได้ (fail-closed 503) ห้ามผ่อนข้อนี้ —
//  เส้นนี้ส่งข้อความออกไปหาผู้ใช้จริง เปิดให้ใครยิงก็ได้ = ช่องสแปมในนามเรา
//
//  Vercel Cron ยิงทุกวัน แต่โค้ดทำงานเฉพาะ "วันจันทร์เวลาไทย" เท่านั้น
//  (ตั้ง schedule รายสัปดาห์ตรง ๆ ได้ แต่แพ็ก Hobby จำกัดความถี่ cron —
//   ยิงรายวันแล้วกรองวันในโค้ดจึงทนต่อการเปลี่ยนแพ็กมากกว่า)
// ============================================================

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 503 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  const svc = createServiceClient();
  const r = await runWeeklyDigest(svc, { force });

  if (r.skippedAll) return NextResponse.json({ ok: true, week: r.week, skipped: r.skippedAll });
  return NextResponse.json(r);
}
