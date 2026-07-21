"use client";
import { useState, useTransition } from "react";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { saveTaxInfo } from "../actions";

export default function TaxInfoForm({ shopId, taxInfo }: { shopId: string; taxInfo: { billing_name?: string | null; billing_address?: string | null; tax_id?: string | null } | null }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function submit(fd: FormData) {
    setResult(null);
    start(async () => {
      const r = await saveTaxInfo(shopId, fd);
      setResult(r.ok ? { ok: true, msg: "บันทึกแล้ว" } : { ok: false, msg: r.error });
      if (r.ok) setTimeout(() => setResult(null), 3000);
    });
  }

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="shop_id" value={shopId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><Label>ชื่อผู้ซื้อ (บุคคล/นิติบุคคล)</Label><Input name="billing_name" defaultValue={taxInfo?.billing_name ?? ""} placeholder="บริษัท ตัวอย่าง จำกัด" /></div>
        <div><Label>เลขประจำตัวผู้เสียภาษี 13 หลัก</Label><Input name="tax_id" defaultValue={taxInfo?.tax_id ?? ""} placeholder="0105561000000" maxLength={13} /></div>
      </div>
      <div><Label>ที่อยู่สำหรับออกใบกำกับภาษี</Label><Textarea name="billing_address" defaultValue={taxInfo?.billing_address ?? ""} placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" /></div>
      <p className="text-[11px] text-neutral-400">ข้อมูลนี้จะแสดงบนใบเสร็จ/ใบกำกับภาษีของการเติมเงินทุกครั้ง</p>
      <div className="flex items-center gap-3">
        <Button disabled={pending} className="w-full sm:w-auto">{pending ? "กำลังบันทึก..." : "บันทึกข้อมูลใบกำกับภาษี"}</Button>
        {result?.ok && <span className="text-sm text-emerald-600">✓ {result.msg}</span>}
      </div>
      {result && !result.ok && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{result.msg}</p>}
    </form>
  );
}
