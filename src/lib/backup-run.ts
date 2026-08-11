// ============================================================
//  ตัวสำรองข้อมูลจริง — ใช้ร่วมกัน 2 ทางเข้า
//    1) /api/cron/backup      — Vercel Cron รายวัน (ต้องมี CRON_SECRET)
//    2) ปุ่มในหน้าแอดมิน       — แอดมินแพลตฟอร์มกดเองได้ทุกเมื่อ
//
//  ⚠️ ทำไมต้องมีทางที่ 2 (เพิ่ม 11 ส.ค. 2569):
//  ตรวจแล้วพบว่า bucket db-backups มี **0 ไฟล์** ทั้งที่มีกิจการใช้จริงหลายสิบราย
//  เพราะ cron ถูกบล็อกด้วย CRON_SECRET ที่ยังไม่ได้ตั้งใน Vercel
//  ถ้าปล่อยให้ "ทางเดียวที่สำรองได้" ผูกกับ env ที่ยังไม่มีใครตั้ง
//  ระบบก็จะไม่มีไฟล์สำรองต่อไปเรื่อย ๆ จนถึงวันที่ต้องกู้จริงแล้วสายเกินไป
//  ทางที่ 2 ตัดการพึ่งพานั้นออก — กดจากในเว็บได้เลย ได้ไฟล์ชุดแรกทันที
//
//  Supabase แพ็กฟรีไม่มี backup/PITR ให้เลย ไฟล์ชุดนี้คือชั้นเดียวที่มี
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";
import { BACKUP_TABLES } from "@/lib/backup-tables.mjs";

/** เก็บย้อนหลังกี่วัน — เกินกว่านี้ลบทิ้งเพื่อไม่ให้พื้นที่บวม */
export const KEEP_DAYS = 14;

export interface BackupResult {
  ok: boolean;
  date: string;
  total_rows: number;
  failed: { table: string; rows: number; error?: string }[];
}

export async function runBackup(svc: SupabaseClient): Promise<BackupResult> {
  const stamp = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // วันที่ไทย
  const summary: { table: string; rows: number; error?: string }[] = [];
  let totalRows = 0;

  for (const table of BACKUP_TABLES) {
    const rows: unknown[] = [];
    let failed: string | undefined;
    const PAGE = 1000;
    // ดึงทีละหน้า — ตารางที่โตแล้วดึงรวดเดียวจะโดนตัดที่ลิมิตของ PostgREST เงียบ ๆ
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
      title: "สำรองข้อมูลมีปัญหา",
      body: `ตารางที่ล้ม: ${failedTables.map((f) => f.table).join(", ")} — ตรวจที่ bucket db-backups/${stamp}`,
      tag: `backup:${stamp}`,
    });
  }

  return { ok: failedTables.length === 0, date: stamp, total_rows: totalRows, failed: failedTables };
}
