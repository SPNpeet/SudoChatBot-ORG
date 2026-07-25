"use client";
import { useState, useTransition } from "react";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { saveTaxInfo } from "../actions";
import { CheckCircle2 } from "lucide-react";

export default function TaxInfoForm({ shopId, taxInfo }: {
  shopId: string;
  taxInfo: { billing_name?: string | null; billing_address?: string | null; tax_id?: string | null; branch?: string | null } | null;
}) {
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
        <div><Label>ชื่อกิจการของคุณ (ตามที่จดทะเบียน)</Label><Input name="billing_name" defaultValue={taxInfo?.billing_name ?? ""} placeholder="บริษัท ตัวอย่าง จำกัด" /></div>
        <div><Label>เลขประจำตัวผู้เสียภาษี 13 หลัก</Label><Input name="tax_id" defaultValue={taxInfo?.tax_id ?? ""} placeholder="0105561000000" maxLength={13} /></div>
      </div>
      <div><Label>ที่อยู่สำหรับออกใบกำกับภาษี</Label><Textarea name="billing_address" defaultValue={taxInfo?.billing_address ?? ""} placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" /></div>

      {/* กฎหมายบังคับ (ประกาศอธิบดีฯ ฉบับที่ 199) ให้ใบกำกับภาษีเต็มรูประบุสำนักงานใหญ่/สาขา
          ถ้าไม่มี ลูกค้าเอาใบไปขอคืนภาษีซื้อไม่ได้ */}
      <div className="sm:max-w-xs">
        <Label>สำนักงานใหญ่หรือสาขา</Label>
        <Input name="branch" defaultValue={taxInfo?.branch ?? "สำนักงานใหญ่"} placeholder="สำนักงานใหญ่" maxLength={40} />
        <p className="mt-1 text-[11px] text-neutral-400">
          ถ้าเป็นสาขา พิมพ์เลขสาขาได้เลย เช่น <b>1</b> ระบบจะแปลงเป็น &ldquo;สาขาที่ 00001&rdquo; ให้เอง
        </p>
      </div>

      <p className="rounded-xl bg-neutral-50 px-3 py-2 text-[11px] leading-relaxed text-neutral-500">
        3 อย่างนี้ (ชื่อจดทะเบียน · เลขผู้เสียภาษี 13 หลัก · ที่อยู่) กฎหมายบังคับว่าต้องมีบนใบกำกับภาษีเต็มรูป
        ตามมาตรา 86/4 ประมวลรัษฎากร — ขาดข้อใดข้อหนึ่ง ลูกค้าเอาใบไปขอคืนภาษีซื้อไม่ได้
      </p>
      <div className="flex items-center gap-3">
        <Button disabled={pending} className="w-full sm:w-auto">{pending ? "กำลังบันทึก..." : "บันทึกข้อมูลใบกำกับภาษี"}</Button>
        {result?.ok && <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />{result.msg}</span>}
      </div>
      {result && !result.ok && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{result.msg}</p>}
    </form>
  );
}
