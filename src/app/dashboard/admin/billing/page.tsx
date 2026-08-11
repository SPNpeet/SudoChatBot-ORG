import { requireUser } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { baht } from "@/lib/utils";
import { redirect } from "next/navigation";
import BillingSettingsForm from "./billing-settings-form";
import PendingTopupsList from "./pending-topups-list";
import StripeStatusCard from "./stripe-status-card";
import type { PendingTopup } from "./actions";

export const dynamic = "force-dynamic";
const TOPUPS_PAGE_SIZE = 30;

/**
 * ย่อคีย์ให้เห็นว่า "ตัวไหน" โดยไม่เปิดเผยคีย์ — sk_test_••••mocb
 *
 * ⚠️ ส่งลง client ได้เฉพาะรูปนี้เท่านั้น ห้ามส่งค่าเต็มเด็ดขาด
 * ส่วนที่โชว์คือ prefix (บอกว่าเป็นคีย์ทดสอบหรือคีย์จริง — สำคัญมาก เพราะใส่ sk_test_
 * บน production แปลว่าไม่มีเงินเข้าจริงสักบาท) กับ 4 ตัวท้ายไว้เทียบกับหน้า Stripe
 * เท่ากับที่ Stripe Dashboard เองโชว์ ไม่ได้เพิ่มความเสี่ยงจากเดิม
 */
function maskKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const m = s.match(/^([a-z]+_[a-z]+_)/);          // sk_test_ / sk_live_ / whsec_ ไม่เข้าเงื่อนไขนี้
  const prefix = m ? m[1] : s.slice(0, 6);
  return `${prefix}••••${s.slice(-4)}`;
}

export default async function AdminBillingPage() {
  const { supabase } = await requireUser();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect("/dashboard");

  const svc = createServiceClient();
  const [{ data: rev }, { data: pending }, { data: pf }] = await Promise.all([
    supabase.rpc("platform_revenue"),
    svc.from("topups").select("id,amount,status,created_at,slip_path,plan_code,plan_period,shops(name)").in("status", ["pending", "verifying"]).order("created_at", { ascending: false }).range(0, TOPUPS_PAGE_SIZE),
    svc.from("platform_billing_settings").select("account_name,slip_provider,company_name,company_address,tax_id,tax_branch,vat_registered,email_from,low_credit_threshold,slip_monthly_cap").eq("id", true).single(),
  ]);
  // จำนวนครั้งที่ยิง API ตรวจสลิปเดือนนี้ (ทั้งแพลตฟอร์ม) — ให้เจ้าของเห็นก่อนโควตาหมด
  const monthStart = new Date(Date.now() + 7 * 3600_000);
  const { data: slipMonth } = await svc.from("platform_slip_monthly").select("calls")
    .eq("month", `${monthStart.toISOString().slice(0, 7)}-01`).maybeSingle();
  // ⚠️ ช่องคีย์เป็น type=password และไม่เคยแสดงค่าที่เก็บไว้ (ถูกต้องแล้ว — ห้ามส่งคีย์กลับมาที่ client)
  // แต่เดิมมันแปลว่าเปิดหน้านี้มาแล้ว "ช่องว่างเปล่า" ทั้งที่คีย์ถูกเก็บใน Vault เรียบร้อย
  // เกิดจริง 8 ส.ค. 2569: เจ้าของกรอก secret key แล้วโหลดหน้าใหม่ เห็นช่องว่าง เข้าใจว่าไม่ได้บันทึก
  // จึงกรอกใหม่ซ้ำ ๆ และไม่มีทางรู้ว่าตอนนี้ระบบรับเงินได้จริงหรือยัง
  // ทางแก้: ส่งมาแค่ "มี/ไม่มี" (boolean) ไม่ส่งค่าคีย์ — พอบอกสถานะได้โดยไม่ทำให้คีย์รั่ว
  const [{ data: skKey }, { data: skWh }, { data: slipKey }] = await Promise.all([
    svc.rpc("get_platform_stripe_key"),
    svc.rpc("get_platform_stripe_webhook_secret"),
    svc.rpc("get_platform_slip_key"),
  ]);
  const stored = {
    stripeKey: maskKey(skKey),
    stripeWebhook: maskKey(skWh),
    slipKey: maskKey(slipKey),
  };

  const r = (rev ?? {}) as Record<string, number>;
  const pendingAll = pending ?? [];
  const pendingRows: PendingTopup[] = pendingAll.slice(0, TOPUPS_PAGE_SIZE).map((t) => ({
    id: t.id,
    shopName: (t.shops as unknown as { name: string } | null)?.name ?? "-",
    amount: t.amount,
    status: t.status,
    createdAt: t.created_at,
    slipUrl: t.slip_path ? svc.storage.from("slips").getPublicUrl(t.slip_path).data.publicUrl : null,
    planLabel: t.plan_code ? `ซื้อแพ็ก ${t.plan_code}${t.plan_period === "yearly" ? " (รายปี 12 เดือน)" : ""}` : null,
  }));
  const pendingHasMore = pendingAll.length > TOPUPS_PAGE_SIZE;

  const stats = [
    { label: "รายได้เติมเงินรวม", value: baht(r.total_topup ?? 0) },
    { label: "รายได้ 30 วัน", value: baht(r.topup_30d ?? 0) },
    { label: "ร้านทั้งหมด", value: String(r.total_shops ?? 0) },
    { label: "เครดิตคงค้างในระบบ", value: baht(r.wallet_outstanding ?? 0) },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">ภาพรวมรายได้ (ผู้ดูแลแพลตฟอร์ม)</h1>
        <p className="text-sm text-neutral-400">รายได้จากการเติมเงิน · ยืนยันสลิป · ตั้งค่าบัญชีรับเงิน</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}><CardContent className="pt-5">
            <p className="text-xs text-neutral-400">{s.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>รอยืนยันการเติมเงิน ({pendingRows.length}{pendingHasMore ? "+" : ""})</CardTitle></CardHeader>
        <CardContent>
          <PendingTopupsList initial={pendingRows} initialHasMore={pendingHasMore} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>บัญชีรับเงินของแพลตฟอร์ม</CardTitle></CardHeader>
        <CardContent>
          <BillingSettingsForm pf={pf} slipUsed={slipMonth?.calls ?? 0} stored={stored} />
        </CardContent>
      </Card>
      {/* วางไว้ใต้ฟอร์มใส่คีย์ — ใส่เสร็จแล้วเลื่อนลงมาดูได้ทันทีว่าพอหรือยัง */}
      <StripeStatusCard />
    </div>
  );
}
