"use client";
import { useState, useTransition } from "react";
import { Button, Input, Label, Select } from "@/components/ui";
import { savePaymentSettings } from "../actions";
import type { ShopPaymentSettings } from "@/lib/types/db";
import { CheckCircle2 } from "lucide-react";

// ธนาคารไทยที่คนใช้จริง เรียงตามส่วนแบ่งลูกค้ารายย่อย — ชื่อทางการแบบสั้นที่พิมพ์บนเอกสารได้เลย
const THAI_BANKS = [
  "กสิกรไทย", "ไทยพาณิชย์", "กรุงเทพ", "กรุงไทย", "กรุงศรีอยุธยา",
  "ทีเอ็มบีธนชาต (ttb)", "ออมสิน", "เกียรตินาคินภัทร", "ซีไอเอ็มบี ไทย",
  "ยูโอบี", "แลนด์ แอนด์ เฮ้าส์", "ธ.ก.ส.", "อาคารสงเคราะห์", "อิสลามแห่งประเทศไทย",
];

export default function PaymentSettingsForm({ shopId, p }: { shopId: string; p: Partial<ShopPaymentSettings> }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function submit(fd: FormData) {
    setResult(null);
    start(async () => {
      const r = await savePaymentSettings(shopId, fd);
      setResult(r.ok ? { ok: true, msg: "บันทึกแล้ว" } : { ok: false, msg: r.error });
      if (r.ok) setTimeout(() => setResult(null), 3000);
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="shop_id" value={shopId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>พร้อมเพย์ (เบอร์/เลขบัตร ปชช.)</Label>
          <Input name="promptpay_id" defaultValue={p.promptpay_id ?? ""} placeholder="0812345678" />
        </div>
        <div><Label>ชื่อบัญชี</Label><Input name="account_name" defaultValue={p.account_name ?? ""} /></div>
        <div>
          <Label>ธนาคาร</Label>
          {/* เลือกจากรายการแทนพิมพ์เอง (เจ้าของขอ 4 ส.ค. 2569) — พิมพ์เองสะกดเพี้ยน
              ("กรุงไทย/krungthai/KTB") แล้วไปโชว์บนเอกสารที่ส่งลูกค้า
              ค่าที่เคยพิมพ์ไว้เดิมถ้าไม่อยู่ในรายการ จะถูกเติมเป็นตัวเลือกให้ ไม่หายเงียบ */}
          <Select name="bank_name" defaultValue={p.bank_name ?? ""}>
            <option value="">— เลือกธนาคาร —</option>
            {THAI_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
            {p.bank_name && !THAI_BANKS.includes(p.bank_name) && (
              <option value={p.bank_name}>{p.bank_name}</option>
            )}
          </Select>
        </div>
      </div>
      <p className="text-xs text-neutral-400">QR พร้อมเพย์จะขึ้นบนใบแจ้งหนี้และลิงก์เอกสารที่ส่งให้ลูกค้า — ลูกค้าสแกนจ่ายเข้าบัญชีคุณตรง 100%</p>

      <div>
        <Label>การตรวจสลิปอัตโนมัติ</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select name="slip_provider" defaultValue={p.slip_provider ?? "manual"}>
            <option value="manual">ตรวจเอง (กดยืนยันเองในหน้าเอกสาร)</option>
            <option value="easyslip">EasySlip — อัตโนมัติ 100%</option>
            <option value="slipok">SlipOK — อัตโนมัติ 100%</option>
          </Select>
          <Input name="slip_api_key" type="password" placeholder="รหัสเชื่อมต่อจากผู้ให้บริการ (กรอกเมื่อต้องการเปลี่ยน)" />
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          สมัคร EasySlip ที่ easyslip.com (~0.05฿/สลิป) — ระบบตรวจสลิปจริง กันสลิปซ้ำ จับคู่ใบแจ้งหนี้ และให้ลูกค้าอัปสลิปจ่ายเองจากลิงก์เอกสารได้
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button disabled={pending} className="w-full sm:w-auto">{pending ? "กำลังบันทึก..." : "บันทึกการตั้งค่าการเงิน"}</Button>
        {result?.ok && <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />{result.msg}</span>}
      </div>
      {result && !result.ok && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{result.msg}</p>}
    </form>
  );
}
