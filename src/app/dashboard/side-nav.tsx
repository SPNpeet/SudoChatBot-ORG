"use client";
// ============================================================
//  เมนูข้าง (เดสก์ท็อป) — ต้องรู้ทันทีว่า "ตอนนี้อยู่หน้าไหน"
//  ผู้ใช้บอกว่ากดแล้วไม่รู้ว่าอยู่ตรงไหน = หลงทาง เป็นปัญหาที่เจอทุกวินาทีของการใช้งาน
//  ใช้แถบซ้าย + พื้นอ่อน + ตัวหนา (ไม่ใช้เงา เพราะธีม minimal เน้นเรียบ)
//
//  พับได้ด้วยปุ่มแฮมเบอร์เกอร์ — จอ 13" ทำงานกับตารางเงินยาวๆ ได้พื้นที่คืนอีก 12rem
//  จำสถานะไว้ใน localStorage จะได้ไม่ต้องพับใหม่ทุกครั้งที่เปิดเว็บ
// ============================================================
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import { useNav } from "./nav-shell";

export interface NavItem { href: string; label: string; icon: LucideIcon }

/** หน้าไหน active — /dashboard ต้อง exact ไม่งั้นจะสว่างค้างทุกหน้า */
export function isActive(path: string, href: string) {
  return href === "/dashboard" ? path === href : path.startsWith(href);
}

export default function SideNav({ items, adminItems, children, foot }: {
  items: NavItem[]; adminItems: NavItem[]; children?: React.ReactNode; foot?: React.ReactNode;
}) {
  const path = usePathname();
  const { collapsed, toggle, ready } = useNav();

  const row = (item: NavItem, admin = false) => {
    const active = isActive(path, item.href);
    return (
      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          "group relative flex items-center rounded-xl text-sm transition-colors",
          collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2",
          active
            ? "bg-emerald-50 font-semibold text-emerald-800"
            : admin
              ? "text-emerald-700 hover:bg-emerald-50/60"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
        )}>
        {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-emerald-600" />}
        <item.icon className={cn("h-4 w-4 shrink-0", active && "text-emerald-600")} />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {/* พับอยู่ให้ hover แล้วโผล่ชื่อ — จะได้ไม่ต้องจำว่าไอคอนไหนคืออะไร */}
        {collapsed && (
          <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-lg bg-neutral-900 px-2 py-1 text-xs text-white group-hover:block">
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className={cn(
      "fixed inset-y-0 z-30 hidden flex-col border-r border-neutral-200 bg-white md:flex",
      "transition-[width] duration-200 ease-out motion-reduce:transition-none",
      collapsed ? "w-16" : "w-56",
      !ready && "invisible",           // กันเห็นเมนูกระตุกตอนอ่านค่าที่จำไว้
    )}>
      {children}

      <nav className={cn("flex-1 space-y-0.5 overflow-y-auto overflow-x-visible", collapsed ? "px-2" : "px-3")}>
        {items.map((i) => row(i))}
        {adminItems.length > 0 && (
          <>
            {collapsed
              ? <div className="my-2 border-t border-neutral-100" />
              : <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">ผู้ดูแลแพลตฟอร์ม</p>}
            {adminItems.map((i) => row(i, true))}
          </>
        )}
      </nav>

      <button type="button" onClick={toggle}
        aria-label={collapsed ? "ขยายเมนู" : "พับเมนู"} aria-expanded={!collapsed}
        className={cn(
          "mx-2 mb-1 mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-neutral-400",
          "transition-colors hover:bg-neutral-100 hover:text-neutral-700",
          collapsed && "justify-center px-0",
        )}>
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" />พับเมนู</>}
      </button>

      {foot}
    </aside>
  );
}
