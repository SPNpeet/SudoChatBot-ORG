"use client";
// ============================================================
//  ช่องกรอกวันที่สำหรับคนไทย
//
//  ปัญหาของ <input type="date"> เปล่า ๆ ที่เจอจากผู้ใช้จริง
//   1. เบราว์เซอร์แสดงรูปแบบตาม locale ของเครื่อง คนไทยส่วนใหญ่ได้ mm/dd/yyyy
//      ซึ่งสลับวัน-เดือนกับที่คนไทยใช้ อ่านผิดทันทีโดยไม่รู้ตัว
//   2. กดที่ตัวช่องไม่เปิดปฏิทิน ต้องเล็งกดไอคอนเล็ก ๆ ด้านขวาเท่านั้น
//   3. ช่องปีรับ ค.ศ. แต่คนไทยคิดเป็น พ.ศ. — พิมพ์ 2569 ลงไปตรง ๆ ได้เลย
//      เจอของจริงแล้ว: เอกสาร 63,750 บาท ลงวันที่ปี 2069 (พิมพ์ 2569 พลาดเป็น 2069)
//      ระบบรับไว้เงียบ ๆ เอกสารหายจากรายงานทุกงวดไปเลย
//
//  วิธีแก้ที่เลือก: ยังใช้ input type="date" ของเบราว์เซอร์เป็นตัวเก็บค่า
//  (ปฏิทินเนทีฟ · คีย์บอร์ดวันที่บนมือถือ · ไม่ต้องเขียน parser เองซึ่งพังง่ายกว่า)
//  แล้วเสริมสิ่งที่ขาด
//   · กดตรงไหนของช่องก็เปิดปฏิทิน (showPicker)
//   · อ่านวันที่เป็นภาษาไทยพร้อม พ.ศ. ใต้ช่อง คนเห็นทันทีว่าตรงกับที่ตั้งใจไหม
//   · ปุ่มลัด "วันนี้" เพราะเป็นค่าที่เลือกบ่อยที่สุด
//   · เตือนทันทีถ้าวันที่ไกลเกินจนน่าจะพิมพ์ผิด (เซิร์ฟเวอร์บล็อกซ้ำอีกชั้น)
// ============================================================
import { useId, useRef } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { docDateTooFarFuture, docDateVeryOld } from "@/lib/tax-th";

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** "2026-06-19" -> "19 มิถุนายน 2569" — พ.ศ. เพราะเป็นสิ่งที่คนไทยใช้ตรวจ */
export function readThaiDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (m < 1 || m > 12) return "";
  return `${d} ${TH_MONTHS[m - 1]} ${y + 543}`;
}

/** วันนี้ตามเวลาไทย (เซิร์ฟเวอร์อยู่ UTC ถ้าใช้ตรง ๆ จะเพี้ยนช่วงหลังเที่ยงคืน) */
export function bkkTodayISO(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  required?: boolean;
  min?: string;
  max?: string;
  hint?: string;
  className?: string;
  name?: string;
  /** ปิดปุ่มลัด "วันนี้" สำหรับช่องที่ค่าวันนี้ไม่สมเหตุผล เช่น วันครบกำหนดชำระ */
  hideToday?: boolean;
}

export default function DateField({
  value, onChange, label, required, min, max, hint, className, name, hideToday,
}: Props) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const today = bkkTodayISO();

  const reading = readThaiDate(value);
  const farFuture = value ? docDateTooFarFuture(value, today) : false;
  const veryOld = value ? docDateVeryOld(value, today) : false;

  // กดตรงไหนก็ได้ในช่องให้เปิดปฏิทิน — เดิมต้องเล็งไอคอนเล็ก ๆ ด้านขวาเท่านั้น
  // showPicker ยังไม่มีในเบราว์เซอร์เก่า จึงต้องเช็คก่อนเรียกและกลืน error
  function openPicker() {
    try { ref.current?.showPicker?.(); } catch { /* เบราว์เซอร์ไม่รองรับ ใช้ไอคอนเนทีฟแทนได้ */ }
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-neutral-500">
          {label}{required && " *"}
        </label>
      )}

      <div className="relative">
        <input
          ref={ref} id={id} name={name} type="date" required={required}
          value={value} min={min} max={max}
          onChange={(e) => onChange(e.target.value)}
          onClick={openPicker}
          className={cn(
            "h-11 w-full min-w-0 max-w-full rounded-xl border bg-white px-3.5 pr-11 text-base outline-none transition-colors sm:text-sm",
            // ⚠️ appearance-none จำเป็นบน iOS — Safari ให้ input[type=date] มีความกว้าง
            // ตามเนื้อหาของตัวเอง ไม่ยอมหดตาม w-full ช่องเลยล้นออกนอกการ์ด
            // (เจ้าของแคปมาจริงจาก iPhone 2 ส.ค. 2569: ไอคอนปฏิทินโผล่นอกขอบขาว)
            "appearance-none [&::-webkit-date-and-time-value]:text-left",
            "[&::-webkit-calendar-picker-indicator]:opacity-0",
            farFuture ? "border-red-400 focus:border-red-500"
              : "border-neutral-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15",
          )}
        />
        {/* ไอคอนของเราเอง วางทับตัวเนทีฟที่ซ่อนไว้ ให้พื้นที่กดใหญ่ขึ้น */}
        <button type="button" aria-label="เปิดปฏิทิน" onClick={openPicker} tabIndex={-1}
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600">
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>

      {/* อ่านเป็นภาษาไทย + พ.ศ. — จุดที่ทำให้คนจับได้เองว่าพิมพ์ปีผิด */}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        {reading && (
          <span className={cn("text-[12px] font-medium", farFuture ? "text-red-600" : "text-neutral-600")}>
            {reading}
          </span>
        )}
        {!hideToday && value !== today && (
          <button type="button" onClick={() => onChange(today)}
            className="text-[11px] text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
            ใช้วันนี้
          </button>
        )}
      </div>

      {farFuture && (
        <p className="mt-1 text-[11px] leading-relaxed text-red-600">
          วันที่นี้อยู่ในอนาคตไกลผิดปกติ — ถ้าตั้งใจกรอก พ.ศ. {value.slice(0, 4)} ให้ใส่ ค.ศ. {Number(value.slice(0, 4)) - 543} แทน
        </p>
      )}
      {!farFuture && veryOld && (
        <p className="mt-1 text-[11px] text-amber-700">วันที่เก่ากว่า 5 ปี — ทานอีกครั้งว่าพิมพ์ปีถูก</p>
      )}
      {hint && !farFuture && <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}
