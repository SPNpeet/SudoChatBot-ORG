"use client";
import { useState, useTransition } from "react";
import { Button, Input, Label, Select } from "@/components/ui";
import { savePaymentSettings } from "../actions";
import type { ShopPaymentSettings } from "@/lib/types/db";

export default function PaymentSettingsForm({ shopId, p }: { shopId: string; p: Partial<ShopPaymentSettings> }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const ship = p.shipping_options ?? [];

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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>พร้อมเพย์ (เบอร์/เลขบัตร ปชช.)</Label>
          <Input name="promptpay_id" defaultValue={p.promptpay_id ?? ""} placeholder="0812345678" />
        </div>
        <div><Label>ชื่อบัญชี</Label><Input name="account_name" defaultValue={p.account_name ?? ""} /></div>
        <div><Label>ธนาคาร</Label><Input name="bank_name" defaultValue={p.bank_name ?? ""} /></div>
      </div>

      <div>
        <Label>การตรวจสลิปอัตโนมัติ</Label>
        <div className="grid grid-cols-2 gap-3">
          <Select name="slip_provider" defaultValue={p.slip_provider ?? "manual"}>
            <option value="manual">ตรวจเอง (แอดมินกดยืนยันในหน้าออเดอร์)</option>
            <option value="easyslip">EasySlip — อัตโนมัติ 100%</option>
            <option value="slipok">SlipOK — อัตโนมัติ 100%</option>
          </Select>
          <Input name="slip_api_key" type="password" placeholder="API Key (กรอกเมื่อเปลี่ยน)" />
        </div>
        <p className="mt-1 text-[11px] text-neutral-400">สมัคร EasySlip ที่ easyslip.com (~0.05฿/สลิป) — ระบบกันสลิปปลอม/สลิปซ้ำ/ยอดไม่ตรงให้อัตโนมัติ</p>
      </div>

      <div>
        <Label>ตัวเลือกจัดส่ง (บอทใช้คำนวณยอดรวม)</Label>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <Input name={`ship_name_${i}`} defaultValue={ship[i]?.name ?? (i === 0 ? "ส่งด่วน Kerry/Flash" : "")} placeholder={`ช่องทางที่ ${i + 1}`} />
              <Input name={`ship_fee_${i}`} type="number" min="0" defaultValue={ship[i]?.fee ?? (i === 0 ? 40 : "")} placeholder="ค่าส่ง (บาท)" />
              <Input name={`ship_free_${i}`} type="number" min="0" defaultValue={ship[i]?.free_over ?? ""} placeholder="ฟรีเมื่อครบ (บาท)" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึกการตั้งค่าการเงิน"}</Button>
        {result?.ok && <span className="text-sm text-emerald-600">✓ {result.msg}</span>}
      </div>
      {result && !result.ok && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{result.msg}</p>}
    </form>
  );
}
