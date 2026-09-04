"use client";
// เลือกงวดรายงาน: เดือน / ไตรมาส / ปี — ส่งค่าเป็น ?period=2026-07 | 2026-Q3 | 2026
//
// ⚠️ ห้ามใช้ input[type="month"] ที่นี่ (แก้ 5 ก.ย. 2569)
// วัดจริงบน production: มันแสดง "September 2026" — อังกฤษ + ค.ศ. ทั้งที่ทั้งระบบพูดไทย + พ.ศ.
// และเปลี่ยนภาษาตามเบราว์เซอร์ไม่ได้ (ตั้ง locale th-TH แล้วก็ยังเป็นอังกฤษ)
// ใช้ select เดือน/ปีแทน = คุมข้อความได้ 100% และเลือกด้วยนิ้วบนมือถือง่ายกว่าปฏิทิน
//
// ⚠️ เลือกแล้วไปเลย ไม่มีปุ่ม "ดูงวดนี้" อีก — เดิมเลือกเดือนแล้วหน้าไม่เปลี่ยน
// ต้องกดปุ่มที่สองซึ่งอยู่คนละบรรทัดบนมือถือ คนเลือกแล้วรอเฉย ๆ เพราะไม่รู้ว่ายังไม่จบ
import { useState } from "react";
import { useRouter } from "next/navigation";

const nowBkk = () => new Date(Date.now() + 7 * 3600_000);
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
// ⚠️ ตัวย่อต้องมาจากตารางนี้ ห้ามตัดจากชื่อเต็ม ("กันยายน".slice(0,3) = "กัน" ไม่ใช่คำย่อ)
const TH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const FIELD = "h-10 rounded-xl border border-neutral-300 bg-white px-2.5 text-sm outline-none focus:border-emerald-500";

export default function PeriodPicker({ tab, period }: { tab: string; period: string }) {
  const router = useRouter();
  const initialType = /^\d{4}$/.test(period) ? "year" : /Q/.test(period) ? "quarter" : "month";
  const [type, setType] = useState<"month" | "quarter" | "year">(initialType as "month" | "quarter" | "year");
  const [month, setMonth] = useState(/^\d{4}-\d{2}$/.test(period) ? period : nowBkk().toISOString().slice(0, 7));
  const [quarter, setQuarter] = useState(/Q/.test(period) ? period.split("-Q")[1] : String(Math.floor(nowBkk().getUTCMonth() / 3) + 1));
  const [year, setYear] = useState(period.slice(0, 4) || String(nowBkk().getUTCFullYear()));

  /** ไปงวดที่เลือกทันที — ค่าใน URL ยังเป็น ค.ศ. เหมือนเดิม (พ.ศ. ใช้แค่ตอนแสดง) */
  function go(next: { type?: typeof type; month?: string; quarter?: string; year?: string }) {
    const t = next.type ?? type;
    const m = next.month ?? month, q = next.quarter ?? quarter, y = next.year ?? year;
    const p = t === "month" ? m : t === "quarter" ? `${y}-Q${q}` : y;
    router.push(`/dashboard/reports?t=${tab}&period=${p}`);
  }

  const yearOpts = Array.from({ length: 6 }, (_, i) => nowBkk().getUTCFullYear() - i);
  const [mY, mM] = month.split("-");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={type} aria-label="ช่วงเวลา"
        onChange={(e) => { const v = e.target.value as typeof type; setType(v); go({ type: v }); }}
        className={FIELD}>
        <option value="month">รายเดือน</option>
        <option value="quarter">รายไตรมาส</option>
        <option value="year">รายปี</option>
      </select>

      {type === "month" && (
        <>
          <select value={mM} aria-label="เดือน"
            onChange={(e) => { const v = `${mY}-${e.target.value}`; setMonth(v); go({ month: v }); }}
            className={FIELD}>
            {TH_MONTHS.map((name, i) => {
              const v = String(i + 1).padStart(2, "0");
              return <option key={v} value={v}>{name}</option>;
            })}
          </select>
          <select value={mY} aria-label="ปี"
            onChange={(e) => { const v = `${e.target.value}-${mM}`; setMonth(v); go({ month: v }); }}
            className={FIELD}>
            {yearOpts.map((y) => <option key={y} value={y}>{y + 543}</option>)}
          </select>
        </>
      )}

      {type === "quarter" && (
        <>
          <select value={quarter} aria-label="ไตรมาส"
            onChange={(e) => { setQuarter(e.target.value); go({ quarter: e.target.value }); }} className={FIELD}>
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>ไตรมาส {q} ({TH_SHORT[(q - 1) * 3]}-{TH_SHORT[q * 3 - 1]})</option>)}
          </select>
          <select value={year} aria-label="ปี"
            onChange={(e) => { setYear(e.target.value); go({ year: e.target.value }); }} className={FIELD}>
            {yearOpts.map((y) => <option key={y} value={y}>{y + 543}</option>)}
          </select>
        </>
      )}

      {type === "year" && (
        <select value={year} aria-label="ปี"
          onChange={(e) => { setYear(e.target.value); go({ year: e.target.value }); }} className={FIELD}>
          {yearOpts.map((y) => <option key={y} value={y}>{y + 543}</option>)}
        </select>
      )}
    </div>
  );
}
