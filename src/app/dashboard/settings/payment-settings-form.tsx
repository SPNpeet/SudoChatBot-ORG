"use client";
import { useState, useTransition } from "react";
import { Button, Input, Label, Select } from "@/components/ui";
import { savePaymentSettings } from "../actions";
import type { ShopPaymentSettings } from "@/lib/types/db";

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
        <div><Label>ธนาคาร</Label><Input name="bank_name" defaultValue={p.bank_name ?? ""} /></div>
      </div>
      <p className="text-[11px] text-neutral-400">QR พร้อมเพย์จะขึ้นบนใบแจ้งหนี้และลิงก์เอกสารที่ส่งให้ลูกค้า — ลูกค้าสแกนจ่ายเข้าบัญชีคุณตรง 100%</p>

      <div>
        <Label>การตรวจสลิปอัตโนมัติ</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select name="slip_provider" defaultValue={p.slip_provider ?? "manual"}>
            <option value="manual">ตรวจเอง (กดยืนยันเองในหน้าเอกสาร)</option>
            <option value="easyslip">EasySlip — อัตโนมัติ 100%</option>
            <option value="slipok">SlipOK — อัตโนมัติ 100%</option>
          </Select>
          <Input name="slip_api_key" type="password" placeholder="API Key (กรอกเมื่อเปลี่ยน)" />
        </div>
        <p className="mt-1 text-[11px] text-neutral-400">
          สมัคร EasySlip ที่ easyslip.com (~0.05฿/สลิป) — ระบบตรวจสลิปจริง กันสลิปซ้ำ จับคู่ใบแจ้งหนี้ และให้ลูกค้าอัปสลิปจ่ายเองจากลิงก์เอกสารได้
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button disabled={pending} className="w-full sm:w-auto">{pending ? "กำลังบันทึก..." : "บันทึกการตั้งค่าการเงิน"}</Button>
        {result?.ok && <span className="text-sm text-emerald-600">✓ {result.msg}</span>}
      </div>
      {result && !result.ok && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{result.msg}</p>}
    </form>
  );
}
