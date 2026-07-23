"use client";
// เลือกงวดรายงาน: เดือน / ไตรมาส / ปี — ส่งค่าเป็น ?period=2026-07 | 2026-Q3 | 2026
import { useState } from "react";
import { useRouter } from "next/navigation";

const nowBkk = () => new Date(Date.now() + 7 * 3600_000);

export default function PeriodPicker({ tab, period }: { tab: string; period: string }) {
  const router = useRouter();
  const initialType = /^\d{4}$/.test(period) ? "year" : /Q/.test(period) ? "quarter" : "month";
  const [type, setType] = useState<"month" | "quarter" | "year">(initialType as "month" | "quarter" | "year");
  const [month, setMonth] = useState(/^\d{4}-\d{2}$/.test(period) ? period : nowBkk().toISOString().slice(0, 7));
  const [quarter, setQuarter] = useState(/Q/.test(period) ? period.split("-Q")[1] : String(Math.floor(nowBkk().getUTCMonth() / 3) + 1));
  const [year, setYear] = useState(period.slice(0, 4) || String(nowBkk().getUTCFullYear()));

  function go() {
    const p = type === "month" ? month : type === "quarter" ? `${year}-Q${quarter}` : year;
    router.push(`/dashboard/reports?t=${tab}&period=${p}`);
  }

  const yearOpts = Array.from({ length: 6 }, (_, i) => nowBkk().getUTCFullYear() - i);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={type} onChange={(e) => setType(e.target.value as typeof type)}
        className="h-9 rounded-xl border border-neutral-300 bg-white px-2.5 text-sm outline-none focus:border-emerald-500">
        <option value="month">รายเดือน</option>
        <option value="quarter">รายไตรมาส</option>
        <option value="year">รายปี</option>
      </select>
      {type === "month" && (
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="h-9 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-emerald-500" />
      )}
      {type === "quarter" && (
        <>
          <select value={quarter} onChange={(e) => setQuarter(e.target.value)}
            className="h-9 rounded-xl border border-neutral-300 bg-white px-2.5 text-sm outline-none focus:border-emerald-500">
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>ไตรมาส {q} (ม.{(q - 1) * 3 + 1}-{q * 3})</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(e.target.value)}
            className="h-9 rounded-xl border border-neutral-300 bg-white px-2.5 text-sm outline-none focus:border-emerald-500">
            {yearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </>
      )}
      {type === "year" && (
        <select value={year} onChange={(e) => setYear(e.target.value)}
          className="h-9 rounded-xl border border-neutral-300 bg-white px-2.5 text-sm outline-none focus:border-emerald-500">
          {yearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      )}
      <button onClick={go} className="h-9 rounded-xl bg-neutral-900 px-3.5 text-sm text-white hover:bg-neutral-700">ดูงวดนี้</button>
    </div>
  );
}
