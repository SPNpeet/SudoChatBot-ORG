import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function baht(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " ฿";
}

/** จำนวนเงินบนเอกสารทางการ — ทศนิยม 2 ตำแหน่งเสมอ ไม่มีสัญลักษณ์ */
export function bahtDoc(n: number | string | null | undefined): string {
  return Number(n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dateTH(d: string | Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("th-TH", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
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
