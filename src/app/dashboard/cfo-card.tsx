// การ์ด AI CFO บนแดชบอร์ด — สรุปสุขภาพการเงิน + ปุ่มไปต่อเป็นคำสั่งในระบบ (31 ส.ค. 2569)
// เรนเดอร์ฝั่ง server จากตัวเลขที่ src/lib/cfo.ts คำนวณ — ไม่ใช้ token AI แม้แต่ครั้งเดียว
// โมเดลถูกเรียกก็ต่อเมื่อผู้ใช้กดปุ่ม (ส่งคำสั่งไปหน้าผู้ช่วยผ่าน ?q= เหมือน CommandBar)
import Link from "next/link";
import { BriefcaseBusiness, TriangleAlert, CircleAlert, CircleCheck, Info, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CfoBrief } from "@/lib/cfo";

const ICON = { red: TriangleAlert, amber: CircleAlert, green: CircleCheck, neutral: Info } as const;
const TONE = {
  red: "border-red-200 bg-red-50 text-red-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  neutral: "border-neutral-200 bg-neutral-50 text-neutral-700",
} as const;

export default function CfoCard({ brief }: { brief: CfoBrief }) {
  return (
    <section className="rounded-2xl border border-neutral-200/80 bg-neutral-900 p-4 text-white shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15">
          <BriefcaseBusiness className="h-4 w-4 text-emerald-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">AI CFO</p>
          <p className="mt-0.5 text-[15px] font-bold leading-snug">{brief.headline}</p>
          <p className="mt-1 text-xs text-neutral-400">
            เงินเข้า {brief.metrics.month_in.toLocaleString("th-TH")} · เงินออก {brief.metrics.month_out.toLocaleString("th-TH")} · รอเก็บ {brief.metrics.ar_total.toLocaleString("th-TH")} บาท
          </p>
        </div>
      </div>
      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {brief.insights.map((i, k) => {
          const Icon = ICON[i.tone];
          return (
            <li key={k} className={cn("flex flex-col gap-1.5 rounded-xl border px-3 py-2.5", TONE[i.tone])}>
              <p className="flex items-start gap-1.5 text-sm font-semibold leading-snug"><Icon className="mt-0.5 h-4 w-4 shrink-0" />{i.title}</p>
              <p className="text-xs leading-relaxed opacity-80">{i.detail}</p>
              {i.action && (
                <Link href={`/dashboard/assistant?q=${encodeURIComponent(i.action.command)}`}
                  className="mt-auto inline-flex min-h-[36px] items-center gap-1 self-start text-xs font-semibold underline-offset-2 hover:underline">
                  {i.action.label} <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      {/* ขอบเขตต้องบอกตรง ๆ บนการ์ด — ไม่ใช่ที่ปรึกษาการเงิน/การลงทุน */}
      <p className="mt-2 text-[11px] text-neutral-500">คำนวณจากตัวเลขในระบบเท่านั้น — เป็นข้อสังเกตเชิงปฏิบัติ ไม่ใช่คำแนะนำการลงทุนหรือกู้ยืม</p>
    </section>
  );
}
