import Link from "next/link";
import { baht, dateOnlyTH, cn } from "@/lib/utils";
import { docOutstanding } from "@/lib/finance";
import { AlarmClock, HandCoins, ClipboardCheck, ArrowRight, Landmark, Check } from "lucide-react";

// ============================================================
//  "วันนี้ต้องทำ" — แทนที่จะโชว์ตัวเลขเฉยๆ แล้วให้ผู้ใช้คิดเองว่าต้องทำอะไร
//  ระบบคิดให้เลยว่าวันนี้มีอะไรค้าง เรียงตามความเร่งด่วน กดแล้วไปทำได้ทันที
//  ไม่มีอะไรค้าง = โชว์ "เคลียร์หมดแล้ว" (inbox-zero) ให้รู้สึกว่าคุมงานอยู่
// ============================================================

export interface TodoDoc {
  id: string; doc_type: string; doc_number: string; contact_name: string | null;
  due_date: string | null; total: number; wht_amount: number; paid_amount: number;
}

export default function TodayPanel({ overdue, pendingApproval, unmatchedSlips, taxDueDay }: {
  overdue: TodoDoc[];
  pendingApproval: number;
  unmatchedSlips: number;
  taxDueDay: number | null;   // เหลือกี่วันถึงกำหนดยื่น ภ.พ.30 (วันที่ 15)
}) {
  const arOverdue = overdue.filter((d) => d.doc_type !== "expense");
  const apOverdue = overdue.filter((d) => d.doc_type === "expense");
  const arSum = arOverdue.reduce((a, d) => a + docOutstanding(d), 0);
  const apSum = apOverdue.reduce((a, d) => a + docOutstanding(d), 0);

  const tasks: { key: string; icon: typeof AlarmClock; tone: "red" | "amber" | "sky"; title: string; sub: string; href: string; cta: string }[] = [];

  if (arOverdue.length) tasks.push({
    key: "ar", icon: HandCoins, tone: "amber",
    title: `ตามเงิน ${arOverdue.length} ราย · ${baht(arSum)}`,
    sub: `เกินกำหนดแล้ว — รายเก่าสุด ${arOverdue[0].contact_name ?? "ไม่ระบุ"} ครบกำหนด ${dateOnlyTH(arOverdue[0].due_date)}`,
    href: "/dashboard/sales?t=unpaid", cta: "ดูรายการ",
  });
  if (apOverdue.length) tasks.push({
    key: "ap", icon: AlarmClock, tone: "red",
    title: `ต้องจ่าย ${apOverdue.length} บิล · ${baht(apSum)}`,
    sub: "เลยกำหนดชำระแล้ว — จ่ายวันนี้กันค่าปรับ/เสียเครดิต",
    href: "/dashboard/expenses?t=unpaid", cta: "ดูบิล",
  });
  if (pendingApproval > 0) tasks.push({
    key: "approve", icon: ClipboardCheck, tone: "amber",
    title: `อนุมัติค่าใช้จ่าย ${pendingApproval} รายการ`,
    sub: "พนักงานบันทึกไว้ รออนุมัติก่อนลงบัญชี",
    href: "/dashboard/expenses?t=pending", cta: "อนุมัติ",
  });
  if (unmatchedSlips > 0) tasks.push({
    key: "slip", icon: HandCoins, tone: "sky",
    title: `สลิปรอจับคู่ ${unmatchedSlips} ใบ`,
    sub: "ลูกค้าโอนมาแล้วแต่ยังไม่รู้ว่าเป็นของใบไหน",
    href: "/dashboard/money", cta: "จับคู่",
  });
  if (taxDueDay !== null && taxDueDay <= 7) tasks.push({
    key: "tax", icon: Landmark, tone: taxDueDay <= 2 ? "red" : "sky",
    title: taxDueDay <= 0 ? "ครบกำหนดยื่น ภ.พ.30 วันนี้" : `อีก ${taxDueDay} วันครบกำหนดยื่น ภ.พ.30`,
    sub: "ตรวจยอดภาษีขาย-ภาษีซื้อ แล้วดาวน์โหลดไฟล์ยื่นได้เลย",
    href: "/dashboard/reports", cta: "ดูรายงาน",
  });

  const TONE = {
    red: "border-red-200 bg-red-50/70 text-red-700",
    amber: "border-amber-200 bg-amber-50/70 text-amber-800",
    sky: "border-sky-200 bg-sky-50/70 text-sky-800",
  };

  if (!tasks.length) {
    return (
      /* ============================================================
         "ไม่มีงานค้าง" คือข่าวดีที่ไม่ต้องการพื้นที่
         เดิมเป็นการ์ดสูง 76px มีไอคอนวงกลม 44px + สองบรรทัด + พื้นไล่เฉดเขียว
         กินที่เท่าการ์ดที่มีงานให้ทำจริง ทั้งที่ไม่มีอะไรให้ทำ = รกเปล่า ๆ
         (เจ้าของชี้ตรงจุดนี้เอง) ยุบเป็นบรรทัดเดียว จุดเขียวเล็ก ๆ พอ
         หลักการ: ความสูงบนจอควรสัมพันธ์กับจำนวนงานที่ต้องทำ ศูนย์งาน = เกือบศูนย์พื้นที่
         ============================================================ */
      <p className="flex items-center gap-2 px-1 text-[13px] text-neutral-500">
        <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100">
          <Check className="h-3 w-3 text-emerald-600" />
        </span>
        <span><b className="font-semibold text-neutral-700">เคลียร์หมดแล้ว</b> — ไม่มีเอกสารเกินกำหนด ไม่มีรายการรออนุมัติ ไม่มีสลิปค้าง</span>
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-700">
        วันนี้ต้องทำ
        <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-bold text-white">{tasks.length}</span>
      </p>
      <div className="grid gap-2 lg:grid-cols-2">
        {tasks.map((t) => (
          <Link key={t.key} href={t.href}
            className={cn("group flex items-center gap-3 rounded-2xl border px-4 py-3 transition hover:shadow-sm active:scale-[0.995]", TONE[t.tone])}>
            <t.icon className="h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{t.title}</p>
              <p className="truncate text-xs opacity-80">{t.sub}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold opacity-70 group-hover:opacity-100">
              {t.cta} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
