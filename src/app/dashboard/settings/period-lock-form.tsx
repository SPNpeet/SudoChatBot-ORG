"use client";
import { dateTH } from "@/lib/utils";
// ============================================================
//  ปิดงวดที่ยื่นภาษีไปแล้ว
//
//  ยื่น ภ.พ.30 หรือ ภ.ง.ด. ของเดือนไหนไปแล้ว ตัวเลขเดือนนั้นต้องนิ่งตลอดไป
//  ถ้ายังแก้ย้อนหลังได้ ระบบกับแบบที่ยื่นจะไม่ตรงกัน และตอนสรรพากรตรวจย้อนหลัง
//  จะอธิบายไม่ได้ว่าตัวเลขเปลี่ยนตอนไหนเพราะอะไร
//
//  การบังคับจริงอยู่ที่ trigger ในฐานข้อมูล ปุ่มนี้แค่ตั้งค่า
//  จึงกันได้ทุกทางพร้อมกัน รวมถึงทางที่ผู้ช่วย AI ลงบัญชีให้เอง
// ============================================================
import { useState, useTransition } from "react";
import { Button, Input, Label } from "@/components/ui";
import { setPeriodLock, clearPeriodLock } from "../actions";
import { Lock, LockOpen, TriangleAlert } from "lucide-react";
import DateField from "@/components/date-field";

/** วันสุดท้ายของเดือนก่อนหน้า ตามเวลาไทย — ค่าที่คนเลือกบ่อยที่สุด */
function endOfLastMonth(): string {
  const now = new Date(Date.now() + 7 * 3600_000);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return d.toISOString().slice(0, 10);
}

export default function PeriodLockForm({ shopId, lock, isOwner }: {
  shopId: string;
  lock: { locked_through: string; locked_at: string; note: string | null } | null;
  isOwner: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lockThrough, setLockThrough] = useState(lock?.locked_through ?? endOfLastMonth());

  function submit(fd: FormData) {
    setResult(null);
    start(async () => {
      const r = await setPeriodLock(shopId, fd);
      setResult(r.ok ? { ok: true, msg: "ปิดงวดแล้ว" } : { ok: false, msg: r.error });
      if (r.ok) setTimeout(() => setResult(null), 3000);
    });
  }

  function unlock() {
    setResult(null);
    setConfirmOpen(false);
    start(async () => {
      const r = await clearPeriodLock(shopId);
      setResult(r.ok ? { ok: true, msg: "ปลดล็อกแล้ว — บันทึกไว้ในประวัติการใช้งานเรียบร้อย" } : { ok: false, msg: r.error });
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] leading-relaxed text-neutral-500">
        ยื่นภาษีเดือนไหนไปแล้ว ให้ปิดงวดถึงสิ้นเดือนนั้น จากนั้นเอกสารและรายการบัญชีในงวดที่ปิด
        จะแก้ ลบ หรือย้ายวันที่ไม่ได้ทุกทาง <b className="text-neutral-700">รวมถึงตอนผู้ช่วย AI ลงบัญชีให้เอง</b> —
        ถ้าต้องปรับปรุงตัวเลขย้อนหลัง ให้ออกเอกสารปรับปรุงในงวดปัจจุบันแทน ซึ่งเป็นวิธีที่ถูกต้องตามหลักบัญชีอยู่แล้ว
      </p>

      {lock ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
            <Lock className="h-4 w-4 shrink-0" />
            ปิดงวดถึงวันที่ {lock.locked_through} แล้ว
          </p>
          <p className="mt-1 text-[12px] text-emerald-700">
            ปิดเมื่อ {dateTH(lock.locked_at)}
            {lock.note ? ` · ${lock.note}` : ""}
          </p>
        </div>
      ) : (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-800">
          <TriangleAlert className="mr-1.5 inline h-4 w-4 align-[-3px]" />
          ยังไม่ได้ปิดงวดใด ๆ — ตอนนี้ตัวเลขของเดือนที่ยื่นภาษีไปแล้วยังถูกแก้ย้อนหลังได้
        </p>
      )}

      <form action={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <DateField label="ปิดงวดถึงวันที่" required name="locked_through"
              value={lockThrough} onChange={setLockThrough} hideToday
              hint="ปกติใช้วันสุดท้ายของเดือนที่ยื่นภาษีไปแล้ว" />
          </div>
          <div>
            <Label>บันทึกช่วยจำ (ไม่บังคับ)</Label>
            <Input name="note" defaultValue={lock?.note ?? ""} placeholder="เช่น ยื่น ภ.พ.30 มิ.ย. แล้ว" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>
            <Lock className="h-4 w-4" />{pending ? "กำลังบันทึก…" : lock ? "อัปเดตวันปิดงวด" : "ปิดงวดถึงวันนี้"}
          </Button>

          {lock && isOwner && !confirmOpen && (
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(true)} disabled={pending}>
              <LockOpen className="h-4 w-4" />ปลดล็อกงวด
            </Button>
          )}
        </div>
      </form>

      {/* ปลดล็อกคือการเปิดให้แก้ตัวเลขที่ยื่นไปแล้ว ต้องถามซ้ำเสมอ ไม่ใช่กดทีเดียวจบ */}
      {confirmOpen && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-bold text-red-700">ยืนยันปลดล็อกงวด</p>
          <p className="mt-1 text-[12px] leading-relaxed text-red-600">
            หลังปลดล็อก เอกสารและรายการบัญชีของงวดที่ยื่นภาษีไปแล้วจะถูกแก้ได้อีกครั้ง
            ถ้าแก้แล้วตัวเลขจะไม่ตรงกับแบบที่ยื่นไว้ การปลดล็อกครั้งนี้จะถูกบันทึกในประวัติการใช้งานพร้อมชื่อผู้กด
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button type="button" variant="danger" onClick={unlock} disabled={pending}>
              {pending ? "กำลังปลดล็อก..." : "ยืนยันปลดล็อก"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>ยกเลิก</Button>
          </div>
        </div>
      )}

      {lock && !isOwner && (
        <p className="text-[12px] text-neutral-400">ปลดล็อกงวดได้เฉพาะเจ้าของกิจการ</p>
      )}

      {result && (
        <p className={`text-sm ${result.ok ? "text-emerald-600" : "text-red-600"}`}>{result.msg}</p>
      )}
    </div>
  );
}
