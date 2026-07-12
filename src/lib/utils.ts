import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function baht(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " ฿";
}

export function dateTH(d: string | Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("th-TH", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Bangkok",
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

export const ORDER_STATUS_TH: Record<string, string> = {
  draft: "ร่าง", pending_payment: "รอชำระ", paid: "ชำระแล้ว", confirmed: "ยืนยันแล้ว",
  shipped: "จัดส่งแล้ว", completed: "สำเร็จ", cancelled: "ยกเลิก", expired: "หมดอายุ",
};

export const DOC_STATUS_TH: Record<string, string> = {
  pending: "รอประมวลผล", processing: "กำลังประมวลผล", ready: "พร้อมใช้", failed: "ล้มเหลว",
};
