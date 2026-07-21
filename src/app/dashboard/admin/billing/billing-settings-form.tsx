"use client";
// ฟอร์มตั้งค่าบัญชีรับเงินแพลตฟอร์ม — ต้องมี feedback ชัดเจนหลังกดบันทึก
// (บั๊กเดิม: กดแล้วเงียบ ผู้ใช้คิดว่ากดไม่ติดทั้งที่บันทึกสำเร็จจริง)
import { useRef, useState, useTransition } from "react";
import { Button, Input, Label, Select } from "@/components/ui";
import { savePlatformBilling } from "./actions";
import { CheckCircle2 } from "lucide-react";

interface Settings {
  promptpay_id: string | null; account_name: string | null; slip_provider: string | null;
  payment_gateway: string | null; omise_public_key: string | null; company_name: string | null;
  company_address: string | null; tax_id: string | null; tax_branch: string | null;
  vat_registered: boolean | null; email_from: string | null; low_credit_threshold: number | null;
}

export default function BillingSettingsForm({ pf }: { pf: Settings | null }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setResult(null);
    start(async () => {
      const r = await savePlatformBilling(fd);
      setResult(r.ok ? { ok: true, msg: "บันทึกสำเร็จ — ตั้งค่ามีผลทันที" } : { ok: false, msg: r.error });
      if (r.ok) setTimeout(() => setResult(null), 4000);
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input name="omise_public_key" defaultValue={pf?.omise_public_key ?? ""} placeholder="Public key (pkey_...)" />
          <Input name="omise_secret_key" type="password" placeholder="Secret key (skey_... กรอกเมื่อเปลี่ยน)" />
        </div>
        <p className="mt-1 text-[11px] text-neutral-400">Secret key เก็บใน Vault · ตั้ง webhook ใน Omise dashboard ไปที่ <span className="font-mono">/api/billing/omise/webhook</span></p>
      </div>
      <div>
        <Label>ตรวจสลิปเติมเงินอัตโนมัติ (โหมด PromptPay+สลิป)</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select name="slip_provider" defaultValue={pf?.slip_provider ?? "manual"}>
            <option value="manual">ยืนยันเอง (กดปุ่มข้างบน)</option>
            <option value="easyslip">EasySlip — อัตโนมัติ</option>
            <option value="slipok">SlipOK — อัตโนมัติ</option>
          </Select>
          <Input name="slip_api_key" type="password" placeholder="API Key (กรอกเมื่อเปลี่ยน)" />
        </div>
      </div>
      <div className="border-t border-neutral-100 pt-3">
        <Label>อีเมลแจ้งเตือน (Resend) — เครดิตใกล้หมด / บอทหยุดเพราะเครดิตหมด</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input name="resend_api_key" type="password" placeholder="Resend API Key (re_... กรอกเมื่อเปลี่ยน)" />
          <Input name="email_from" defaultValue={pf?.email_from ?? ""} placeholder='ผู้ส่ง เช่น SudoChatBot <no-reply@โดเมนคุณ>' />
          <Input name="low_credit_threshold" type="number" min={0} defaultValue={pf?.low_credit_threshold ?? 50} placeholder="เตือนเมื่อเครดิตต่ำกว่า (บาท)" />
        </div>
        <p className="mt-1 text-[11px] text-neutral-400">ไม่ใส่ key = ไม่ส่งอีเมล (ยังแจ้งใน dashboard เสมอ) · สมัครฟรีที่ resend.com</p>
      </div>
      <div className="border-t border-neutral-100 pt-3">
        <Label>ข้อมูลผู้ขายบนใบกำกับภาษี (VAT 7%)</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึกบัญชีรับเงิน"}</Button>
        {result?.ok && <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> {result.msg}</span>}
      </div>
      {result && !result.ok && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{result.msg}</p>}
    </form>
  );
}
