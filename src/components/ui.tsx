import { cn } from "@/lib/utils";
import Link from "next/link";
import * as React from "react";
import { ChevronLeft, Lightbulb, Inbox, ArrowRight } from "lucide-react";

// ============================================================
//  ระบบดีไซน์กลาง — แก้ที่นี่ที่เดียว หน้าตาทั้งแอปเปลี่ยนตาม
//  แนวทาง: ขาวสะอาด เงานุ่มบางๆ ขอบมนสม่ำเสมอ สีเขียวแบรนด์ใช้เฉพาะจุดสำคัญ
//  ทุกอย่างที่กดได้ต้องมี hover/active/focus-visible ชัดเจน (ใช้บนมือถือก็รู้ว่ากดติด)
// ============================================================

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1";

/**
 * ปุ่ม "?" ที่กางคำอธิบายตอนเอาเมาส์ไปวาง / กด (มือถือ)
 *
 * ⚠️ ทำไม (8 ส.ค. 2569): ฟอร์มตั้งค่าหลายหน้ามีคำอธิบายตัวเล็ก 2-3 บรรทัดใต้ทุกช่อง
 * รวมกันแล้วยาวกว่าตัวฟอร์มเอง เจ้าของบอกว่า "รกมาก" และของสำคัญจมหายไปกับคำอธิบาย
 * ที่คนอ่านครั้งเดียวตอนตั้งค่าครั้งแรกแล้วไม่เคยอ่านอีก
 * ย้ายมาซ่อนหลังปุ่มเล็ก ๆ — ยังอ่านได้ครบเมื่ออยากอ่าน แต่ไม่กินพื้นที่ตลอดเวลา
 *
 * ใช้ CSS ล้วน (group-hover + focus-within) ไม่ใช้ state
 * เพราะ component นี้ถูกใช้ในไฟล์ที่เป็น Server Component ได้ด้วย
 * บนมือถือที่ไม่มี hover ใช้ tabIndex ให้แตะแล้ว focus ค้าง = อ่านได้เหมือนกัน
 */
export function InfoHint({ children, className, align = "left" }: {
  children: React.ReactNode; className?: string; align?: "left" | "right";
}) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      <button type="button" tabIndex={0} aria-label="ดูคำอธิบาย"
        className={cn(
          "grid h-5 w-5 place-items-center rounded-full border border-neutral-300 text-xs leading-none text-neutral-400",
          "transition-colors hover:border-neutral-500 hover:text-neutral-700", FOCUS,
        )}>?</button>
      <span className={cn(
        "pointer-events-none absolute top-[calc(100%+0.375rem)] z-50 w-[min(20rem,80vw)] rounded-xl bg-neutral-900 px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-xl transition-opacity",
        "group-hover:opacity-100 group-focus-within:opacity-100",
        align === "right" ? "right-0" : "left-0",
      )}>{children}</span>
    </span>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]",
        className,
      )}
      {...props}
    />
  );
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-2 pt-4", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold tracking-tight text-neutral-900", className)} {...props} />;
}

/**
 * หัวข้อการ์ดพร้อมไอคอนเส้น — ใช้แทนการเอาอิโมจิไปแปะหน้าข้อความ
 * ไอคอนอยู่ในกล่องสีจางขนาดเท่ากันทุกใบ สายตาจึงกวาดเจอหัวข้อได้เป็นจังหวะเดียวกันทั้งหน้า
 */
export function CardTitleIcon({ icon: Icon, children, desc, className }: {
  icon: React.ComponentType<{ className?: string }>; children: React.ReactNode;
  desc?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
        <Icon className="h-[17px] w-[17px]" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-neutral-900">{children}</h3>
        {desc && <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{desc}</p>}
      </div>
    </div>
  );
}

/**
 * ปุ่มย้อนกลับมาตรฐาน — วางไว้บนสุดของหน้าย่อยทุกหน้า
 * ระบุปลายทางชัดเจนเสมอ ("กลับไปค่าใช้จ่าย") ไม่ใช่แค่ "ย้อนกลับ" ลอยๆ
 * เพราะผู้ใช้เข้าหน้านี้จากลิงก์/แจ้งเตือน/ประวัติได้หลายทาง history.back() จะเดาผิด
 */
export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link href={href}
      className={cn(
        "group -ml-1.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[13px] font-medium text-neutral-500",
        "transition-colors hover:bg-neutral-100 hover:text-neutral-900", FOCUS, className,
      )}>
      <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      {label}
    </Link>
  );
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

/**
 * การ์ดตัวเลขสรุป — ใช้บนแดชบอร์ด ให้ทุกหน้าหน้าตาเดียวกัน
 * ส่ง href มาได้ → ทั้งใบกลายเป็นลิงก์ (ยกใบขึ้นตอน hover) แทนที่จะกดได้แค่ข้อความเล็กๆ ข้างล่าง
 */
export function StatCard({ label, value, hint, icon, tone = "neutral", className, href }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode;
  tone?: "neutral" | "green" | "amber" | "red"; className?: string; href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        {icon && (
          <span className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors",
            tone === "green" && "bg-emerald-50 text-emerald-600",
            tone === "amber" && "bg-amber-50 text-amber-600",
            tone === "red" && "bg-red-50 text-red-600",
            tone === "neutral" && "bg-neutral-100 text-neutral-500",
          )}>{icon}</span>
        )}
      </div>
      <p className={cn(
        "mt-2 text-2xl font-bold tabular-nums tracking-tight",
        tone === "red" ? "text-red-600" : tone === "green" ? "text-emerald-700" : "text-neutral-900",
      )}>{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn(
        "block rounded-2xl border border-neutral-200/80 bg-white p-5",
        "shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]",
        "transition-all duration-150 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md active:translate-y-0",
        FOCUS, className,
      )}>{body}</Link>
    );
  }
  return <Card className={cn("p-5", className)}>{body}</Card>;
}

/**
 * หัวหน้าเพจมาตรฐาน — ทุกหน้าหน้าตาเหมือนกัน ผู้ใช้เรียนรู้ครั้งเดียวใช้ได้ทั้งแอป
 *  · title  = ชื่อหน้า
 *  · lead   = ตัวเลขสำคัญของหน้านี้ (เห็นปุ๊บรู้สถานะ)
 *  · help   = "หน้านี้ใช้ทำอะไร" ภาษาชาวบ้าน — สำคัญมากกับคนที่ไม่เคยใช้โปรแกรมบัญชี
 *  · action = ปุ่มหลัก 1 ปุ่ม (มือถือเต็มความกว้าง นิ้วกดง่าย)
 */
export function PageHeader({ title, lead, help, action, back }: {
  title: string; lead?: React.ReactNode; help?: React.ReactNode; action?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="space-y-3">
      {back && <BackLink href={back.href} label={back.label} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-neutral-900">{title}</h1>
          {lead && <p className="mt-1 text-sm text-neutral-600">{lead}</p>}
        </div>
        {action && <div className="w-full sm:w-auto [&_a]:w-full [&_button]:w-full sm:[&_a]:w-auto sm:[&_button]:w-auto">{action}</div>}
      </div>
      {/* ⚠️ คำอธิบายหน้าต้องพับเก็บได้บนมือถือ (แก้ 27 ส.ค. 2569)
          เจ้าของแจ้งว่า "ใช้ยาก รก" — วัดจากหน้าจอจริง 390px พบว่าหน้าจอแรก
          หมดไปกับหัวเรื่อง + กล่องคำอธิบายตัวเล็ก 3-4 บรรทัด + แถบเครื่องมือ
          กว่าจะเห็นตัวเลขสักตัวต้องเลื่อนลง ทั้งที่ตัวเลขคือเหตุผลเดียวที่คนเปิดหน้านี้
          คำอธิบายมีประโยชน์ตอนใช้ครั้งแรก แต่กลายเป็นสิ่งกีดขวางตั้งแต่ครั้งที่สองเป็นต้นไป
          จึงพับบนมือถือ (แตะเปิดได้) และกางเองบนจอใหญ่ที่มีที่ว่างพอ — ดู .pagehelp ใน globals.css */}
      {help && (
        <details className="pagehelp">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-[12px] font-medium text-neutral-500">
            <Lightbulb aria-hidden className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            หน้านี้ใช้ยังไง
          </summary>
          <p className="pagehelp-body flex items-start gap-2 rounded-xl border border-neutral-200/70 bg-neutral-50/70 px-3 py-2.5 text-[12px] leading-relaxed text-neutral-500">
            <Lightbulb aria-hidden className="mt-[1px] h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <span>{help}</span>
          </p>
        </details>
      )}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "brand" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};
/**
 * คลาสหน้าตาของปุ่ม — แยกออกมาเพื่อให้ <Link> ใช้ได้โดยไม่ต้องซ้อน <button> ข้างใน
 *
 * ⚠️ ทำไมต้องมี (27 ส.ค. 2569): มี 6 จุดที่เขียน <Link><Button>...</Button></Link>
 * ซึ่งได้ HTML ที่มี element กดได้ซ้อนกันสองชั้น ผลจริงที่วัดได้บนจอ 390px คือ
 * ปุ่มชื่อเดียวกันโผล่สองครั้งในหน้าเดียว (ด่าน check:dupbuttons จับได้)
 * และเป็นโครงที่ผิดมาตรฐาน HTML ซึ่งโปรแกรมอ่านหน้าจอจะอ่านซ้ำสองรอบ
 * ทางที่ถูกคือให้ลิงก์เป็นตัวกดเอง แล้วยืมคลาสหน้าตาของปุ่มมาใช้
 */
export function buttonClass(variant: BtnProps["variant"] = "primary", size: BtnProps["size"] = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center gap-1.5 rounded-xl font-medium transition-all duration-100",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50", FOCUS,
    size === "sm" ? "h-8 px-3 text-xs" : size === "lg" ? "h-12 px-6 text-[15px]" : "h-10 px-4 text-sm",
    variant === "primary" && "bg-neutral-900 text-white shadow-sm hover:bg-neutral-700",
    variant === "brand" && "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500",
    variant === "outline" && "border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50",
    variant === "ghost" && "text-neutral-600 hover:bg-neutral-100",
    variant === "danger" && "bg-red-600 text-white shadow-sm hover:bg-red-500",
    className,
  );
}

export function Button({ className, variant = "primary", size = "md", ...props }: BtnProps) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center gap-1.5 rounded-xl font-medium transition-all duration-100",
        "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50", FOCUS,
        size === "sm" ? "h-8 px-3 text-xs" : size === "lg" ? "h-12 px-6 text-[15px]" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-neutral-900 text-white shadow-sm hover:bg-neutral-700",
        variant === "brand" && "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500",
        variant === "outline" && "border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50",
        variant === "ghost" && "text-neutral-600 hover:bg-neutral-100",
        variant === "danger" && "bg-red-600 text-white shadow-sm hover:bg-red-500",
        className,
      )}
      {...props}
    />
  );
}

/**
 * ปุ่มสั่งงานขนาดเล็กที่อยู่ในพื้นที่ซึ่งมีสีพื้นของตัวเองอยู่แล้ว
 * (แถบเตือน · การ์ดสี · กล่องจดหมายระบบ · แถบแนบไฟล์)
 *
 * ⚠️ ทำไมต้องมี (11 ส.ค. 2569 เจ้าของสั่ง: "ไม่มีตัวหนังสือเชย ๆ ให้กด"):
 * ก่อนหน้านี้ปุ่มสั่งงานพวกนี้เป็น "ข้อความขีดเส้นใต้" ซึ่งมีปัญหา 3 อย่างพร้อมกัน
 *   1. หน้าตาเหมือนคำอธิบาย ไม่ใช่ปุ่ม — ผู้ใช้ต้องเดาว่ากดได้ไหม
 *   2. เป้ากดคือความกว้างของตัวอักษรเท่านั้น บนมือถือกดพลาดง่ายมาก
 *   3. ขีดเส้นใต้เป็นภาษาของ "ลิงก์ไปหน้าอื่น" ใช้กับปุ่มที่ทำงานทันทีแล้วสื่อผิด
 *
 * ใช้คู่กับคลาสสีของบริบทนั้น เช่น `cn(ACTION_CHIP, "border-amber-300 text-amber-900")`
 * ห้ามใช้แทนปุ่มหลักของหน้า — ปุ่มหลักต้องเป็น <Button> เต็มขนาด
 */
export const ACTION_CHIP = cn(
  "inline-flex min-h-9 select-none items-center gap-1 rounded-lg border bg-white/70 px-2.5 py-1.5",
  "text-xs font-semibold transition-all duration-100 hover:bg-white active:scale-[0.97]",
  FOCUS, "disabled:pointer-events-none disabled:opacity-50",
);

const FIELD = cn(
  // text-base (16px) กัน iOS Safari auto-zoom ตอนโฟกัส input ที่ font-size < 16px
  "w-full rounded-xl border border-neutral-300 bg-white text-base text-neutral-900 outline-none transition-colors sm:text-sm",
  "placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15",
  "disabled:bg-neutral-50 disabled:text-neutral-400",
);

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, "h-11 px-3.5 sm:h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, "min-h-24 px-3.5 py-2.5", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(FIELD, "h-11 px-3 sm:h-10", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-medium text-neutral-600", className)} {...props} />;
}

/** ช่องกรอกพร้อมป้าย + คำอธิบาย + ข้อความ error — ใช้แทนการวาง Label/Input เองทุกที่ */
export function Field({ label, hint, error, required, children, className }: {
  label: string; hint?: string; error?: string | null; required?: boolean;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <Label>
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
      {error
        ? <p className="mt-1 text-xs text-red-600">{error}</p>
        : hint ? <p className="mt-1 text-xs text-neutral-400">{hint}</p> : null}
    </div>
  );
}

export function Badge({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "green" | "amber" | "red" | "blue" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tone === "neutral" && "bg-neutral-50 text-neutral-600 ring-neutral-200",
        tone === "green" && "bg-emerald-50 text-emerald-700 ring-emerald-200",
        tone === "amber" && "bg-amber-50 text-amber-700 ring-amber-200",
        tone === "red" && "bg-red-50 text-red-700 ring-red-200",
        tone === "blue" && "bg-sky-50 text-sky-700 ring-sky-200",
        className,
      )}
      {...props}
    />
  );
}

/**
 * ตาราง — บนมือถือคอลัมน์เกินจอต้องเลื่อนแนวนอน
 * เงาจางฝั่งขวาคือตัวบอกว่า "ยังมีคอลัมน์ต่ออีก" (ไม่งั้นผู้ใช้ไม่รู้ว่าคอลัมน์สถานะซ่อนอยู่)
 * ใช้ background-attachment: local ทำให้เงาหายเองเมื่อเลื่อนสุดขอบ — ไม่ต้องใช้ JS
 */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    // ⚠️ lg: ขึ้นไปต้องเป็น overflow-x-clip ไม่ใช่ auto (เพิ่ม 29 ส.ค. 2569)
    // เหตุผล: หัวตารางต้องหนึบ (sticky) ตอนเลื่อนอ่านรายการยาว ๆ ไม่งั้นเลื่อนไปสิบแถว
    // ก็จำไม่ได้แล้วว่าเลขคอลัมน์ไหนคือ "ยอด" คอลัมน์ไหนคือ "ค้างรับ" ซึ่งเป็นตัวเลขเงินคนละความหมาย
    // แต่ overflow-x:auto บังคับให้ overflow-y กลายเป็น auto ตามสเปก = กล่องนี้กลายเป็น
    // scroll container แนวตั้ง แล้ว sticky จะยึดกับกล่องที่ไม่เคยเลื่อน = ไม่ทำงานเลยแบบเงียบ ๆ
    // ส่วน clip ไม่สร้าง scroll container จึงปล่อยให้ overflow-y เป็น visible ได้ sticky จึงทำงาน
    //
    // ปลอดภัยเพราะวัดแล้ว: ที่ความกว้าง 1024/1280/1440/1920 ตารางทุกหน้าพอดีกล่องเป๊ะ
    // (ตารางเป็น w-full หดตามกล่องอยู่แล้ว) ไม่มีหน้าไหนต้องเลื่อนแนวนอนเลยสักความกว้างเดียว
    // ต่ำกว่า lg ยังเป็น auto เหมือนเดิม เพราะช่วง 768-1023px ยังมีโอกาสต้องเลื่อน
    <div
      className="rtable overflow-x-auto lg:overflow-x-clip lg:overflow-y-visible"
      style={{
        backgroundImage:
          "linear-gradient(to right, white 30%, transparent), linear-gradient(to left, white 30%, transparent), linear-gradient(to right, rgba(16,24,40,.10), transparent 14px), linear-gradient(to left, rgba(16,24,40,.10), transparent 14px)",
        backgroundPosition: "left center, right center, left center, right center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "28px 100%, 28px 100%, 14px 100%, 14px 100%",
        backgroundAttachment: "local, local, scroll, scroll",
      }}
    >
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  // หัวตารางหนึบบนเดสก์ท็อป — เลื่อนอ่านรายการยาวแล้วยังรู้ว่าคอลัมน์ไหนคืออะไร
  // ต้องมีพื้นหลังทึบ ไม่งั้นแถวข้อมูลจะวิ่งทะลุขึ้นมาซ้อนตัวหนังสือหัวตาราง
  // มือถือไม่เกี่ยว เพราะ .rtable ซ่อน thead แล้วเปลี่ยนเป็นการ์ด (ดู globals.css)
  return <th className={cn(
    "whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400",
    "lg:sticky lg:top-0 lg:z-10 lg:bg-white",
    className)} {...props} />;
}
/**
 * ช่องข้อมูลในตาราง
 * @param label ชื่อคอลัมน์ — ใช้เฉพาะตอนแสดงเป็นการ์ดบนมือถือ (ดู .rtable ใน globals.css)
 *   เดสก์ท็อปไม่แสดงเพราะมีหัวตารางอยู่แล้ว · ไม่ใส่ก็ยังใช้ได้ แค่การ์ดจะไม่มีชื่อฟิลด์กำกับ
 */
export function Td({ label, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { label?: string }) {
  // ช่องที่ชิดขวาคือช่องตัวเลขเสมอในตารางบัญชี — บังคับ tabular-nums ให้หลักตรงกันทุกแถว
  // ไม่งั้นเลข 1 กับ 8 กว้างไม่เท่ากัน ทานยอดทีละคอลัมน์แล้วตาหลุดบรรทัด
  const isNum = (className ?? "").includes("text-right");
  return (
    <td data-label={label}
      className={cn("border-t border-neutral-100 px-4 py-3 align-middle", isNum && "tabular-nums", className)}
      {...props} />
  );
}

/**
 * หน้าจอว่าง — ไม่ได้มีไว้บอกว่า "ไม่มีข้อมูล" แต่มีไว้ "สอนงาน"
 * คนไทยที่ไม่เคยใช้โปรแกรมบัญชีจะติดตรงนี้ที่สุด: เปิดมาแล้วว่างเปล่า ไม่รู้ต้องเริ่มยังไง
 *  · icon   = ไอคอนเส้น Lucide (ไม่ใช้อิโมจิ)
 *  · steps  = 1-3 ขั้นตอนสั้นๆ ว่าหน้านี้ทำงานยังไง — ส่วนที่เปลี่ยนคนงงเป็นคนใช้เป็น
 *  · action = ปุ่มหลัก, secondary = ทางเลือกรอง (เช่น "ดูตัวอย่างข้อมูล")
 */
export function EmptyState({ title, hint, icon: Icon = Inbox, steps, action, secondary }: {
  title: string; hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  steps?: string[];
  action?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
      <span aria-hidden className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-neutral-50 text-neutral-400 ring-1 ring-inset ring-neutral-200/80">
        <Icon className="h-6 w-6" />
      </span>
      <p className="text-[15px] font-semibold text-neutral-800">{title}</p>
      {hint && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-neutral-500">{hint}</p>}

      {steps && steps.length > 0 && (
        <ol className="mt-5 w-full max-w-sm space-y-2 text-left">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-xl bg-neutral-50/80 px-3 py-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-neutral-500 ring-1 ring-neutral-200">
                {i + 1}
              </span>
              <span className="text-[12.5px] leading-relaxed text-neutral-600">{s}</span>
            </li>
          ))}
        </ol>
      )}

      {(action || secondary) && (
        <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row">
          {action && (
            <Link href={action.href}
              className={cn("inline-flex h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:scale-[0.98]", FOCUS)}>
              {action.label}<ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {secondary && (
            <Link href={secondary.href}
              className={cn("inline-flex h-11 items-center rounded-xl px-4 text-sm font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800", FOCUS)}>
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
