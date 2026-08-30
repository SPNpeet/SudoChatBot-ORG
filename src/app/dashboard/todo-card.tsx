// ============================================================
//  งานที่ต้องทำ — เหตุผลให้เปิดระบบ "พรุ่งนี้"
//
//  ⚠️ ทำไมการ์ดนี้สำคัญกว่าที่เห็น (วัดจริง 19 ส.ค. 2569)
//  จาก 24 กิจการที่เคยใช้งาน มี 18 กิจการที่ใช้แค่ "วันเดียว" แล้วไม่กลับมาอีกเลย
//  เหลือกิจการที่ยังใช้อยู่ใน 7 วันล่าสุดแค่ 3 ราย
//
//  สาเหตุเชิงโครงสร้าง: ระบบเดิมเป็น "เครื่องมือที่รอให้นึกถึง"
//  ผู้ใช้ต้องจำเองว่ามีอะไรค้าง ต้องจำเองว่าภาษีครบกำหนดเมื่อไหร่
//  ซึ่งคนที่ไม่รู้บัญชี (กลุ่มผู้ใช้หลักของเรา) จำไม่ได้อยู่แล้ว จึงไม่มีเหตุให้เปิดอีก
//
//  การ์ดนี้กลับด้าน: ระบบบอกเองว่าวันนี้ต้องทำอะไร โดยใช้ข้อมูลที่มีอยู่แล้วทั้งหมด
//  ไม่ได้เพิ่มการเก็บข้อมูลใหม่แม้แต่ช่องเดียว
//
//  ⚠️ กติกาข้อ 7: กำหนดยื่นที่แสดงคือ "กำหนดตามกฎหมาย" ซึ่งนิ่งและไม่มีวันหมดอายุ
//  ส่วนการขยายเวลายื่นออนไลน์มาจากประกาศที่มีวันสิ้นสุด (ตาราง rd_filing_extensions)
//  จึงไม่เอามาบวกเองที่นี่ เพราะถ้าประกาศหมดอายุแล้วเรายังบวกให้
//  ผู้ใช้จะยื่นช้ากว่ากำหนดจริงและโดนเงินเพิ่ม — ผิดในทิศที่อันตราย
// ============================================================
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ListChecks, CheckCircle2 } from "lucide-react";
import { baht } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface TodoInput {
  today: string;                       // YYYY-MM-DD เวลาไทย
  overdue: { id: string; doc_number: string; contact_name: string | null; due_date: string; total: number; wht_amount: number; paid_amount: number }[];
  pendingApproval: number;
  unmatchedSlips: number;
  draftDocs: number;
  hasVat: boolean;                     // กิจการจดทะเบียน VAT ไหม (มีเลขผู้เสียภาษี)
}

interface Task {
  title: string; sub?: string; href: string;
  due: string;                         // YYYY-MM-DD
  tone: "red" | "amber" | "neutral";
}

/** ป้ายกำหนดส่งที่คนอ่านแล้วรู้ทันทีว่าต้องรีบแค่ไหน */
function dueLabel(due: string, today: string): { text: string; tone: Task["tone"] } {
  const d = Math.round((Date.parse(due) - Date.parse(today)) / 864e5);
  if (d < 0) return { text: `เลยกำหนด ${Math.abs(d)} วัน`, tone: "red" };
  if (d === 0) return { text: "วันนี้", tone: "red" };
  if (d === 1) return { text: "พรุ่งนี้", tone: "amber" };
  if (d <= 7) return { text: `อีก ${d} วัน`, tone: "amber" };
  const [, m, dd] = due.split("-");
  return { text: `${Number(dd)}/${Number(m)}`, tone: "neutral" };
}

/**
 * กำหนดยื่นตามกฎหมาย ของงวดเดือนก่อนหน้า
 * ภ.พ.30 = ภายในวันที่ 15 ของเดือนถัดไป (ประมวลรัษฎากร ม.83)
 * ภ.ง.ด.3/53 = ภายในวันที่ 7 ของเดือนถัดไป (ม.52)
 */
function filingTasks(today: string, hasVat: boolean): Task[] {
  const [y, m] = today.split("-").map(Number);

  // ⚠️ ต้องมองสองงวด: กำหนดของเดือนนี้ (งวดเดือนก่อน) และกำหนดของเดือนหน้า (งวดเดือนนี้)
  // เดิมมองแค่งวดเดียว ผลจริงบนจอ 30 ส.ค.: กำหนด 7/15 ส.ค. ผ่านไปแล้วถูกกรองทิ้ง
  // การ์ดเลยขึ้น "ไม่มีงานค้าง" ทั้งที่อีก 8 วันต้องยื่น ภ.ง.ด. งวดสิงหาคม
  // = ระบบเงียบในจังหวะที่ควรเตือนที่สุด (ก่อนถึงกำหนด) แล้วค่อยมาแดงตอนเลยกำหนดแล้ว
  const out: Task[] = [];
  for (const offset of [0, 1]) {                             // 0 = กำหนดเดือนนี้ · 1 = กำหนดเดือนหน้า
    const period = new Date(Date.UTC(y, m - 2 + offset, 1)); // งวด = เดือนก่อนหน้าของกำหนดนั้น
    const pStr = period.toISOString().slice(0, 7);
    const pLabel = period.toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: "UTC" });
    const day = (n: number) => new Date(Date.UTC(y, m - 1 + offset, n)).toISOString().slice(0, 10);

    out.push({ title: "ยื่น ภ.ง.ด.3 / ภ.ง.ด.53", sub: `ภาษีหัก ณ ที่จ่าย งวด${pLabel}`, href: `/dashboard/reports?t=wht&period=${pStr}`, due: day(7), tone: "neutral" });
    if (hasVat) {
      out.push({ title: "ยื่น ภ.พ.30", sub: `ภาษีมูลค่าเพิ่ม งวด${pLabel}`, href: `/dashboard/reports?t=vat&period=${pStr}`, due: day(15), tone: "neutral" });
    }
  }

  // เก็บใบเดียวต่อแบบ: ใบที่กำหนดใกล้ที่สุดซึ่งยังไม่พ้นไปไกล (เลยมาเกิน 20 วัน = ไม่ใช่งานพรุ่งนี้แล้ว)
  // และไม่โชว์ของที่ไกลเกิน 45 วันข้างหน้า — เตือนล่วงหน้าข้ามงวดคือเสียงรบกวน
  const seen = new Set<string>();
  return out
    .filter((t) => {
      const d = Date.parse(t.due) - Date.parse(today);
      return d >= -20 * 864e5 && d <= 45 * 864e5;
    })
    .sort((a, b) => a.due.localeCompare(b.due))
    .filter((t) => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
}

export default function TodoCard(input: TodoInput) {
  const { today, overdue, pendingApproval, unmatchedSlips, draftDocs, hasVat } = input;

  const tasks: Task[] = [
    ...overdue.slice(0, 5).map((d) => ({
      title: `ติดตามการชำระเงิน ${d.doc_number}`,
      sub: `${d.contact_name || "ไม่ระบุลูกค้า"} · ค้าง ${baht(Number(d.total) - Number(d.wht_amount) - Number(d.paid_amount))}`,
      href: `/dashboard/sales/${d.id}`,
      due: d.due_date, tone: "red" as const,
    })),
    ...filingTasks(today, hasVat),
  ];

  // งานที่ไม่มีกำหนดส่ง แต่ค้างอยู่จริงและปิดได้เร็ว — วางท้ายเสมอ
  const chores: { title: string; sub: string; href: string }[] = [];
  if (pendingApproval > 0) chores.push({ title: `อนุมัติค่าใช้จ่าย ${pendingApproval} รายการ`, sub: "ยังไม่ลงบัญชีจนกว่าจะอนุมัติ", href: "/dashboard/expenses?approval=pending" });
  if (unmatchedSlips > 0) chores.push({ title: `จับคู่เงินเข้า ${unmatchedSlips} รายการ`, sub: "เงินเข้าแล้วแต่ยังไม่รู้ว่าเป็นของใบไหน", href: "/dashboard/money" });
  if (draftDocs > 0) chores.push({ title: `เอกสารร่างค้าง ${draftDocs} ใบ`, sub: "ยังไม่ออกจริง ยังไม่ลงบัญชี", href: "/dashboard/sales?status=draft" });

  const sorted = tasks.sort((a, b) => a.due.localeCompare(b.due));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-emerald-600" /> งานที่ต้องทำ
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {sorted.length === 0 && chores.length === 0 ? (
          <p className="flex items-center gap-2 px-6 pb-4 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> ไม่มีงานค้าง — ทุกอย่างตามกำหนด
          </p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {sorted.map((t, i) => {
              const l = dueLabel(t.due, today);
              return (
                <Link key={`t${i}`} href={t.href}
                  className="flex min-h-[52px] items-center justify-between gap-3 px-6 py-2.5 hover:bg-neutral-50">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{t.title}</span>
                    {t.sub && <span className="block truncate text-xs text-neutral-500">{t.sub}</span>}
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                    l.tone === "red" ? "bg-red-50 text-red-700"
                      : l.tone === "amber" ? "bg-amber-50 text-amber-800" : "bg-neutral-100 text-neutral-600")}>
                    {l.text}
                  </span>
                </Link>
              );
            })}
            {chores.map((c, i) => (
              <Link key={`c${i}`} href={c.href}
                className="flex min-h-[52px] items-center justify-between gap-3 px-6 py-2.5 hover:bg-neutral-50">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{c.title}</span>
                  <span className="block truncate text-xs text-neutral-500">{c.sub}</span>
                </span>
                <span className="shrink-0 text-neutral-300">›</span>
              </Link>
            ))}
          </div>
        )}
        <p className="px-6 pt-3 text-xs text-neutral-400">
          กำหนดยื่นที่แสดงคือกำหนดตามกฎหมาย · ยื่นออนไลน์มักได้เพิ่มอีกไม่กี่วันตามประกาศที่ใช้อยู่ขณะนั้น
          และถ้าตรงวันหยุดราชการให้เลื่อนเป็นวันทำการถัดไป
        </p>
      </CardContent>
    </Card>
  );
}
