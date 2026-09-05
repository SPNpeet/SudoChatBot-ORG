// ============================================================
//  สรุปประจำสัปดาห์ — สถานะจริง + ปุ่มส่งเอง
//
//  ทำไมต้องมี (12 ส.ค. 2569): ฟีเจอร์นี้ถูกเขียนขึ้นมาแก้ปัญหาที่วัดได้จริง
//  5 ส.ค. 2569 — 22 จาก 24 กิจการเข้ามาวันเดียวแล้วไม่กลับมาอีกเลย
//  แต่มันผูกอยู่กับ `/api/cron/weekly-digest` ซึ่ง fail-closed ด้วย `CRON_SECRET`
//  ที่ยังไม่ได้ตั้งใน Vercel → **ยังไม่เคยส่งถึงใครเลยสักครั้ง** และไม่มีใครรู้
//
//  การ์ดนี้อ่านจาก audit_logs ตรง ๆ = ตอบได้ทันทีว่า "ส่งครั้งสุดท้ายเมื่อไหร่ กี่ราย"
//  ไม่ใช่เดาจากการมี cron อยู่ใน vercel.json
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Megaphone, TriangleAlert, ShieldCheck } from "lucide-react";
import SendDigestButton from "./send-digest-button";

export default async function WeeklyDigestCard() {
  const svc = createServiceClient();
  const [{ data: lastSent }, { data: notifyRows }, { data: pushRows }] = await Promise.all([
    svc.from("audit_logs").select("created_at,details")
      .eq("action", "weekly_digest_sent").order("created_at", { ascending: false }).limit(1),
    svc.from("shop_notify_settings").select("shop_id,line_to_id,notify_approval"),
    svc.from("push_subscriptions").select("shop_id"),
  ]);

  const last = lastSent?.[0] as { created_at: string; details?: { week?: string } } | undefined;
  const lastWeek = last?.details?.week ?? null;

  // นับคนที่ "ส่งถึงได้จริง" ด้วยกฎเดียวกับตัวส่ง — ไม่งั้นตัวเลขบนจอกับของจริงจะคนละเรื่อง
  const optedOut = new Set((notifyRows ?? []).filter((n) => n.notify_approval === false).map((n) => n.shop_id as string));
  const reachable = new Set<string>();
  for (const n of notifyRows ?? []) if (n.line_to_id) reachable.add(n.shop_id as string);
  for (const p of pushRows ?? []) reachable.add(p.shop_id as string);
  const targets = [...reachable].filter((id) => !optedOut.has(id)).length;

  const never = !last;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-4 w-4" /> สรุปประจำสัปดาห์ถึงผู้ใช้
        </CardTitle>
      </CardHeader>
      <CardContent>
        {never ? (
          <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <p className="flex items-start gap-2 font-semibold">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              ยังไม่เคยส่งถึงใครเลยสักครั้ง
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-red-700">
              cron รายวันถูกบล็อกด้วย <code className="rounded bg-red-100 px-1">CRON_SECRET</code> ที่ยังไม่ได้ตั้งใน Vercel
              — นี่คือช่องทางเดียวที่ไปหาผู้ใช้ได้โดยไม่ต้องรอให้เขานึกถึงเรา
              (วัดจริง 5 ส.ค.: 22 จาก 24 กิจการเข้ามาวันเดียวแล้วไม่กลับมาอีก)
            </p>
          </div>
        ) : (
          <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              ส่งครั้งล่าสุด: สัปดาห์ <b>{lastWeek ?? "—"}</b>
              <span className="mt-0.5 block text-xs text-emerald-700">
                {new Date(last.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok",  dateStyle: "medium", timeStyle: "short" })}
              </span>
            </span>
          </p>
        )}

        <p className="mt-3 text-xs text-neutral-500">
          ส่งถึงได้ตอนนี้ <b>{targets}</b> กิจการ (ที่เชื่อม LINE หรือเปิดแจ้งเตือนบนเบราว์เซอร์ และไม่ได้ปิดสวิตช์)
          {" · "}ส่งเฉพาะกิจการที่มีเรื่องจริงให้ทำ · กดซ้ำในสัปดาห์เดิมไม่ส่งซ้ำ
        </p>

        <SendDigestButton />
      </CardContent>
    </Card>
  );
}
