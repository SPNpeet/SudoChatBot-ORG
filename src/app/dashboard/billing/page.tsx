import { getCurrentShop } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { baht, dateTH } from "@/lib/utils";
import BillingClient from "./billing-client";

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
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">แพ็กเกจและเครดิต</h1>
        <p className="text-sm text-neutral-400">เติมเงิน จัดการแพ็กเกจ และดูการใช้งานของร้าน {shop.name}</p>
      </div>

      {dailyCap && quotaUsed >= quotaMax && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>⚠️ ใช้ครบโควตาฟรีวันนี้แล้ว ({quotaMax} ข้อความ/วัน) — บอทจะกลับมาตอบพรุ่งนี้ หรืออัปเกรดแพ็กเกจเพื่อเพิ่มโควตาต่อวัน</span>
        </div>
      )}
      {!dailyCap && balance <= 0 && usage.replies_count >= (plan?.included_replies ?? 0) && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>⚠️ เครดิตหมดและใช้เกินโควตาแพ็กเกจแล้ว — บอทจะหยุดตอบลูกค้าจนกว่าจะเติมเงินหรืออัปเกรดแพ็กเกจ</span>
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
        gateway={(pf as { payment_gateway?: string } | null)?.payment_gateway === "omise" ? "omise" : "promptpay_slip"}
        gatewayReady={
          (pf as { payment_gateway?: string } | null)?.payment_gateway === "omise"
            ? true // omise เช็ค key ตอนสร้างรายการ (error แสดง inline)
            : Boolean((pf as { promptpay_id?: string | null } | null)?.promptpay_id)
        }
      />

      {/* ประวัติเติมเงิน */}
      {(topups ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle>ประวัติการเติมเงิน</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(topups ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-neutral-100 px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium">{baht(t.amount)}</p>
                  <p className="text-[11px] text-neutral-400">{dateTH(t.created_at)}</p>
                </div>
                <Badge tone={t.status === "paid" ? "green" : t.status === "rejected" ? "red" : "amber"}>
                  {t.status === "paid" ? "สำเร็จ" : t.status === "verifying" ? "กำลังตรวจสลิป" : t.status === "rejected" ? "ไม่ผ่าน" : "รอชำระ"}
                </Badge>
              </div>
            ))}
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
                <span className="font-medium">{t.type === "topup" ? "เติมเงิน" : t.type === "debit" ? "ค่าบอทตอบ" : t.type === "bonus" ? "โบนัส" : "ปรับปรุง"}</span>
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
