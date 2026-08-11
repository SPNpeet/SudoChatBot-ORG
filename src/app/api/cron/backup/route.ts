import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runBackup } from "@/lib/backup-run";

// ============================================================
//  สำรองข้อมูลอัตโนมัติรายวัน -> Storage bucket "db-backups" (private)
//
//  ทำไมต้องมี: Supabase แพ็กฟรีไม่มี backup อัตโนมัติเลย และสคริปต์สำรองมือ
//  (npm run backup) พึ่งคนจำ — ของจริงค้าง 6 วันตอนตรวจ 5 ส.ค. 2569
//  ชั้นนี้กันหายนะที่เกิดบ่อยสุด: migration พลาด / ลบผิด / ตารางเสีย
//  ⚠️ ไม่กันเคสทั้งโปรเจกต์หาย (bucket อยู่โปรเจกต์เดียวกัน) —
//  ของแท้คือ Supabase Pro (PITR) + npm run backup ออกนอกเครื่องเป็นระยะ
//
//  เรียกโดย Vercel Cron (ตั้งใน vercel.json) — Vercel แนบ
//  Authorization: Bearer <CRON_SECRET> ให้เองเมื่อเจ้าของตั้ง env CRON_SECRET
//  ไม่มี env / header ไม่ตรง = 503 fail-closed (กันคนนอกสั่งสำรองรัว ๆ)
//
//  ⚠️ 11 ส.ค. 2569: ตรวจพบว่า CRON_SECRET ยังไม่ได้ตั้ง = เส้นนี้ตอบ 503 ทุกคืน
//  และไม่เคยมีไฟล์สำรองเลยสักไฟล์ จึงย้ายตรรกะจริงไป lib/backup-run.ts
//  เพื่อให้แอดมินกดสำรองเองจากหน้าเว็บได้ด้วย ไม่ต้องรอใครตั้ง env
//
//  ตาราง ai_provider_keys/ai_purpose_keys จงใจไม่ขึ้น bucket (SECRET_TABLES
//  ใน backup-tables.mjs) — คีย์ขอออกใหม่ได้เสมอ แต่รั่วแล้วเสียหายทันที
// ============================================================

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 503 });
  }
  const result = await runBackup(createServiceClient());
  return NextResponse.json(result);
}
