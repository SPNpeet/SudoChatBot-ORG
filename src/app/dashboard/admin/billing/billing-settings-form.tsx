"use client";
// ฟอร์มตั้งค่าบัญชีรับเงินแพลตฟอร์ม — ต้องมี feedback ชัดเจนหลังกดบันทึก
// (บั๊กเดิม: กดแล้วเงียบ ผู้ใช้คิดว่ากดไม่ติดทั้งที่บันทึกสำเร็จจริง)
import { useRef, useState, useTransition } from "react";
import { Button, Input, InfoHint, Label, Select } from "@/components/ui";
import { savePlatformBilling } from "./actions";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, CircleDashed } from "lucide-react";

interface Settings {
  account_name: string | null; slip_provider: string | null; company_name: string | null;
  company_address: string | null; tax_id: string | null; tax_branch: string | null;
  vat_registered: boolean | null; email_from: string | null; low_credit_threshold: number | null;
  slip_monthly_cap: number | null;
}

/**
 * คีย์ที่เก็บไว้ในรูปย่อ เช่น "sk_test_••••mocb" — null = ยังไม่ได้ตั้ง
 * ⚠️ ห้ามส่งค่าคีย์เต็มลง client เด็ดขาด (ดู maskKey ใน page.tsx)
 */
export interface StoredKeys { stripeKey: string | null; stripeWebhook: string | null; slipKey: string | null }

/**
 * ป้ายสถานะข้างช่องคีย์
 *
 * ⚠️ ทำไมต้องมี (8 ส.ค. 2569): ช่องคีย์เป็น type=password และไม่แสดงค่าที่เก็บไว้
 * (ถูกต้องแล้ว ห้ามส่งคีย์กลับมา) แต่ผลคือเปิดหน้ามาเห็น "ช่องว่าง" เหมือนไม่เคยตั้งค่า
 * เจ้าของกรอก secret key ครั้งแรกแล้วโหลดหน้าใหม่ เห็นว่าว่าง เข้าใจว่าไม่ได้บันทึก
 * รอบต่อมากรอกแต่ webhook secret แล้วกดบันทึก → ระบบเก็บ webhook ไว้แต่ secret key ยังว่าง
 * = ยังรับเงินไม่ได้ โดยไม่มีอะไรบอกเลย ต้องมาเปิดฐานข้อมูลดูถึงจะรู้
 */
function KeyStatus({ masked }: { masked: string | null }) {
  return masked ? (
    <span className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      <code className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono tracking-tight">{masked}</code>
      <span className="text-neutral-400">เว้นว่างไว้ถ้าไม่เปลี่ยน</span>
    </span>
  ) : (
    <span className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-400">
      <CircleDashed className="h-3.5 w-3.5 shrink-0" /> ยังไม่ได้ตั้ง
    </span>
  );
}

export default function BillingSettingsForm({ pf, slipUsed = 0, stored }: { pf: Settings | null; slipUsed?: number; stored: StoredKeys }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // ⚠️ ต้อง !! ก่อนเทียบ — ตอนนี้ค่าที่ส่งมาเป็นสตริงคีย์ย่อ ไม่ใช่ boolean แล้ว
  // เทียบสตริงกันตรง ๆ จะได้ "ไม่เท่ากัน" เสมอแม้ตั้งครบทั้งคู่ = ขึ้นเตือนแดงผิด ๆ
  const stripeReady = !!stored.stripeKey && !!stored.stripeWebhook;
  const stripeHalf = !!stored.stripeKey !== !!stored.stripeWebhook;
  // ⚠️ คีย์ทดสอบ = ไม่มีเงินจริงเข้าสักบาท (พบ 8 ส.ค. 2569)
  // เดิมมีคีย์ครบสองตัวก็ขึ้นเขียวว่า "พร้อมรับเงินค่าแพ็กเกจแล้ว" ทันที
  // ทั้งที่เป็น sk_test_ ซึ่งรับได้แค่บัตรทดสอบ — ลูกค้าจริงจ่ายไม่ผ่าน
  // และเจ้าของจะเข้าใจว่าเปิดขายได้แล้ว นี่คือคำโกหกที่แพงที่สุดในหน้านี้
  const isTestKey = !!stored.stripeKey?.startsWith("sk_test");

  function submit(fd: FormData) {
    setResult(null);
    start(async () => {
      const r = await savePlatformBilling(fd);
      if (!r.ok) { setResult({ ok: false, msg: r.error }); return; }
      // ยืนยันให้ตรงกับสิ่งที่เกิดขึ้นจริง — ไม่ใช่ "บันทึกสำเร็จ" ลอย ๆ ที่ขึ้นเหมือนกันทุกครั้ง
      // ต้องบอกว่าเก็บคีย์ตัวไหนไปบ้าง (ช่องคีย์เป็น password จึงตรวจด้วยตาเองไม่ได้)
      // และบอกผลรวมว่าตอนนี้รับเงินได้หรือยัง ซึ่งเป็นคำถามเดียวที่เจ้าของอยากได้คำตอบ
      const what = r.savedKeys.length ? `เก็บ ${r.savedKeys.join(" · ")} แล้ว` : "อัปเดตข้อมูลบัญชีรับเงินแล้ว (ไม่ได้เปลี่ยนคีย์)";
      const state = r.stripeReady ? "พร้อมรับเงินค่าแพ็กเกจ" : "ยังรับเงินไม่ได้ — ดูสถานะใต้ช่องคีย์";
      setResult({ ok: true, msg: `${what} · ${state}` });
      // ไม่ซ่อนข้อความเองเมื่อยังไม่พร้อมรับเงิน — ของที่ต้องทำต่อห้ามหายไปเอง
      if (r.stripeReady) setTimeout(() => setResult(null), 6000);
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-3">
      <div>
        <Label>ชื่อผู้รับเงิน (ขึ้นบนใบเสร็จค่าแพ็กเกจ)</Label>
        <Input name="account_name" defaultValue={pf?.account_name ?? ""} />
      </div>
      <div>
        <Label className="flex items-center gap-1.5">
          รับเงินค่าแพ็กเกจผ่าน Stripe
          <InfoHint>
            ทั้งสองคีย์เก็บใน Vault · ตั้ง webhook ใน Stripe Dashboard ไปที่ /api/billing/stripe/webhook
            แล้วติ๊ก event: checkout.session.completed, async_payment_succeeded, async_payment_failed, expired ·
            ต้องเปิด PromptPay ในหน้า Payment methods ของ Stripe ก่อน ไม่งั้นลูกค้าจะเห็นเฉพาะบัตร ·
            บัญชี Stripe ต้องจดทะเบียนในไทยและรับเงินสกุล THB
          </InfoHint>
        </Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Input name="stripe_secret_key" type="password" autoComplete="off"
              placeholder={stored.stripeKey ? "Secret key — กรอกเมื่อต้องการเปลี่ยน" : "Secret key (sk_live_... / sk_test_...)"} />
            <KeyStatus masked={stored.stripeKey} />
          </div>
          <div>
            <Input name="stripe_webhook_secret" type="password" autoComplete="off"
              placeholder={stored.stripeWebhook ? "Webhook secret — กรอกเมื่อต้องการเปลี่ยน" : "Webhook signing secret (whsec_...)"} />
            <KeyStatus masked={stored.stripeWebhook} />
          </div>
        </div>
        {/* สรุปสถานะรับเงินเป็นประโยคเดียว — สิ่งที่เจ้าของอยากรู้จริง ๆ คือ "ตอนนี้ลูกค้าจ่ายเงินได้ไหม"
            ไม่ใช่ "คีย์ไหนมีบ้าง" · ครึ่ง ๆ กลาง ๆ อันตรายกว่าไม่ตั้งเลย จึงต้องเป็นสีแดง */}
        <div className={cn(
          "mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
          stripeReady && isTestKey ? "bg-amber-50 text-amber-800"
            : stripeReady ? "bg-emerald-50 text-emerald-700"
            : stripeHalf ? "bg-red-50 text-red-600"
              : "bg-neutral-50 text-neutral-500",
        )}>
          {stripeReady && !isTestKey ? <CheckCircle2 className="mt-px h-4 w-4 shrink-0" />
            : stripeReady || stripeHalf ? <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
              : <CircleDashed className="mt-px h-4 w-4 shrink-0" />}
          <span>
            {stripeReady && isTestKey
              ? "ยังรับเงินจริงไม่ได้ — คีย์ที่ใส่เป็นคีย์ทดสอบ (sk_test) รับได้เฉพาะบัตรทดสอบเท่านั้น ลูกค้าจริงจ่ายไม่ผ่าน · ต้องเปิดใช้บัญชี Stripe จริงแล้วเปลี่ยนเป็นคีย์ sk_live พร้อม webhook ของโหมด live"
              : stripeReady ? "พร้อมรับเงินค่าแพ็กเกจแล้ว — ครบทั้ง secret key และ webhook secret"
              : stripeHalf && !stored.stripeKey ? "ยังรับเงินไม่ได้ — มี webhook secret แล้วแต่ยังไม่มี secret key จึงสร้างหน้าจ่ายเงินไม่ได้เลย"
                : stripeHalf ? "ยังรับเงินไม่ได้ — มี secret key แล้วแต่ยังไม่มี webhook secret ลูกค้าจ่ายเงินได้แต่เครดิตจะไม่เข้า (ระบบปฏิเสธ event ทุกตัวเพื่อกันคนปลอมยิงเข้ามาเครดิตให้ตัวเอง)"
                  : "ยังไม่ได้ตั้งค่า Stripe — หน้าแพ็กเกจซ่อนปุ่มสมัคร ไม่มีใครสมัครแพ็กเสียเงินได้"}
          </span>
        </div>
      </div>
      <div>
        <Label className="flex items-center gap-1.5">
          ตรวจสลิปอัตโนมัติ — ของลูกค้าร้าน (ไม่เกี่ยวกับค่าแพ็กเกจ)
          <InfoHint>
            เพดานคือจำนวนครั้งที่ยิง API ต่อเดือนของทั้งระบบ · คีย์ใบเดียวใช้ร่วมกันทุกร้าน
            ถ้าไม่คุมเพดาน ร้านฟรีจะกินโควตาของร้านที่จ่ายเงิน ·
            เต็มแล้วระบบสลับเป็นยืนยันเองอัตโนมัติ ไม่มีใครจ่ายไม่ได้ · ใส่ 0 = ปิดตรวจอัตโนมัติทั้งระบบ
          </InfoHint>
        </Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select name="slip_provider" defaultValue={pf?.slip_provider ?? "manual"}>
            <option value="manual">ยืนยันเอง (ร้านกดจับคู่สลิปเอง)</option>
            <option value="easyslip">EasySlip — อัตโนมัติ</option>
            <option value="slipok">SlipOK — อัตโนมัติ</option>
          </Select>
          <div>
            <Input name="slip_api_key" type="password" autoComplete="off"
              placeholder={stored.slipKey ? "API Key — กรอกเมื่อต้องการเปลี่ยน" : "API Key"} />
            <KeyStatus masked={stored.slipKey} />
          </div>
          {/* เพดานกลาง: คีย์ใบเดียวใช้ร่วมกันทุกร้าน ถ้าไม่คุมตรงนี้ ร้านฟรีกินโควตาร้านที่จ่ายเงินได้
              ค่าเริ่มต้น 100 = แพ็กฟรีของ SlipOK · อัปแพ็กเมื่อไหร่ให้แก้เลขนี้ตาม */}
          <Input name="slip_monthly_cap" type="number" min={0} defaultValue={pf?.slip_monthly_cap ?? 100}
            placeholder="เพดานตรวจสลิป/เดือน ทั้งแพลตฟอร์ม" />
        </div>
        <p className="mt-1.5 text-xs text-neutral-500">เดือนนี้ใช้ไป {slipUsed}/{pf?.slip_monthly_cap ?? 100} ครั้ง</p>
      </div>
      <div className="border-t border-neutral-100 pt-3">
        <Label className="flex items-center gap-1.5">
          อีเมลแจ้งเตือน (Resend)
          <InfoHint>
            ใช้เตือนเรื่องเครดิตใกล้หมด และบอทหยุดเพราะเครดิตหมด ·
            ไม่ใส่ key = ไม่ส่งอีเมล (ยังแจ้งใน dashboard เสมอ) · สมัครฟรีที่ resend.com
          </InfoHint>
        </Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input name="resend_api_key" type="password" placeholder="Resend API Key (re_... กรอกเมื่อเปลี่ยน)" />
          <Input name="email_from" defaultValue={pf?.email_from ?? ""} placeholder='ผู้ส่ง เช่น SudoChatBot <no-reply@โดเมนคุณ>' />
          <Input name="low_credit_threshold" type="number" min={0} defaultValue={pf?.low_credit_threshold ?? 50} placeholder="เตือนเมื่อเครดิตต่ำกว่า (บาท)" />
        </div>
      </div>
      <div className="border-t border-neutral-100 pt-3">
        {/* ⚠️ พยานว่า "การ์ดภาษีถูกส่งมาด้วย" (9 ส.ค. 2569)
            checkbox ที่ไม่ได้ติ๊กจะหายไปจาก FormData เฉย ๆ — ฝั่ง action จึงแยกไม่ออกระหว่าง
            "ไม่ได้ติ๊ก" กับ "ฟอร์มนี้ไม่มีช่องนี้เลย" ถ้าไม่มีช่องซ่อนนี้ ค่า จด VAT
            จะไม่ถูกบันทึกอีกเลย (ทั้งติ๊กและเอาติ๊กออก) โดยหน้าจอยังขึ้นว่าบันทึกสำเร็จ
            ห้ามลบ แม้จะดูเหมือน input ที่ไม่มีประโยชน์ */}
        <input type="hidden" name="vat_form" value="1" />
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
