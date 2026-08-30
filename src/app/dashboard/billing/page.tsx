import { getCurrentShop, isPlatformAdmin } from "@/lib/shop";
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

  const [{ data: summary }, { data: plans }, { data: txns }, { data: topups }, { data: pf }, { data: quotaRaw }] = await Promise.all([
    supabase.rpc("billing_summary", { p_shop_id: shop.id }),
    svc.from("plans").select("*").eq("active", true).order("sort"),
    svc.from("wallet_transactions").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(20),
    svc.from("topups").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(10),
    // ตรวจว่าตั้งคีย์ Stripe แล้วหรือยัง — แปลงเป็น boolean ทันที
    // ⚠️ ห้ามส่งค่าคีย์ลงไปที่ BillingClient เด็ดขาด (เป็น client component = หลุดถึงเบราว์เซอร์)
    svc.rpc("get_platform_stripe_key"),
    // ⚠️ โควตา AI ต้องมาจาก get_ai_quota_status ตัวเดียว — ตัวเดียวกับที่ตัดจริงและที่ sidebar โชว์
    // ภาพจริงจากมือถือ 30 ส.ค. 2569: sidebar บอก "8/15" แต่หน้านี้บอก "0/15 · เหลือ 15 จาก 15"
    // เพราะหน้านี้เดิมนับจาก billing_summary (usage รายกิจการ) แต่ตัวที่ตัดนับ ai_usage_logs
    // (assistant+ocr รวมทุกกิจการของเจ้าของ) — เลขคนละตัวบนเรื่องเดียวกัน = ผู้ใช้ไม่เชื่อระบบ
    // บทเรียนเดียวกับกฎบัญชี: กฎที่อยู่สองที่จะเพี้ยนเสมอ
    supabase.rpc("get_ai_quota_status", { p_shop_id: shop.id }),
  ]);
  const quota = (quotaRaw ?? null) as {
    used_today: number; cap_today: number | null; used_month: number; cap_month: number | null;
  } | null;

  // ⚠️ "มีคีย์" ไม่เท่ากับ "รับเงินได้" — คีย์ sk_test รับได้แค่บัตรทดสอบ
  // ปล่อยให้ลูกค้าจริงเห็นปุ่มจ่ายเงินทั้งที่จ่ายไม่ผ่าน = เสียลูกค้าฟรี ๆ
  // และเปิดช่องให้คนที่รู้เลขบัตรทดสอบกดรับแพ็กเสียเงินฟรี (ด่านจริงอยู่ใน actions.ts)
  // แอดมินแพลตฟอร์มยังเห็นปุ่มอยู่ เพื่อทดสอบเส้นจ่ายเงินให้ครบก่อนเปิดจริง
  const key = typeof pf === "string" && pf.trim() ? pf.trim() : (process.env.STRIPE_SECRET_KEY ?? "");
  const { isLiveStripeKey } = await import("@/lib/stripe");
  const stripeReady = key.length > 0 && (isLiveStripeKey(key) || (await isPlatformAdmin()));

  const s = (summary ?? {}) as { balance: number; plan: Plan; usage: { replies_count: number; billed_replies: number; billed_amount: number } };
  const balance = Number(s.balance ?? 0);
  const plan = s.plan;
  const usage = s.usage ?? { replies_count: 0, billed_replies: 0, billed_amount: 0 };

  // ⚠️ โควตาที่แสดงต้องตรงกับที่ระบบตัดจริง (แก้ 6 ส.ค. 2569)
  //
  // ของเดิมเขียนว่า `plan.code === "free" ? (daily_reply_cap ?? 30) : null`
  // แต่ในฐานข้อมูลแพ็กฟรีมี daily_reply_cap = NULL และ included_replies = 15
  // ตัวที่ตัดจริงคือ get_ai_quota_status ซึ่งใช้ "รายเดือน 15 ครั้ง"
  // ผลคือหน้านี้ขึ้นว่า "โควตาฟรีวันนี้ 0/30 · รีเซ็ตทุกวัน" และพอเต็มก็บอกว่า
  // "พรุ่งนี้ใช้ต่อได้" ทั้งที่ผู้ใช้ถูกตัดตั้งแต่ครั้งที่ 15 และพรุ่งนี้ก็ยังใช้ไม่ได้
  // = บอกตัวเลขผิดและให้คำแนะนำที่ทำตามแล้วไม่ได้ผล
  //
  // กติกาที่ต้องคงไว้: เพดานรายวันมีจริงเฉพาะแพ็กที่ตั้ง daily_reply_cap ไว้เท่านั้น
  // ห้ามใส่ค่าสำรองเป็นตัวเลข — ไม่รู้ ต้องไม่เดา
  const planRow = (plans ?? []).find((p) => p.code === (plan?.code ?? "free")) as Plan | undefined;
  const dailyCap = quota?.cap_today ?? planRow?.daily_reply_cap ?? null;
  const monthlyCap = quota?.cap_month ?? plan?.included_replies ?? planRow?.included_replies ?? 0;
  const quotaUsed = dailyCap ? (quota?.used_today ?? 0) : Math.min(quota?.used_month ?? usage.replies_count, monthlyCap);
  const quotaMax = dailyCap ?? monthlyCap;
  const quotaPct = quotaMax ? Math.round((quotaUsed / quotaMax) * 100) : 0;
  const monthlyFull = monthlyCap > 0 && usage.replies_count >= monthlyCap;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="แพ็กเกจและเครดิต"
        lead={<>แพ็กปัจจุบัน <b>{plan?.name ?? "ทดลองใช้"}</b>{quotaMax > 0 && <> · โควตา AI เหลือ <b>{Math.max(0, quotaMax - quotaUsed).toLocaleString()}</b> จาก {quotaMax.toLocaleString()} {dailyCap ? "วันนี้" : "เดือนนี้"}</>}</>}
        help="ค่าบริการคิดตามแพ็กเกจที่เลือก ไม่มีสัญญาผูกมัด ยกเลิกได้ตลอด · ที่จำกัดคือ “งาน AI” (ผู้ช่วย + อ่านบิล) เท่านั้น — การออกเอกสาร ลงบัญชี และดูรายงานเองใช้ได้ไม่จำกัดทุกแพ็ก แม้โควตา AI หมด"
      />

      {dailyCap !== null && quotaUsed >= dailyCap && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>ใช้ครบโควตา AI วันนี้แล้ว ({dailyCap.toLocaleString()} ครั้ง/วัน) — พรุ่งนี้ใช้ต่อได้ หรืออัปเกรดแพ็กเกจเพื่อเพิ่มโควตา (คีย์เอกสารเองได้ไม่จำกัด)</span>
        </div>
      )}
      {monthlyFull && balance <= 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {/* ห้ามบอกว่า "พรุ่งนี้ใช้ต่อได้" ในกรณีนี้ — โควตารายเดือนรีเซ็ตต้นเดือนถัดไปเท่านั้น */}
          <span>ใช้ครบโควตา AI ของแพ็กเกจเดือนนี้แล้ว ({monthlyCap.toLocaleString()} ครั้ง/เดือน) และไม่มีเครดิตคงเหลือ — งาน AI (อ่านบิล/ผู้ช่วย) จะหยุดจนกว่าจะเติมเครดิตหรืออัปเกรด · โควตารีเซ็ตต้นเดือนหน้า · คีย์เอกสารเองยังใช้ได้ปกติ</span>
        </div>
      )}

      {/* ยอดเครดิต + ใช้งาน */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-3">
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
            <p className="text-xs text-neutral-400">{plan?.price_monthly ? `${Number(plan.price_monthly).toLocaleString("th-TH")} บาท/เดือน` : "ฟรี"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-neutral-400">{dailyCap ? "โควตา AI วันนี้ (รีเซ็ตทุกวัน)" : "โควตา AI เดือนนี้ (รีเซ็ตต้นเดือน)"}</p>
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
        gatewayReady={stripeReady}
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
                    <p className="text-xs text-neutral-400">{dateTH(t.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={paid ? "green" : t.status === "rejected" ? "red" : "amber"}>
                      {paid ? "สำเร็จ" : t.status === "verifying" ? "กำลังตรวจสลิป" : t.status === "rejected" ? "ไม่ผ่าน" : "รอชำระ"}
                    </Badge>
                    {paid && <span className="hidden items-center gap-1 text-xs font-medium text-emerald-700 sm:inline-flex">ดูใบเสร็จ →</span>}
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
                {t.note && <span className="text-xs text-neutral-400"> · {t.note}</span>}
                <p className="text-xs text-neutral-400">{dateTH(t.created_at)}</p>
              </div>
              <div className="text-right">
                <span className={Number(t.amount) >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-neutral-800"}>
                  {Number(t.amount) >= 0 ? "+" : ""}{baht(t.amount)}
                </span>
                <p className="text-xs text-neutral-400">คงเหลือ {baht(t.balance_after)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
