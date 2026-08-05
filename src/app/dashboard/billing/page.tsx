import { getCurrentShop } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, Badge, PageHeader } from "@/components/ui";
import { baht, dateTH } from "@/lib/utils";
import BillingClient from "./billing-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Plan { code: string; name: string; price_monthly: number; included_replies: number; price_per_extra_reply: number; features: string[]; sort: number; daily_reply_cap: number | null }

export default async function BillingPage() {
  const { supabase, shop, role } = await getCurrentShop();
  const svc = createServiceClient();

  const [{ data: summary }, { data: plans }, { data: txns }, { data: topups }, { data: pf }] = await Promise.all([
    supabase.rpc("billing_summary", { p_shop_id: shop.id }),
    svc.from("plans").select("*").eq("active", true).order("sort"),
    svc.from("wallet_transactions").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(20),
    svc.from("topups").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(10),
    svc.from("platform_billing_settings").select("payment_gateway,promptpay_id").eq("id", true).maybeSingle(),
  ]);

  const gw = (pf as { payment_gateway?: string } | null)?.payment_gateway;

  const s = (summary ?? {}) as { balance: number; plan: Plan; usage: { replies_count: number; billed_replies: number; billed_amount: number } };
  const balance = Number(s.balance ?? 0);
  const plan = s.plan;
  const usage = s.usage ?? { replies_count: 0, billed_replies: 0, billed_amount: 0 };

  // แพ็กฟรีคิดโควตาแบบรายวัน (30/วัน รีเซ็ตทุกวัน) — แพ็กจ่ายเงินคิดรายเดือน
  const planRow = (plans ?? []).find((p) => p.code === (plan?.code ?? "free")) as Plan | undefined;
  const dailyCap = plan?.code === "free" ? (planRow?.daily_reply_cap ?? 30) : null;
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // วันแบบเวลาไทย
  const { data: dailyRow } = await svc.from("usage_daily").select("replies_count").eq("shop_id", shop.id).eq("day", today).maybeSingle();
  const dailyUsed = Math.min(dailyRow?.replies_count ?? 0, dailyCap ?? Infinity);
  const freeUsed = Math.min(usage.replies_count, plan?.included_replies ?? 0);
  const quotaUsed = dailyCap ? dailyUsed : freeUsed;
  const quotaMax = dailyCap ?? (plan?.included_replies ?? 0);
  const quotaPct = quotaMax ? Math.round((quotaUsed / quotaMax) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="แพ็กเกจและเครดิต"
        lead={<>จัดการแพ็กเกจของ {shop.name}</>}
        help="ค่าบริการคิดตามแพ็กเกจที่เลือก ไม่มีสัญญาผูกมัด ยกเลิกได้ตลอด · ที่จำกัดคือ “งาน AI” (ผู้ช่วย + อ่านบิล) เท่านั้น — การออกเอกสาร ลงบัญชี และดูรายงานเองใช้ได้ไม่จำกัดทุกแพ็ก แม้โควตา AI หมด"
      />

      {dailyCap && quotaUsed >= quotaMax && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>ใช้ครบโควตา AI ฟรีวันนี้แล้ว ({quotaMax} ครั้ง/วัน) — พรุ่งนี้ใช้ต่อได้ หรืออัปเกรดแพ็กเกจเพื่อเพิ่มโควตา (คีย์เอกสารเองได้ไม่จำกัด)</span>
        </div>
      )}
      {!dailyCap && balance <= 0 && usage.replies_count >= (plan?.included_replies ?? 0) && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>เครดิตหมดและใช้เกินโควตาแพ็กเกจแล้ว — งาน AI (อ่านบิล/ผู้ช่วย) จะหยุดจนกว่าจะเติมเงินหรืออัปเกรด (คีย์เอกสารเองยังใช้ได้ปกติ)</span>
        </div>
      )}

      {/* ยอดเครดิต + ใช้งาน */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-neutral-400">เครดิตคงเหลือ</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-600">{baht(balance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-neutral-400">แพ็กเกจปัจจุบัน</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{plan?.name ?? "-"}</p>
            <p className="text-[11px] text-neutral-400">{plan?.price_monthly ? `${baht(plan.price_monthly)}/เดือน` : "ฟรี"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-neutral-400">{dailyCap ? "โควตาฟรีวันนี้ (รีเซ็ตทุกวัน)" : "โควตาฟรีเดือนนี้"}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{quotaUsed.toLocaleString()}<span className="text-sm font-normal text-neutral-400">/{quotaMax.toLocaleString()}</span></p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className={`h-full rounded-full ${quotaPct >= 100 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(quotaPct, 100)}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <BillingClient
        shopId={shop.id}
        role={role}
        balance={balance}
        currentPlan={plan?.code ?? "free"}
        plans={(plans ?? []) as Plan[]}
        gateway={gw === "omise" ? "omise" : gw === "stripe" ? "stripe" : "promptpay_slip"}
        gatewayReady={
          gw === "omise" || gw === "stripe"
            ? true // gateway เช็ค key ตอนสร้างรายการ (error แสดง inline ตรงปุ่ม)
            : Boolean((pf as { promptpay_id?: string | null } | null)?.promptpay_id)
        }
      />

      {/* ประวัติเติมเงิน */}
      {(topups ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle>ประวัติการเติมเงิน</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {/* รายการที่จ่ายสำเร็จกดดูใบเสร็จได้ — ก่อนหน้านี้หน้าใบเสร็จมีอยู่จริงแต่ไม่มีทางเข้าถึงเลย */}
            {(topups ?? []).map((t) => {
              const paid = t.status === "paid";
              const body = (
                <>
                  <div>
                    <p className="text-sm font-medium tabular-nums">{baht(t.amount)}</p>
                    <p className="text-[11px] text-neutral-400">{dateTH(t.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={paid ? "green" : t.status === "rejected" ? "red" : "amber"}>
                      {paid ? "สำเร็จ" : t.status === "verifying" ? "กำลังตรวจสลิป" : t.status === "rejected" ? "ไม่ผ่าน" : "รอชำระ"}
                    </Badge>
                    {paid && <span className="hidden items-center gap-1 text-[11px] font-medium text-emerald-700 sm:inline-flex">ดูใบเสร็จ →</span>}
                  </div>
                </>
              );
              return paid ? (
                <Link key={t.id} href={`/dashboard/billing/receipt/${t.id}`}
                  className="flex items-center justify-between rounded-xl border border-neutral-100 px-4 py-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40">
                  {body}
                </Link>
              ) : (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-neutral-100 px-4 py-3">
                  {body}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ledger */}
      <Card>
        <CardHeader><CardTitle>รายการเครดิต</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {(txns ?? []).length === 0 && <p className="py-3 text-center text-sm text-neutral-400">ยังไม่มีรายการ</p>}
          {(txns ?? []).map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-neutral-50 py-2 text-sm last:border-0">
              <div>
                <span className="font-medium">{t.type === "topup" ? "เติมเงิน" : t.type === "debit" ? "ค่างาน AI" : t.type === "bonus" ? "โบนัส" : "ปรับปรุง"}</span>
                {t.note && <span className="text-[11px] text-neutral-400"> · {t.note}</span>}
                <p className="text-[11px] text-neutral-400">{dateTH(t.created_at)}</p>
              </div>
              <div className="text-right">
                <span className={Number(t.amount) >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-neutral-800"}>
                  {Number(t.amount) >= 0 ? "+" : ""}{baht(t.amount)}
                </span>
                <p className="text-[11px] text-neutral-400">คงเหลือ {baht(t.balance_after)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
