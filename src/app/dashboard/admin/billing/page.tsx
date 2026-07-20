import { requireUser } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { baht } from "@/lib/utils";
import { redirect } from "next/navigation";
import BillingSettingsForm from "./billing-settings-form";
import TopupRow from "./topup-row";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const { supabase } = await requireUser();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect("/dashboard");

  const svc = createServiceClient();
  const [{ data: rev }, { data: pending }, { data: pf }] = await Promise.all([
    supabase.rpc("platform_revenue"),
    svc.from("topups").select("*, shops(name)").in("status", ["pending", "verifying"]).order("created_at", { ascending: false }).limit(30),
    svc.from("platform_billing_settings").select("promptpay_id,account_name,slip_provider,payment_gateway,omise_public_key,company_name,company_address,tax_id,tax_branch,vat_registered,email_from,low_credit_threshold").eq("id", true).single(),
  ]);
  const r = (rev ?? {}) as Record<string, number>;

  const stats = [
    { label: "รายได้เติมเงินรวม", value: baht(r.total_topup ?? 0) },
    { label: "รายได้ 30 วัน", value: baht(r.topup_30d ?? 0) },
    { label: "ร้านทั้งหมด", value: String(r.total_shops ?? 0) },
    { label: "เครดิตคงค้างในระบบ", value: baht(r.wallet_outstanding ?? 0) },
  ];

  return (
    <div className="max-w-3xl space-y-6">
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
        <CardHeader><CardTitle>รอยืนยันการเติมเงิน ({(pending ?? []).length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(pending ?? []).length === 0 && <p className="py-4 text-center text-sm text-neutral-400">ไม่มีรายการรอยืนยัน</p>}
          {(pending ?? []).map((t) => {
            const shopName = (t.shops as unknown as { name: string } | null)?.name ?? "-";
            const slipUrl = t.slip_path ? svc.storage.from("slips").getPublicUrl(t.slip_path).data.publicUrl : null;
            return (
              <TopupRow key={t.id} id={t.id} shopName={shopName} amount={t.amount} status={t.status} createdAt={t.created_at} slipUrl={slipUrl} />
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>บัญชีรับเงินของแพลตฟอร์ม</CardTitle></CardHeader>
        <CardContent>
          <BillingSettingsForm pf={pf} />
        </CardContent>
      </Card>
    </div>
  );
}
