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
import { ACTION_CHIP } from "@/components/ui";
import { docDateTooFarFuture, docDateVeryOld } from "@/lib/tax-th";

/** ตัวย่อเดือนไทยตามราชบัณฑิตฯ — ⚠️ ห้ามสร้างจากการตัดชื่อเต็ม
 *  เคยพลาดจริง 5 ก.ย. 2569: ใช้ "กันยายน".slice(0,3) ได้ "กัน" ซึ่งไม่ใช่คำย่อของเดือนใดเลย */
const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

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
            /* ⚠️ ซ่อนตัวเลขของเบราว์เซอร์แล้ววาดวันที่ไทยทับ (แก้ 5 ก.ย. 2569)
               วัดจริงบน production: Chrome แสดง input[type=date] เป็น "09/05/2026"
               แม้ตั้ง locale เป็น th-TH — คนไทยอ่านเป็น "9 พฤษภาคม" ทันที
               และนี่คือช่อง "วันที่เอกสาร" ของใบกำกับภาษี = อ่านผิดแล้วยื่นภาษีผิดงวด
               ตัวช่องยังเป็น input[type=date] เดิมทุกอย่าง (คลิกเปิดปฏิทิน showPicker iOS)
               แค่ตัวอักษรโปร่งใสเมื่อมีค่า แล้ววาดข้อความไทยทับด้วย pointer-events-none */
            value && "text-transparent",
            farFuture ? "border-red-400 focus:border-red-500"
              : "border-neutral-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15",
          )}
        />
        {/* วันที่ที่ "คนอ่าน" — ทับตำแหน่งเดิมของตัวเลขเบราว์เซอร์ กดทะลุไปที่ช่องได้ */}
        <span aria-hidden className={cn(
          "pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 pr-11 text-base sm:text-sm",
          value ? (farFuture ? "font-medium text-red-600" : "font-medium text-neutral-900") : "text-neutral-400",
        )}>
          {value ? readThaiDate(value) : "เลือกวันที่"}
        </span>

        {/* ไอคอนของเราเอง วางทับตัวเนทีฟที่ซ่อนไว้ ให้พื้นที่กดใหญ่ขึ้น */}
        <button type="button" aria-label="เปิดปฏิทิน" onClick={openPicker} tabIndex={-1}
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600">
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>

      {/* วันที่ไทยย้ายขึ้นไปอยู่ในช่องแล้ว ข้างล่างจึงเหลือเฉพาะปุ่มลัด
          (เดิมบรรทัดนี้คือทางแก้ปัญหา "09/05" แบบหมายเหตุตัวเล็ก — ตอนนี้แก้ที่ต้นเหตุแล้ว) */}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 empty:mt-0">
        {/* ปุ่มจริง — เป็นทางลัดที่คนกดบ่อยที่สุดในฟอร์ม ต้องกดง่ายไม่ใช่ข้อความเล็ก ๆ */}
        {!hideToday && value !== today && (
          <button type="button" onClick={() => onChange(today)}
            className={cn(ACTION_CHIP, "border-emerald-300 text-emerald-700 hover:text-emerald-800")}>
            ใช้วันนี้
          </button>
        )}
      </div>

      {farFuture && (
        <p className="mt-1 text-xs leading-relaxed text-red-600">
          วันที่นี้อยู่ในอนาคตไกลผิดปกติ — ถ้าตั้งใจกรอก พ.ศ. {value.slice(0, 4)} ให้ใส่ ค.ศ. {Number(value.slice(0, 4)) - 543} แทน
        </p>
      )}
      {!farFuture && veryOld && (
        <p className="mt-1 text-xs text-amber-700">วันที่เก่ากว่า 5 ปี — ทานอีกครั้งว่าพิมพ์ปีถูก</p>
      )}
      {hint && !farFuture && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

/** "2026-09-05" -> "5 ก.ย. 69" — แบบสั้นสำหรับช่องแคบ (บนตัวเอกสาร/ในแถว) */
export function readThaiDateShort(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (m < 1 || m > 12) return "";
  return `${d} ${TH_MONTHS_SHORT[m - 1]} ${String((y + 543) % 100).padStart(2, "0")}`;
}

/**
 * ช่องวันที่แบบแคบ — ใช้ที่ที่ DateField เต็มรูปแบบไม่พอดี (บนตัวเอกสาร · ในแถวรายการ)
 * เหตุผลเดียวกับ DateField: เบราว์เซอร์แสดง "09/05/2026" ซึ่งคนไทยอ่านผิดเป็น 9 พ.ค.
 * ตัว input ยังเป็น type=date เดิมทุกอย่าง แค่วาดข้อความไทยทับ
 */
export function ThaiDateInline({ value, onChange, ariaLabel, className, max, min }: {
  value: string; onChange: (v: string) => void; ariaLabel: string;
  className?: string; max?: string; min?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span className="relative inline-flex">
      <input
        ref={ref} type="date" value={value} max={max} min={min} aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onClick={() => { try { ref.current?.showPicker?.(); } catch { /* เบราว์เซอร์เก่าใช้ไอคอนเนทีฟ */ } }}
        className={cn("appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0", value && "text-transparent", className)}
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-end pr-2 text-sm text-neutral-900">
        {value ? readThaiDateShort(value) : "เลือกวันที่"}
      </span>
    </span>
  );
}

/**
 * ช่องเลือกเดือน — select เดือนไทย + ปี พ.ศ.
 * ⚠️ ห้ามกลับไปใช้ input[type="month"] (วัดจริง 5 ก.ย. 2569: แสดง "September 2026"
 * อังกฤษ + ค.ศ. แม้ตั้ง locale th-TH · เปลี่ยนข้อความไม่ได้เลย)
 * ค่าที่ส่งออกยังเป็น "YYYY-MM" เหมือน input เดิมทุกประการ — ผู้เรียกไม่ต้องแก้ตรรกะ
 */
export function MonthField({ value, onChange, name, ariaLabel = "เลือกเดือน", years = 6 }: {
  value: string; onChange?: (v: string) => void; name?: string; ariaLabel?: string; years?: number;
}) {
  const [y, m] = (/^\d{4}-\d{2}$/.test(value) ? value : bkkTodayISO().slice(0, 7)).split("-");
  const thisYear = Number(bkkTodayISO().slice(0, 4));
  const opts = Array.from({ length: years }, (_, i) => thisYear - i);
  const cls = "h-10 rounded-xl border border-neutral-300 bg-white px-2.5 text-base outline-none focus:border-emerald-500 sm:text-sm";
  return (
    <span className="inline-flex gap-1.5">
      {/* ส่งค่ารวมเป็นช่องซ่อน เพื่อให้ฟอร์มแบบ method=get ที่ใช้ name เดิมยังทำงานเหมือนเดิม */}
      {name && <input type="hidden" name={name} value={`${y}-${m}`} />}
      <select aria-label={ariaLabel} value={m} onChange={(e) => onChange?.(`${y}-${e.target.value}`)} className={cls}>
        {TH_MONTHS.map((label, i) => {
          const v = String(i + 1).padStart(2, "0");
          return <option key={v} value={v}>{label}</option>;
        })}
      </select>
      <select aria-label="ปี" value={y} onChange={(e) => onChange?.(`${e.target.value}-${m}`)} className={cls}>
        {opts.map((yy) => <option key={yy} value={yy}>{yy + 543}</option>)}
      </select>
    </span>
  );
}
