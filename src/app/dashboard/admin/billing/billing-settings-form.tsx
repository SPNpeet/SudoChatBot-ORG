"use client";
// ฟอร์มตั้งค่าบัญชีรับเงินแพลตฟอร์ม — ต้องมี feedback ชัดเจนหลังกดบันทึก
// (บั๊กเดิม: กดแล้วเงียบ ผู้ใช้คิดว่ากดไม่ติดทั้งที่บันทึกสำเร็จจริง)
import { useRef, useState, useTransition } from "react";
import { Button, Input, Label, Select } from "@/components/ui";
import { savePlatformBilling } from "./actions";
import { CheckCircle2 } from "lucide-react";

interface Settings {
  account_name: string | null; slip_provider: string | null; company_name: string | null;
  company_address: string | null; tax_id: string | null; tax_branch: string | null;
  vat_registered: boolean | null; email_from: string | null; low_credit_threshold: number | null;
  slip_monthly_cap: number | null;
}

export default function BillingSettingsForm({ pf, slipUsed = 0 }: { pf: Settings | null; slipUsed?: number }) {
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
      <div>
        <Label>ชื่อผู้รับเงิน (ขึ้นบนใบเสร็จค่าแพ็กเกจ)</Label>
        <Input name="account_name" defaultValue={pf?.account_name ?? ""} />
      </div>
      <div>
        <Label>รับเงินค่าแพ็กเกจผ่าน Stripe</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input name="stripe_secret_key" type="password" placeholder="Secret key (sk_live_... กรอกเมื่อเปลี่ยน)" />
          <Input name="stripe_webhook_secret" type="password" placeholder="Webhook signing secret (whsec_... กรอกเมื่อเปลี่ยน)" />
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          ทั้งสองคีย์เก็บใน Vault · ตั้ง webhook ใน Stripe Dashboard ไปที่ <span className="font-mono">/api/billing/stripe/webhook</span>
          {" "}แล้วติ๊ก event: <span className="font-mono">checkout.session.completed</span>, <span className="font-mono">async_payment_succeeded</span>, <span className="font-mono">async_payment_failed</span>, <span className="font-mono">expired</span>
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          ต้องเปิด <span className="font-medium">PromptPay</span> ในหน้า Payment methods ของ Stripe ก่อน ไม่งั้นลูกค้าจะเห็นเฉพาะบัตร ·
          บัญชี Stripe ต้องจดทะเบียนในไทยและรับเงินสกุล THB · ไม่มี webhook secret = ระบบไม่รับ event ใด ๆ (กันคนปลอมยิงเข้ามาเครดิตเงินให้ตัวเอง)
        </p>
      </div>
      <div>
        <Label>ตรวจสลิปอัตโนมัติ — สำหรับลูกค้าของร้านที่จ่ายบิลให้ร้าน (ไม่เกี่ยวกับค่าแพ็กเกจ)</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select name="slip_provider" defaultValue={pf?.slip_provider ?? "manual"}>
            <option value="manual">ยืนยันเอง (ร้านกดจับคู่สลิปเอง)</option>
            <option value="easyslip">EasySlip — อัตโนมัติ</option>
            <option value="slipok">SlipOK — อัตโนมัติ</option>
          </Select>
          <Input name="slip_api_key" type="password" placeholder="API Key (กรอกเมื่อเปลี่ยน)" />
          {/* เพดานกลาง: คีย์ใบเดียวใช้ร่วมกันทุกร้าน ถ้าไม่คุมตรงนี้ ร้านฟรีกินโควตาร้านที่จ่ายเงินได้
              ค่าเริ่มต้น 100 = แพ็กฟรีของ SlipOK · อัปแพ็กเมื่อไหร่ให้แก้เลขนี้ตาม */}
          <Input name="slip_monthly_cap" type="number" min={0} defaultValue={pf?.slip_monthly_cap ?? 100}
            placeholder="เพดานตรวจสลิป/เดือน ทั้งแพลตฟอร์ม" />
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          เพดานคือจำนวนครั้งที่ยิง API ต่อเดือนของทั้งระบบ (เดือนนี้ใช้ไป {slipUsed}/{pf?.slip_monthly_cap ?? 100} ครั้ง) ·
          เต็มแล้วระบบสลับเป็นยืนยันเองอัตโนมัติ ไม่มีใครจ่ายไม่ได้ · ใส่ 0 = ปิดตรวจอัตโนมัติทั้งระบบ
        </p>
      </div>
      <div className="border-t border-neutral-100 pt-3">
        <Label>อีเมลแจ้งเตือน (Resend) — เครดิตใกล้หมด / บอทหยุดเพราะเครดิตหมด</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input name="resend_api_key" type="password" placeholder="Resend API Key (re_... กรอกเมื่อเปลี่ยน)" />
          <Input name="email_from" defaultValue={pf?.email_from ?? ""} placeholder='ผู้ส่ง เช่น SudoChatBot <no-reply@โดเมนคุณ>' />
          <Input name="low_credit_threshold" type="number" min={0} defaultValue={pf?.low_credit_threshold ?? 50} placeholder="เตือนเมื่อเครดิตต่ำกว่า (บาท)" />
        </div>
        <p className="mt-1 text-xs text-neutral-400">ไม่ใส่ key = ไม่ส่งอีเมล (ยังแจ้งใน dashboard เสมอ) · สมัครฟรีที่ resend.com</p>
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
