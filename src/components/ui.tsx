import { cn } from "@/lib/utils";
import Link from "next/link";
import * as React from "react";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-neutral-200 bg-white", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pt-4 pb-2", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-neutral-900", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
};
export function Button({ className, variant = "primary", size = "md", ...props }: BtnProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all duration-100 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-neutral-900 text-white hover:bg-neutral-700",
        variant === "outline" && "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50",
        variant === "ghost" && "text-neutral-600 hover:bg-neutral-100",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-500",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        // text-base (16px) กัน iOS Safari auto-zoom ตอนโฟกัส input ที่ font-size < 16px
        "h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base outline-none sm:text-sm",
        "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 placeholder:text-neutral-400",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base outline-none min-h-24 sm:text-sm",
        "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 placeholder:text-neutral-400",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base outline-none focus:border-emerald-500 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-medium text-neutral-600", className)} {...props} />;
}

export function Badge({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "green" | "amber" | "red" | "blue" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "neutral" && "bg-neutral-100 text-neutral-600",
        tone === "green" && "bg-emerald-50 text-emerald-700",
        tone === "amber" && "bg-amber-50 text-amber-700",
        tone === "red" && "bg-red-50 text-red-700",
        tone === "blue" && "bg-sky-50 text-sky-700",
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
  return <th className={cn("px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400", className)} {...props} />;
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-t border-neutral-100 px-4 py-3 align-middle", className)} {...props} />;
}

export function EmptyState({ title, hint, icon = "🗂️", action }: {
  title: string; hint?: string; icon?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <span className="mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-neutral-50 text-2xl" aria-hidden>{icon}</span>
      <p className="text-sm font-medium text-neutral-500">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-neutral-400">{hint}</p>}
      {action && (
        <Link href={action.href}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
          {action.label}
        </Link>
      )}
    </div>
  );
}
