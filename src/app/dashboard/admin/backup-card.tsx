// ============================================================
//  ยามเฝ้าการสำรองข้อมูล — ตรวจสดทุกครั้งที่เปิดหน้า
//
//  ทำไมต้องมี (พบตอนตรวจ 11 ส.ค. 2569): `vercel.json` ตั้ง cron สำรองข้อมูล
//  ทุกวันไว้เรียบร้อยแล้ว แต่ `/api/cron/backup` เป็น fail-closed ด้วย `CRON_SECRET`
//  ซึ่ง **ยังไม่ได้ตั้งใน Vercel** → cron ยิงทุกวัน โดนตอบ 503 ทุกวัน
//  ผลจริงที่วัดได้: bucket `db-backups` มี 0 ไฟล์ ทั้งที่มีกิจการใช้งานจริงหลายสิบราย
//
//  ความพังนี้ "เงียบสนิท" — ไม่มีใครรู้จนกว่าจะถึงวันที่ต้องกู้ข้อมูลจริง
//  ซึ่งเป็นวันที่สายเกินไปแล้ว การ์ดนี้เปลี่ยนความเงียบให้เป็นสิ่งที่เห็นได้ทุกวัน
//
//  ⚠️ Supabase แพ็กฟรีไม่มี backup/PITR ให้เลย ไฟล์ในนี้คือชั้นเดียวที่มี
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { DatabaseBackup, TriangleAlert, ShieldCheck } from "lucide-react";
import BackupNowButton from "./backup-now-button";

/** เกินกี่วันถือว่าค้าง — cron รายวัน จึงเผื่อพลาดได้ 1 รอบ */
const STALE_DAYS = 2;

export default async function BackupCard() {
  const svc = createServiceClient();
  const [{ data, error }, { data: snap }] = await Promise.all([
    svc.storage.from("db-backups").list("", { limit: 100, sortBy: { column: "name", order: "desc" } }),
    // ชั้นที่สอง: จุดกู้คืนในฐานข้อมูลเอง (migration 100) — ทำงานเองทุกคืนโดยไม่ต้องพึ่ง env ของ Vercel
    svc.rpc("snapshot_status"),
  ]);
  const snapshot = (snap ?? null) as { latest: string | null; count: number; tables: number } | null;
  const snapDate = snapshot?.latest?.replace("snapshot_", "").replaceAll("_", "-") ?? null;

  const files = (data ?? []).filter((f) => f.name && !f.name.startsWith("."));
  const latest = files[0]?.name ?? null;
  // ชื่อโฟลเดอร์/ไฟล์ขึ้นต้นด้วยวันที่ไทย YYYY-MM-DD ตาม /api/cron/backup
  const latestDate = latest?.slice(0, 10) ?? null;
  const ageDays = latestDate && /^\d{4}-\d{2}-\d{2}$/.test(latestDate)
    ? Math.floor((Date.now() - new Date(latestDate).getTime()) / 864e5)
    : null;

  const never = files.length === 0;
  const stale = ageDays !== null && ageDays > STALE_DAYS;
  const bad = never || stale || !!error;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseBackup className="h-4 w-4" /> การสำรองข้อมูล
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* ชั้นที่ทำงานเองอยู่แล้ว — ขึ้นก่อนเสมอ เพื่อไม่ให้เข้าใจผิดว่าไม่มีชั้นสำรองเลย
            ตอน bucket ยังว่าง (ซึ่งเป็นสภาพจริงตราบใดที่ยังไม่ได้ตั้ง CRON_SECRET) */}
        {snapshot?.latest && (
          <p className="mb-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              จุดกู้คืนในฐานข้อมูล: <b>{snapDate}</b> ({snapshot.tables} ตาราง · เก็บไว้ {snapshot.count} ชุด)
              <span className="mt-0.5 block text-xs text-emerald-700">
                ทำเองอัตโนมัติทุกคืน ตี 4 — กัน migration พลาด/ลบผิด/ตารางเสีย
                แต่ไม่กันกรณีทั้งโปรเจกต์หาย จึงยังต้องมีไฟล์สำรองออกนอกเครื่องด้วย
              </span>
            </span>
          </p>
        )}

        {!bad ? (
          <>
            <p className="flex items-start gap-2 text-sm text-emerald-700">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>สำรองล่าสุด {latestDate} ({ageDays === 0 ? "วันนี้" : `${ageDays} วันที่แล้ว`}) · เก็บไว้ {files.length} ชุด</span>
            </p>
            <BackupNowButton />
          </>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="flex items-start gap-2 text-sm font-semibold text-red-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error
                ? "อ่านที่เก็บไฟล์สำรองไม่ได้"
                : never
                  ? "ยังไม่เคยมีไฟล์สำรองเลยสักไฟล์"
                  : `ไฟล์สำรองล่าสุดค้างมา ${ageDays} วัน`}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-red-700">
              {error
                ? error.message
                : snapshot?.latest
                  ? "ไฟล์สำรองที่เอาออกนอกฐานข้อมูลได้ยังไม่มี — จุดกู้คืนด้านบนกันได้แค่ความผิดพลาดในฐานข้อมูล ถ้าโปรเจกต์หายทั้งก้อนจะกู้ไม่ได้เลย"
                  : "ระบบตั้งเวลาสำรองอัตโนมัติไว้ทุกวันแล้ว แต่ด่านความปลอดภัยปิดอยู่จึงยังไม่ทำงาน — ข้อมูลบัญชีของทุกกิจการตอนนี้ไม่มีชั้นสำรองเลย"}
            </p>
            {/* ทางออกทันทีต้องมาก่อนวิธีตั้งค่าถาวร — กดปุ่มนี้ได้ไฟล์สำรองชุดแรกเดี๋ยวนี้เลย
                ไม่ต้องรอใครไปตั้ง env ที่ Vercel ซึ่งเป็นเหตุที่ทำให้ไม่มีไฟล์สำรองมาตลอด */}
            <BackupNowButton />

            <div className="mt-3 rounded-lg bg-white/70 p-3 text-xs text-red-800">
              <p className="font-semibold">ตั้งให้สำรองเองทุกคืน (ทำครั้งเดียว ~2 นาที)</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>Vercel → โปรเจกต์ → Settings → Environment Variables</li>
                <li>เพิ่ม <code className="rounded bg-red-100 px-1">CRON_SECRET</code> = ค่าสุ่มยาว ๆ (เช่นจาก <code className="rounded bg-red-100 px-1">openssl rand -hex 32</code>)</li>
                <li>Redeploy หนึ่งครั้ง — คืนถัดไปจะมีไฟล์สำรองชุดแรก</li>
              </ol>
              <p className="mt-2">สำรองเดี๋ยวนี้ด้วยมือได้ที่เครื่องตัวเอง: <code className="rounded bg-red-100 px-1">npm run backup</code></p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
