import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import PaymentSettingsForm from "./payment-settings-form";
import TaxInfoForm from "./tax-info-form";
import TeamForm from "./team-form";
import type { ShopPaymentSettings } from "@/lib/types/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase, shop, role } = await getCurrentShop();
  const canEdit = role === "owner" || role === "admin";
  const [{ data: pay }, { data: members }, { data: taxInfo }] = await Promise.all([
    supabase.from("shop_payment_settings").select("*").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("shop_members").select("id, role, profiles(display_name, email)").eq("shop_id", shop.id),
    supabase.from("shops").select("billing_name,billing_address,tax_id").eq("id", shop.id).maybeSingle(),
  ]);
  const p = (pay ?? {}) as Partial<ShopPaymentSettings>;
  const memberRows = (members ?? []).map((m) => {
    const prof = m.profiles as unknown as { display_name: string | null; email: string | null } | null;
    return { id: m.id, role: m.role, display_name: prof?.display_name ?? null, email: prof?.email ?? null };
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">ตั้งค่า</h1>
        <p className="text-sm text-neutral-400">ข้อมูลกิจการ การรับเงิน และทีมของ {shop.name}</p>
      </div>

      {!canEdit && (
        <p className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">
          เฉพาะเจ้าของ/ผู้ดูแลตั้งค่าได้ — ติดต่อเจ้าของกิจการหากต้องการเปลี่ยนการตั้งค่า
        </p>
      )}

      {canEdit && (
        <>
          <Card>
            <CardHeader><CardTitle>🏢 ข้อมูลกิจการ (ขึ้นบนหัวเอกสาร/ใบกำกับภาษี)</CardTitle></CardHeader>
            <CardContent><TaxInfoForm shopId={shop.id} taxInfo={taxInfo} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>💸 การรับเงิน + ตรวจสลิปอัตโนมัติ</CardTitle></CardHeader>
            <CardContent><PaymentSettingsForm shopId={shop.id} p={p} /></CardContent>
          </Card>
        </>
      )}

      {/* ===== ทีม — สมาชิกดูรายชื่อได้ทุก role ===== */}
      <Card>
        <CardHeader><CardTitle>👥 ทีมงาน (สิทธิ์ตามบทบาท)</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-neutral-400">
            เจ้าของ/ผู้ดูแล = ทุกอย่าง · พนักงาน (agent) = ออกเอกสาร บันทึกเงิน ใช้ผู้ช่วย AI · ผู้ชม (viewer) = ดูรายงานอย่างเดียว — เชิญสำนักงานบัญชีของคุณเข้ามาเป็นผู้ดูแลได้เลย
          </p>
          <TeamForm shopId={shop.id} members={memberRows} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
