import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { BACKUP_TABLES } from "@/lib/backup-tables.mjs";

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
//  ตาราง ai_provider_keys/ai_purpose_keys จงใจไม่ขึ้น bucket (SECRET_TABLES
//  ใน backup-tables.mjs) — คีย์ขอออกใหม่ได้เสมอ แต่รั่วแล้วเสียหายทันที
// ============================================================

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const KEEP_DAYS = 14;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 503 });
  }

  const svc = createServiceClient();
  const stamp = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // วันที่ไทย
  const summary: { table: string; rows: number; error?: string }[] = [];
  let totalRows = 0;

  for (const table of BACKUP_TABLES) {
    const rows: unknown[] = [];
    let failed: string | undefined;
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await svc.from(table).select("*").range(from, from + PAGE - 1);
      if (error) { failed = error.message; break; }
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    if (!failed) {
      const body = new Blob([JSON.stringify(rows)], { type: "application/json" });
      const { error: upErr } = await svc.storage.from("db-backups")
        .upload(`${stamp}/${table}.json`, body, { contentType: "application/json", upsert: true });
      if (upErr) failed = upErr.message;
    }
    summary.push({ table, rows: rows.length, ...(failed ? { error: failed } : {}) });
    if (!failed) totalRows += rows.length;
  }

  const failedTables = summary.filter((s) => s.error);
  await svc.storage.from("db-backups").upload(`${stamp}/_summary.json`,
    new Blob([JSON.stringify({ backed_up_at: new Date().toISOString(), total_rows: totalRows, tables: summary })],
      { type: "application/json" }),
    { contentType: "application/json", upsert: true });

  // เก็บย้อนหลัง KEEP_DAYS วัน — ลบโฟลเดอร์วันเก่ากว่านั้น
  try {
    const { data: days } = await svc.storage.from("db-backups").list("", { limit: 100 });
    const cutoff = new Date(Date.now() + 7 * 3600_000 - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
    for (const d of days ?? []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.name) || d.name >= cutoff) continue;
      const { data: files } = await svc.storage.from("db-backups").list(d.name, { limit: 200 });
      if (files?.length) await svc.storage.from("db-backups").remove(files.map((f) => `${d.name}/${f.name}`));
    }
  } catch { /* ลบของเก่าพลาดไม่ใช่เหตุให้การสำรองวันนี้ล้ม */ }

  // สำรองล้มบางตารางต้องมีคนรู้ ไม่ใช่เงียบจนวันที่ต้องกู้แล้วพบว่าไฟล์โหว่
  if (failedTables.length) {
    const { notifyPlatformAdmins } = await import("@/lib/notify");
    await notifyPlatformAdmins(svc, {
      title: "สำรองข้อมูลรายวันมีปัญหา",
      body: `ตารางที่ล้ม: ${failedTables.map((f) => f.table).join(", ")} — ตรวจที่ bucket db-backups/${stamp}`,
      tag: `backup:${stamp}`,
    });
  }

  return NextResponse.json({ ok: failedTables.length === 0, date: stamp, total_rows: totalRows, failed: failedTables });
}
