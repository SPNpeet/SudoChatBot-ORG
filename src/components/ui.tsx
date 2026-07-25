import { cn } from "@/lib/utils";
import Link from "next/link";
import * as React from "react";

// ============================================================
//  ระบบดีไซน์กลาง — แก้ที่นี่ที่เดียว หน้าตาทั้งแอปเปลี่ยนตาม
//  แนวทาง: ขาวสะอาด เงานุ่มบางๆ ขอบมนสม่ำเสมอ สีเขียวแบรนด์ใช้เฉพาะจุดสำคัญ
//  ทุกอย่างที่กดได้ต้องมี hover/active/focus-visible ชัดเจน (ใช้บนมือถือก็รู้ว่ากดติด)
// ============================================================

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1";

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
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

/** การ์ดตัวเลขสรุป — ใช้บนแดชบอร์ด ให้ทุกหน้าหน้าตาเดียวกัน */
export function StatCard({ label, value, hint, icon, tone = "neutral", className }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode;
  tone?: "neutral" | "green" | "amber" | "red"; className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        {icon && (
          <span className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-xl",
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
      {hint && <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>}
    </Card>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "brand" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};
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
        ? <p className="mt-1 text-[11px] text-red-600">{error}</p>
        : hint ? <p className="mt-1 text-[11px] text-neutral-400">{hint}</p> : null}
    </div>
  );
}

export function Badge({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "green" | "amber" | "red" | "blue" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
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

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400", className)} {...props} />;
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-t border-neutral-100 px-4 py-3 align-middle", className)} {...props} />;
}

export function EmptyState({ title, hint, icon = "🗂️", action }: {
  title: string; hint?: string; icon?: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <span className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-b from-neutral-50 to-neutral-100 text-2xl ring-1 ring-neutral-200/70" aria-hidden>
        {icon}
      </span>
      <p className="text-sm font-semibold text-neutral-700">{title}</p>
      {hint && <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-neutral-400">{hint}</p>}
      {action && (
        <Link href={action.href}
          className={cn("mt-5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:scale-[0.98]", FOCUS)}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
