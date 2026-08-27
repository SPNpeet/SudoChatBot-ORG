import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * จำนวนเงินสำหรับแสดงผล — ทศนิยม 2 ตำแหน่งเสมอ
 *
 * ⚠️ แก้ 28 ส.ค. 2569: เดิม minimumFractionDigits: 0 ทำให้ 155.70 แสดงเป็น "155.7"
 * และ 100 แสดงเป็น "100" — ตัวเลขเงินที่ความยาวทศนิยมไม่เท่ากันในหน้าเดียว
 * ทำให้สแกนตาแนวตั้งไม่ได้และดูไม่เป็นระบบบัญชี (คนตรวจภายนอกจับได้)
 * ยกเว้นจำนวนเต็มพอดียังแสดงสั้นได้ในที่ที่จงใจ เช่น หน้าโฆษณา — ใช้ bahtShort
 */
export function baht(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ฿";
}
/** จำนวนเงินแบบสั้นสำหรับหน้าการตลาด (ราคาแพ็กเกจ 99, 199) — ห้ามใช้ในหน้าบัญชี/เอกสาร */
export function bahtShort(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " ฿";
}

/** จำนวนเงินบนเอกสารทางการ — ทศนิยม 2 ตำแหน่งเสมอ ไม่มีสัญลักษณ์ */
export function bahtDoc(n: number | string | null | undefined): string {
  return Number(n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dateTH(d: string | Date | null | undefined): string {
  if (!d) return "-";
  const dt = new Date(d);
  // ⚠️ 12:00 เที่ยงตรงเป๊ะ = เครื่องหมาย "รู้แค่วันที่" ไม่ใช่เวลาเกิดรายการจริง
  // (recordPayment เก็บ paid_at ที่รู้เฉพาะวันเป็น T12:00+07:00 กันวันเพี้ยนข้ามโซนเวลา)
  // เจ้าของเจอจริง (1 ส.ค. 2569): ทุกแถวหน้าการเงินขึ้น "12:00" เรียงกันทั้งหน้า
  // ซึ่งอ่านแล้วเข้าใจผิดว่าโอนเที่ยงตรงพร้อมกันหมด — เวลาปลอมแย่กว่าไม่มีเวลา
  const bkk = new Date(dt.getTime() + 7 * 3600_000);
  const isDateOnlyMarker = bkk.getUTCHours() === 12 && bkk.getUTCMinutes() === 0 && bkk.getUTCSeconds() === 0;
  return dt.toLocaleString("th-TH", {
    day: "numeric", month: "short",
    ...(isDateOnlyMarker ? {} : { hour: "2-digit", minute: "2-digit" }),
    timeZone: "Asia/Bangkok",
  });
}

/** วันที่อย่างเดียว (ใช้กับ issue/due date) */
export function dateOnlyTH(d: string | Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok",
  });
}

export function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return "-";
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "เมื่อครู่";
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.ที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
}

export const PLAN_TH: Record<string, string> = {
  free: "ทดลองใช้", starter: "Starter", professional: "Professional", executive: "AI Executive", agency: "Agency",
};

export const SHOP_STATUS_TH: Record<string, string> = { active: "ใช้งานอยู่", suspended: "ระงับชั่วคราว", closed: "ปิดแล้ว" };
