// หลอดโควตางาน AI (นับรวมทุกกิจการของบัญชี) — โชว์ตลอดเวลาบน sidebar
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

export interface AiQuota {
  allowed: boolean; reason: string | null;
  used_today: number; cap_today: number | null;
  used_month: number; cap_month: number | null;
  pct: number;
}

export default function AiQuotaBar({ quota }: { quota: AiQuota | null }) {
  if (!quota) return null;
  const pct = Math.round((quota.pct ?? 0) * 100);
  const color = pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-emerald-500";
  const label = quota.cap_today
    ? `${quota.used_today.toLocaleString()}/${quota.cap_today.toLocaleString()} วันนี้`
    : quota.cap_month
      ? `${quota.used_month.toLocaleString()}/${quota.cap_month.toLocaleString()} เดือนนี้`
      : "ไม่จำกัด";

  return (
    <Link href="/dashboard/billing" className="block rounded-xl px-3 py-2 hover:bg-neutral-50" title="โควตางาน AI (ผู้ช่วย/อ่านบิล) — กดเพื่อดูแพ็กเกจ">
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 font-medium text-neutral-500"><Zap className="h-3 w-3" />เครดิต AI</span>
        <span className={cn("tabular-nums", pct >= 95 ? "font-semibold text-red-600" : pct >= 80 ? "font-medium text-amber-600" : "text-neutral-400")}>{label}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
      </div>
      {!quota.allowed && <p className="mt-1 text-xs font-medium text-red-600">โควตาเต็ม — กดเพื่ออัปเกรด</p>}
    </Link>
  );
}
