import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, Th, Td } from "@/components/ui";
import { baht, dateTH, PLAN_TH } from "@/lib/utils";
import { Users, Store, Wallet, MessageSquare, Activity, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

// ============================================================
//  แดชบอร์ดแพลตฟอร์ม (แอดมิน) — ยอดผู้ใช้/ร้าน/รายได้/ต้นทุน AI/สุขภาพระบบ
//  ข้อมูลทั้งหมดมาจาก RPC platform_stats() (SECURITY DEFINER, แอดมินเท่านั้น)
// ============================================================

interface Stats {
  users: { total: number; new_today: number; new_7d: number; active_24h: number };
  shops: { total: number; active: number; new_7d: number; by_plan: Record<string, number> };
  revenue: { topups_paid_total: number; topups_paid_30d: number; billed_this_month: number; credit_outstanding: number; pending_topups: number };
  usage: { messages_total: number; messages_today: number; bot_replies_month: number; ai_cost_month_usd: number; active_conversations_15m: number };
  orders: { total: number; paid_month: number; gmv_month: number };
  health: { webhook_failed_24h: number; client_errors_7d: number; shops_blocked: number };
  daily: { d: string; users: number; msgs: number }[];
  recent_shops: { name: string; plan: string; created_at: string; owner_email: string | null }[];
  recent_topups: { amount: number; status: string; created_at: string; shop: string | null }[];
}

const USD_THB = 36; // อัตราประมาณสำหรับแสดงต้นทุน AI เป็นบาท

function Stat({ label, value, sub, icon: Icon, tone = "neutral" }: {
  label: string; value: string; sub?: string; icon: React.ElementType; tone?: "neutral" | "green" | "red" | "amber";
}) {
  const color = tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-neutral-900";
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="flex items-center gap-1.5 text-xs text-neutral-400"><Icon className="h-3.5 w-3.5" /> {label}</p>
        <p className={`mt-1 text-2xl font-bold tracking-tight ${color}`}>{value}</p>
        {sub && <p className="text-[11px] text-neutral-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default async function PlatformStatsPage() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect("/dashboard");
  const [{ data, error }, { data: fbRows }] = await Promise.all([
    supabase.rpc("platform_stats"),
    // RLS: อ่าน feedback ได้เฉพาะแอดมิน (policy feedback_admin_read)
    supabase.from("feedback").select("message,page,created_at,shops(name)").order("created_at", { ascending: false }).limit(8),
  ]);
  if (error || !data) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">โหลดสถิติไม่สำเร็จ: {error?.message ?? "ไม่มีข้อมูล"}</p>;
  }
  const s = data as unknown as Stats;
  const maxMsgs = Math.max(1, ...s.daily.map((d) => d.msgs));
  const maxUsers = Math.max(1, ...s.daily.map((d) => d.users));
  const healthIssues = s.health.webhook_failed_24h + s.health.client_errors_7d + s.health.shops_blocked;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">แดชบอร์ดแพลตฟอร์ม</h1>
          <p className="text-sm text-neutral-400">ยอดรวมทั้งระบบแบบเรียลไทม์ — เห็นเฉพาะผู้ดูแลแพลตฟอร์ม</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard/admin" className="text-emerald-600 hover:underline">→ ศูนย์ AI</Link>
          <Link href="/dashboard/admin/billing" className="text-emerald-600 hover:underline">→ รายได้ + ยืนยันเติมเงิน</Link>
          <Link href="/dashboard/admin/shops" className="text-emerald-600 hover:underline">→ จัดการร้านค้า</Link>
          <Link href="/dashboard/admin/feedback" className="text-emerald-600 hover:underline">→ ความเห็นผู้ใช้</Link>
          <Link href="/dashboard/admin/logs" className="text-emerald-600 hover:underline">→ Audit Log</Link>
        </div>
      </div>

      {/* ===== ผู้ใช้ ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="ผู้ใช้ทั้งหมด" value={s.users.total.toLocaleString()} sub={`สมัครวันนี้ ${s.users.new_today} · 7 วัน ${s.users.new_7d}`} />
        <Stat icon={Activity} label="ผู้ใช้ active (24 ชม.)" value={s.users.active_24h.toLocaleString()} tone="green" sub={`แชทลูกค้ากำลังคุย (15 นาที) ${s.usage.active_conversations_15m}`} />
        <Stat icon={Store} label="ร้านค้าทั้งหมด" value={`${s.shops.active}/${s.shops.total}`} sub={`เปิดใหม่ 7 วัน ${s.shops.new_7d} · ${Object.entries(s.shops.by_plan).map(([p, c]) => `${PLAN_TH[p] ?? p} ${c}`).join(" · ")}`} />
        <Stat icon={MessageSquare} label="ข้อความวันนี้" value={s.usage.messages_today.toLocaleString()} sub={`สะสมทั้งหมด ${s.usage.messages_total.toLocaleString()} · บอทตอบเดือนนี้ ${s.usage.bot_replies_month.toLocaleString()}`} />
      </div>

      {/* ===== เงิน ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Wallet} label="รายได้เติมเงิน (30 วัน)" value={baht(s.revenue.topups_paid_30d)} tone="green" sub={`สะสมทั้งหมด ${baht(s.revenue.topups_paid_total)}`} />
        <Stat icon={Wallet} label="เก็บจากเกินโควตาเดือนนี้" value={baht(s.revenue.billed_this_month)} sub="หักจากเครดิตร้านอัตโนมัติ" />
        <Stat icon={Wallet} label="ต้นทุน AI เดือนนี้" value={`~${baht(s.usage.ai_cost_month_usd * USD_THB)}`} tone="amber" sub={`$${s.usage.ai_cost_month_usd} (ประมาณที่ ${USD_THB}฿/$)`} />
        <Stat icon={Wallet} label="เครดิตค้างในระบบ" value={baht(s.revenue.credit_outstanding)} sub="ยอดที่ร้านเติมแล้วยังไม่ใช้ (ภาระผูกพัน)" />
      </div>

      {/* ===== สุขภาพระบบ + ออเดอร์ ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={AlertTriangle} label="สลิปเติมเงินรอตรวจ" value={String(s.revenue.pending_topups)} tone={s.revenue.pending_topups > 0 ? "amber" : "neutral"} sub={s.revenue.pending_topups > 0 ? "ไปยืนยันที่หน้า รายได้" : "ไม่มีค้าง"} />
        <Stat icon={AlertTriangle} label="ร้านที่บอทหยุด (เครดิตหมด)" value={String(s.health.shops_blocked)} tone={s.health.shops_blocked > 0 ? "red" : "green"} />
        <Stat icon={AlertTriangle} label="Webhook ล้มเหลว (24 ชม.)" value={String(s.health.webhook_failed_24h)} tone={s.health.webhook_failed_24h > 0 ? "red" : "green"} sub={`Error ฝั่งผู้ใช้ 7 วัน: ${s.health.client_errors_7d}`} />
        <Stat icon={Store} label="ออเดอร์จ่ายแล้วเดือนนี้" value={String(s.orders.paid_month)} sub={`GMV ${baht(s.orders.gmv_month)} · สะสม ${s.orders.total} ออเดอร์`} />
      </div>
      {healthIssues === 0 && (
        <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">✓ ระบบปกติทุกจุด — ไม่มี webhook ล้มเหลว ไม่มี error ฝั่งผู้ใช้ ไม่มีร้านถูกบล็อก</p>
      )}

      {/* ===== กราฟ 14 วัน ===== */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>สมัครใหม่รายวัน (14 วัน)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-28 items-end gap-1">
              {s.daily.map((d) => (
                <div key={d.d} className="flex flex-1 flex-col items-center gap-1" title={`${d.d}: ${d.users} คน`}>
                  <span className="text-[9px] text-neutral-400">{d.users || ""}</span>
                  <div className="w-full rounded-t bg-emerald-400" style={{ height: `${Math.max(4, (d.users / maxUsers) * 80)}px` }} />
                  <span className="text-[8px] text-neutral-300">{d.d.slice(3)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>ข้อความรายวัน (14 วัน)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-28 items-end gap-1">
              {s.daily.map((d) => (
                <div key={d.d} className="flex flex-1 flex-col items-center gap-1" title={`${d.d}: ${d.msgs} ข้อความ`}>
                  <span className="text-[9px] text-neutral-400">{d.msgs || ""}</span>
                  <div className="w-full rounded-t bg-sky-400" style={{ height: `${Math.max(4, (d.msgs / maxMsgs) * 80)}px` }} />
                  <span className="text-[8px] text-neutral-300">{d.d.slice(3)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== เสียงจากผู้ใช้ ===== */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>ความเห็นล่าสุดจากผู้ใช้ (ปุ่มแนะนำ/ติชมในแอป)</CardTitle>
          <Link href="/dashboard/admin/feedback" className="text-xs text-emerald-600 hover:underline">ดูทั้งหมด &rarr;</Link>
        </CardHeader>
        <CardContent>
          {!fbRows?.length ? (
            <p className="text-sm text-neutral-400">ยังไม่มีความเห็นเข้ามา — ปุ่มแนะนำ/ติชมโชว์ทุกหน้าของผู้ใช้แล้ว</p>
          ) : (
            <div className="space-y-2">
              {(fbRows as unknown as { message: string; page: string | null; created_at: string; shops: { name: string } | null }[]).map((f, i) => (
                <div key={i} className="rounded-xl border border-neutral-100 px-4 py-2.5">
                  <p className="text-sm">{f.message}</p>
                  <p className="mt-1 text-[11px] text-neutral-400">{f.shops?.name ?? "-"} · {f.page ?? "-"} · {dateTH(f.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== รายการล่าสุด ===== */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>ร้านค้าล่าสุด</CardTitle>
            <Link href="/dashboard/admin/shops" className="text-xs text-emerald-600 hover:underline">ดูทั้งหมด &rarr;</Link>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-0">
            <Table>
              <thead><tr><Th>ร้าน</Th><Th>แพ็ก</Th><Th>เจ้าของ</Th><Th>สมัครเมื่อ</Th></tr></thead>
              <tbody>
                {s.recent_shops.map((r, i) => (
                  <tr key={i}>
                    <Td className="font-medium">{r.name}</Td>
                    <Td><Badge tone={r.plan === "free" ? "neutral" : "green"}>{PLAN_TH[r.plan] ?? r.plan}</Badge></Td>
                    <Td className="text-neutral-500">{r.owner_email ?? "-"}</Td>
                    <Td className="text-neutral-400">{dateTH(r.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>เติมเงินล่าสุด</CardTitle></CardHeader>
          <CardContent className="px-0 pb-0 pt-0">
            {s.recent_topups.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-neutral-400">ยังไม่มีรายการเติมเงิน</p>
            ) : (
              <Table>
                <thead><tr><Th>ร้าน</Th><Th>จำนวน</Th><Th>สถานะ</Th><Th>เมื่อ</Th></tr></thead>
                <tbody>
                  {s.recent_topups.map((t, i) => (
                    <tr key={i}>
                      <Td className="font-medium">{t.shop ?? "-"}</Td>
                      <Td>{baht(t.amount)}</Td>
                      <Td><Badge tone={t.status === "paid" ? "green" : t.status === "rejected" ? "red" : "amber"}>
                        {t.status === "paid" ? "สำเร็จ" : t.status === "verifying" ? "รอตรวจสลิป" : t.status === "rejected" ? "ไม่ผ่าน" : t.status === "expired" ? "หมดอายุ" : "รอชำระ"}
                      </Badge></Td>
                      <Td className="text-neutral-400">{dateTH(t.created_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
