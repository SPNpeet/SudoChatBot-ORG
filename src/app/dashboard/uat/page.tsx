// ============================================================
//  ทดสอบกับผู้ใช้จริง (UAT) — หน้าที่ทำให้ "แผนที่ไม่เคยถูกรัน" กลายเป็นของที่รันได้
//
//  ที่มา: docs/UAT-PLAN.md มีโจทย์ 7 ข้อครบตั้งแต่ 4 ส.ค. แต่ไม่เคยถูกใช้กับคนจริงเลย
//  เพราะต้องมีคนจับเวลา + จดว่าใครติดตรงไหน = ใช้คนสองคนต่อรอบ ซึ่งไม่มีใครว่าง
//  หน้านี้ตัดคนจดออก เหลือแค่ยื่นมือถือให้ผู้ทดสอบ แล้วกดปุ่มตอนจบแต่ละข้อ
//
//  ตารางสรุปอ่านจาก audit_logs โดยตรง = เห็นผลรวมทุกคนทันทีโดยไม่ต้องรวมมือ
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, PageHeader, EmptyState } from "@/components/ui";
import UatRunner from "./runner";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Row {
  details: { tester?: string; task_no?: number; task?: string; outcome?: string; seconds?: number; note?: string | null };
  created_at: string;
}

const OUTCOME_TH: Record<string, { label: string; cls: string }> = {
  done: { label: "ทำได้เอง", cls: "text-emerald-700" },
  helped: { label: "ต้องช่วยบอก", cls: "text-amber-700" },
  gave_up: { label: "ยอมแพ้", cls: "text-red-600" },
};

export default async function UatPage() {
  const { shop, role } = await getCurrentShop();
  const canRun = role === "owner" || role === "admin";

  const svc = createServiceClient();
  const { data } = await svc.from("audit_logs")
    .select("details,created_at")
    .eq("shop_id", shop.id).eq("action", "uat_task")
    .order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as Row[];

  // สรุปรายข้อ — ข้อที่คนติดบ่อยสุดคือข้อที่ต้องแก้ก่อนเพื่อน
  const byTask = new Map<number, { task: string; done: number; helped: number; gaveUp: number; secs: number[] }>();
  for (const r of rows) {
    const n = r.details?.task_no ?? 0;
    if (!n) continue;
    const e = byTask.get(n) ?? { task: r.details?.task ?? "", done: 0, helped: 0, gaveUp: 0, secs: [] };
    if (r.details?.outcome === "done") e.done++;
    else if (r.details?.outcome === "helped") e.helped++;
    else if (r.details?.outcome === "gave_up") e.gaveUp++;
    if (typeof r.details?.seconds === "number") e.secs.push(r.details.seconds);
    byTask.set(n, e);
  }
  const summary = [...byTask.entries()].sort((a, b) => a[0] - b[0]);
  const testers = new Set(rows.map((r) => r.details?.tester).filter(Boolean)).size;

  return (
    <div className="space-y-5">
      <PageHeader
        title="ทดสอบกับผู้ใช้จริง"
        lead={rows.length === 0
          ? "ยังไม่เคยทดสอบกับใครเลย"
          : <>ทดสอบไปแล้ว <b>{testers}</b> คน · บันทึก {rows.length} ครั้ง</>}
        help="ยื่นมือถือให้ผู้ทดสอบ อ่านโจทย์ให้ฟัง แล้วเงียบ — ห้ามชี้จอ ห้ามบอกทาง · ระบบจับเวลาและบันทึกให้เอง · ข้อที่คนติดบ่อยที่สุดคือข้อที่ต้องแก้ก่อนเพื่อน · ไม่เก็บชื่อผู้ทดสอบ เก็บแค่ตัวอักษร A/B/C"
      />

      {canRun ? <UatRunner shopId={shop.id} /> : (
        <Card><CardContent className="pt-6 text-sm text-neutral-500">
          เฉพาะเจ้าของ/ผู้ดูแลกิจการเท่านั้นที่จัดการทดสอบได้
        </CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4" /> สรุปผลรายข้อ</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          {summary.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState
                title="ยังไม่มีผลทดสอบ"
                hint="ทดสอบกับคน 3 คน คนละ ~20 นาที จะได้ข้อมูลมากกว่าเดาเป็นเดือน" />
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {summary.map(([no, e]) => {
                const total = e.done + e.helped + e.gaveUp;
                const avg = e.secs.length ? Math.round(e.secs.reduce((a, b) => a + b, 0) / e.secs.length) : 0;
                const stuck = e.helped + e.gaveUp;
                return (
                  <div key={no} className="px-6 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm"><span className="text-neutral-400">ข้อ {no}</span> {e.task}</p>
                      <span className={cn("shrink-0 text-xs font-semibold",
                        stuck === 0 ? "text-emerald-700" : stuck >= total / 2 ? "text-red-600" : "text-amber-700")}>
                        {stuck === 0 ? "ผ่านหมด" : `ติด ${stuck}/${total}`}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      ทำได้เอง {e.done} · ต้องช่วยบอก {e.helped} · ยอมแพ้ {e.gaveUp}
                      {avg > 0 && <> · เฉลี่ย {avg} วินาที</>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {rows.some((r) => r.details?.note) && (
        <Card>
          <CardHeader><CardTitle>สิ่งที่จดไว้ระหว่างทดสอบ</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {rows.filter((r) => r.details?.note).slice(0, 30).map((r, i) => (
              <div key={i} className="rounded-xl bg-neutral-50 px-3 py-2 text-sm">
                <p className="text-xs text-neutral-400">
                  ผู้ทดสอบ {r.details?.tester} · ข้อ {r.details?.task_no} ·{" "}
                  <span className={OUTCOME_TH[r.details?.outcome ?? ""]?.cls}>
                    {OUTCOME_TH[r.details?.outcome ?? ""]?.label ?? r.details?.outcome}
                  </span>
                </p>
                <p className="mt-0.5">{r.details?.note}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
