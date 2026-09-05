// การ์ดแพ็กเกจ + การใช้งาน AI ท้ายเมนู (ออกแบบใหม่ 30 ส.ค. 2569 ตามคำสั่งเจ้าของ:
// "การจำกัดรูปแบบเดิมที่โชว์ว่าเหลือกี่คำถาม มันดูไม่มืออาชีพ")
//
// หลักคิดใหม่: หน้าบ้านขาย "แพ็กเกจ" ไม่ใช่ "จำนวนครั้งที่เหลือ"
//  · บรรทัดแรก = ชื่อแพ็ก (สิ่งที่ผู้ใช้ซื้อ) ไม่ใช่ตัวเลขนับถอยหลัง
//  · หลอดแสดง "การใช้งานเดือนนี้" เป็นสัดส่วน — คนอ่านรู้สถานะใน 0.5 วินาที
//  · ตัวเลขจริงยังอยู่ครบใน title (hover/แตะค้าง) และหน้าแพ็กเกจ — ความจริงไม่หาย แค่ไม่ตะโกน
//  · ใกล้เต็ม/เต็ม จึงค่อยขึ้นข้อความ+ปุ่มอัปเกรด — ปกติไม่มีอะไรมากวนตา
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Zap, ArrowUpRight } from "lucide-react";
import { PLAN_NAME_TH } from "@/lib/plan-names";

export interface AiQuota {
  allowed: boolean; reason: string | null;
  used_today: number; cap_today: number | null;
  used_month: number; cap_month: number | null;
  pct: number;
}

export default function AiQuotaBar({ quota, planCode }: { quota: AiQuota | null; planCode?: string | null }) {
  if (!quota) return null;
  const pct = Math.round((quota.pct ?? 0) * 100);
  const planName = PLAN_NAME_TH[planCode ?? ""] ?? "ทดลองใช้";
  const unlimited = !quota.cap_today && !quota.cap_month;

  // รายละเอียดตัวเลขจริง — อยู่ใน title เสมอ ใครอยากรู้เป๊ะ ๆ ชี้ดูได้ ไม่โดนซ่อน
  // หน่วยเป็น "เครดิต" (migration 113): แชท 1 · อ่านบิล 2 · นำเข้าไฟล์ 3 — มาตรวัดเดียวทั้งระบบ
  const detail = quota.cap_today
    ? `ใช้ไป ${quota.used_today.toLocaleString()} จาก ${quota.cap_today.toLocaleString()} เครดิตวันนี้ · รีเซ็ตเที่ยงคืน`
    : quota.cap_month
      ? `ใช้ไป ${quota.used_month.toLocaleString()} จาก ${quota.cap_month.toLocaleString()} เครดิตเดือนนี้ · รีเซ็ตวันที่ 1`
      : "เครดิต AI ไม่จำกัดในแพ็กนี้";

  const tone = !quota.allowed ? "full" : pct >= 80 ? "near" : "ok";

  return (
    <Link href="/dashboard/billing" title={detail}
      className="block rounded-xl border border-neutral-200/80 bg-white px-3 py-2.5 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
          <Zap className="h-3.5 w-3.5 text-emerald-600" />แพ็ก{planName}
        </span>
        {tone !== "ok" && (
          <span className={cn("text-[10px] font-bold", tone === "full" ? "text-red-600" : "text-amber-600")}>
            {tone === "full" ? "เครดิต AI เต็ม" : "ใกล้เต็ม"}
          </span>
        )}
      </div>
      {unlimited ? (
        <p className="mt-1 text-[11px] text-neutral-400">เครดิต AI ไม่จำกัด</p>
      ) : (
        <>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-clip rounded-full bg-neutral-100">
              <div className={cn("h-full rounded-full transition-all",
                tone === "full" ? "bg-red-500" : tone === "near" ? "bg-amber-400" : "bg-emerald-500")}
                style={{ width: `${Math.min(100, Math.max(3, pct))}%` }} />
            </div>
            <span className="shrink-0 text-[10px] tabular-nums text-neutral-400">{pct}%</span>
          </div>
          <p className="mt-1 text-[10px] tabular-nums text-neutral-400">
            เครดิต AI {quota.cap_today ? "วันนี้" : "เดือนนี้"} · เหลือ {Math.max(0, (quota.cap_today ?? quota.cap_month ?? 0) - (quota.cap_today ? quota.used_today : quota.used_month)).toLocaleString()}
          </p>
        </>
      )}
      {/* ชวนอัปเกรดเฉพาะตอนที่มันช่วยได้จริง — ใกล้เต็ม/เต็มแล้วเท่านั้น ไม่ขายของตลอดเวลา */}
      {tone !== "ok" && (
        <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
          อัปเกรดเพื่อใช้ต่อ <ArrowUpRight className="h-3 w-3" />
        </span>
      )}
    </Link>
  );
}
