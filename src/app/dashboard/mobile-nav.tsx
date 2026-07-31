"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileText, Receipt, Menu, Calculator } from "lucide-react";
import { useState } from "react";
import {
  Settings, ShieldCheck, Wallet, CircleHelp, BarChart3, Landmark, Store,
  MessagesSquare, ScrollText, Package, Users, Banknote, BookOpenText, PieChart,
} from "lucide-react";

const main = [
  { href: "/dashboard", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/dashboard/assistant", label: "ผู้ช่วย AI", icon: Calculator },
  { href: "/dashboard/sales", label: "เอกสารขาย", icon: FileText },
  { href: "/dashboard/expenses", label: "ค่าใช้จ่าย", icon: Receipt },
];
const more = [
  { href: "/dashboard/money", label: "การเงิน/กระทบยอด", icon: Banknote },
  { href: "/dashboard/contacts", label: "ผู้ติดต่อ", icon: Users },
  { href: "/dashboard/products", label: "สินค้า/บริการ", icon: Package },
  { href: "/dashboard/journal", label: "สมุดรายวัน", icon: BookOpenText },
  { href: "/dashboard/reports", label: "รายงาน + ภาษี", icon: PieChart },
  { href: "/dashboard/billing", label: "แพ็กเกจ/เครดิต", icon: Wallet },
  { href: "/dashboard/settings", label: "ตั้งค่า", icon: Settings },
  { href: "/dashboard/help", label: "คู่มือใช้งาน", icon: CircleHelp },
];

export default function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (h: string) => h === "/dashboard" ? path === h : path.startsWith(h);
  // อยู่หน้าที่ซ่อนอยู่ใน "เพิ่มเติม" ก็ต้องเห็นว่าแท็บนั้น active ไม่ใช่ลอยไม่มีที่ยืน
  const moreActive = !main.some((m) => active(m.href));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute bottom-16 left-3 right-3 max-h-[65vh] overflow-y-auto overscroll-contain rounded-2xl border border-neutral-200 bg-white p-2" onClick={(e) => e.stopPropagation()}>
            {[...more, ...(isAdmin ? [
              { href: "/dashboard/admin", label: "ศูนย์ AI (Admin)", icon: ShieldCheck },
              { href: "/dashboard/admin/stats", label: "แดชบอร์ดแพลตฟอร์ม", icon: BarChart3 },
              { href: "/dashboard/admin/billing", label: "รายได้ + บัญชีรับเงิน", icon: Landmark },
              { href: "/dashboard/admin/shops", label: "จัดการผู้ใช้ระบบ", icon: Store },
              { href: "/dashboard/admin/feedback", label: "ความเห็นผู้ใช้", icon: MessagesSquare },
              { href: "/dashboard/admin/logs", label: "Audit Log", icon: ScrollText },
            ] : [])].map((m) => (
              <Link key={m.href} href={m.href} onClick={() => setOpen(false)}
                className={cn("flex items-center gap-3 rounded-xl px-4 py-3 text-sm", active(m.href) ? "bg-emerald-50 text-emerald-700" : "text-neutral-700 hover:bg-neutral-50")}>
                <m.icon className="h-4 w-4" /> {m.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <nav data-bottom-nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {main.map((m) => {
          const on = active(m.href);
          return (
            <Link key={m.href} href={m.href} aria-current={on ? "page" : undefined}
              className={cn("relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px]",
                on ? "font-semibold text-emerald-600" : "text-neutral-400")}>
              {/* ขีดบนหัว = รู้ทันทีว่าอยู่แท็บไหน แม้มองแวบเดียว */}
              {on && <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-emerald-500" />}
              <m.icon className={cn("h-5 w-5", on && "fill-emerald-50")} /> {m.label}
            </Link>
          );
        })}
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className={cn("relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px]",
            open || moreActive ? "font-semibold text-emerald-600" : "text-neutral-400")}>
          {(open || moreActive) && <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-emerald-500" />}
          <Menu className="h-5 w-5" /> เพิ่มเติม
        </button>
      </nav>
    </>
  );
}
