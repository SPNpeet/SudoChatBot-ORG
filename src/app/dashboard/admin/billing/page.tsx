import { requireUser } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, Badge } from "@/components/ui";
import { baht, dateTH } from "@/lib/utils";
import { confirmTopup, savePlatformBilling } from "./actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const { supabase } = await requireUser();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect("/dashboard");

  const svc = createServiceClient();
  const [{ data: rev }, { data: pending }, { data: pf }] = await Promise.all([
    supabase.rpc("platform_revenue"),
    svc.from("topups").select("*, shops(name)").in("status", ["pending", "verifying"]).order("created_at", { ascending: false }).limit(30),
    svc.from("platform_billing_settings").select("promptpay_id,account_name,slip_provider,payment_gateway,omise_public_key,company_name,company_address,tax_id,tax_branch,vat_registered").eq("id", true).single(),
  ]);
  const r = (rev ?? {}) as Record<string, number>;

  async function confirm(fd: FormData) { "use server"; await confirmTopup(String(fd.get("id")), fd.get("approve") === "1"); }
  async function saveBilling(fd: FormData) { "use server"; await savePlatformBilling(fd); }

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
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-neutral-100 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{shopName} · {baht(t.amount)}</p>
                  <p className="text-[11px] text-neutral-400">{dateTH(t.created_at)} · <Badge tone={t.status === "verifying" ? "amber" : "neutral"}>{t.status === "verifying" ? "อัปโหลดสลิปแล้ว" : "รอชำระ"}</Badge>
                    {slipUrl && <> · <a href={slipUrl} target="_blank" rel="noreferrer" className="text-sky-600">ดูสลิป</a></>}</p>
                </div>
                <div className="flex gap-1.5">
                  <form action={confirm}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="approve" value="1" />
                    <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">ยืนยัน + เครดิต</button></form>
                  <form action={confirm}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="approve" value="0" />
                    <button className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50">ปฏิเสธ</button></form>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>บัญชีรับเงินของแพลตฟอร์ม</CardTitle></CardHeader>
        <CardContent>
          <form action={saveBilling} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>พร้อมเพย์ (รับเงินเติม)</Label><Input name="promptpay_id" defaultValue={pf?.promptpay_id ?? ""} placeholder="เบอร์/เลขบัตร ปชช." /></div>
              <div><Label>ชื่อบัญชี</Label><Input name="account_name" defaultValue={pf?.account_name ?? ""} /></div>
            </div>
            <div>
              <Label>ช่องทางรับเงินเติมเครดิต</Label>
              <Select name="payment_gateway" defaultValue={pf?.payment_gateway ?? "promptpay_slip"}>
                <option value="promptpay_slip">PromptPay + ตรวจสลิป (trust-based)</option>
                <option value="omise">Omise — PromptPay ผ่าน gateway (auto settle, แนะนำ)</option>
              </Select>
            </div>
            <div>
              <Label>Omise (opn.ooo) — ใช้เมื่อเลือก gateway Omise</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input name="omise_public_key" defaultValue={pf?.omise_public_key ?? ""} placeholder="Public key (pkey_...)" />
                <Input name="omise_secret_key" type="password" placeholder="Secret key (skey_... กรอกเมื่อเปลี่ยน)" />
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">Secret key เก็บใน Vault · ตั้ง webhook ใน Omise dashboard ไปที่ <span className="font-mono">/api/billing/omise/webhook</span></p>
            </div>
            <div>
              <Label>ตรวจสลิปเติมเงินอัตโนมัติ (โหมด PromptPay+สลิป)</Label>
              <div className="grid grid-cols-2 gap-3">
                <Select name="slip_provider" defaultValue={pf?.slip_provider ?? "manual"}>
                  <option value="manual">ยืนยันเอง (กดปุ่มข้างบน)</option>
                  <option value="easyslip">EasySlip — อัตโนมัติ</option>
                  <option value="slipok">SlipOK — อัตโนมัติ</option>
                </Select>
                <Input name="slip_api_key" type="password" placeholder="API Key (กรอกเมื่อเปลี่ยน)" />
              </div>
            </div>
            <div className="border-t border-neutral-100 pt-3">
              <Label>ข้อมูลผู้ขายบนใบกำกับภาษี (VAT 7%)</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input name="company_name" defaultValue={pf?.company_name ?? ""} placeholder="ชื่อบริษัท/ผู้ประกอบการ" />
                <Input name="tax_id" defaultValue={pf?.tax_id ?? ""} placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก" maxLength={13} />
                <Input name="company_address" defaultValue={pf?.company_address ?? ""} placeholder="ที่อยู่จดทะเบียน" className="col-span-2" />
                <Input name="tax_branch" defaultValue={pf?.tax_branch ?? "สำนักงานใหญ่"} placeholder="สาขา" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="vat_registered" defaultChecked={pf?.vat_registered ?? false} className="h-4 w-4 accent-emerald-600" />
                  จด VAT แล้ว — ออกใบกำกับภาษี (ราคารวม VAT)
                </label>
              </div>
            </div>
            <Button size="sm">บันทึกบัญชีรับเงิน</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
