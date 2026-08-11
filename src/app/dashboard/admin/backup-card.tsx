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

/** เกินกี่วันถือว่าค้าง — cron รายวัน จึงเผื่อพลาดได้ 1 รอบ */
const STALE_DAYS = 2;

export default async function BackupCard() {
  const svc = createServiceClient();
  const { data, error } = await svc.storage.from("db-backups").list("", {
    limit: 100, sortBy: { column: "name", order: "desc" },
  });

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
        {!bad ? (
          <p className="flex items-start gap-2 text-sm text-emerald-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>สำรองล่าสุด {latestDate} ({ageDays === 0 ? "วันนี้" : `${ageDays} วันที่แล้ว`}) · เก็บไว้ {files.length} ชุด</span>
          </p>
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
                : "ระบบตั้งเวลาสำรองอัตโนมัติไว้ทุกวันแล้ว แต่ด่านความปลอดภัยปิดอยู่จึงยังไม่ทำงาน — ข้อมูลบัญชีของทุกกิจการตอนนี้ไม่มีชั้นสำรองเลย"}
            </p>
            <div className="mt-3 rounded-lg bg-white/70 p-3 text-xs text-red-800">
              <p className="font-semibold">วิธีเปิด (ทำครั้งเดียว ~2 นาที)</p>
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
