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
import {
  PanelLeftClose, PanelLeftOpen, LayoutDashboard, Calculator, FileText, Receipt,
  Banknote, Users, Package, BookOpenText, PieChart, Wallet, Settings, CircleHelp,
  ShieldCheck, type LucideIcon, Boxes,
} from "lucide-react";
import { useNav } from "./nav-shell";
import { navHiddenFor } from "@/lib/roles";

export interface NavItem { href: string; label: string; icon: LucideIcon }

// ⚠️ รายการเมนูต้องอยู่ในไฟล์นี้ (ฝั่ง client) ห้ามส่งมาจาก layout ที่เป็น Server Component
// เพราะ icon เป็นฟังก์ชัน React ซึ่ง React ส่งข้ามเส้น server -> client ไม่ได้
// เคยพลาดตรงนี้มาแล้ว: build ผ่านแต่หน้าภาพรวมพังทั้งหน้าตอนรันจริง
// (หน้านี้เป็น force-dynamic จึงไม่ถูก render ตอน build ทำให้ไม่มีใครจับได้)
// ============================================================
//  จัดกลุ่มเมนูตามงานจริง (แก้ 30 ส.ค. 2569 ตามภาพอ้างอิงของเจ้าของ)
//  เดิมเป็นลิสต์แบน 13 รายการ — กวาดตาหารายการที่ต้องการต้องอ่านทีละบรรทัด
//  จัดเป็น 4 กลุ่มให้กวาดข้ามทั้งกลุ่มได้ (คนหา "รายงาน" ไม่ต้องอ่านชื่อเอกสารทุกตัว)
//  ⚠️ href ทุกตัวคงเดิม — จัดกลุ่มคือเรื่องหน้าตา ไม่ใช่เรื่องเส้นทาง
// ============================================================
interface NavSection { title: string | null; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  { title: null, items: [
    { href: "/dashboard", label: "ภาพรวม", icon: LayoutDashboard },
    { href: "/dashboard/assistant", label: "ผู้ช่วยบัญชี AI", icon: Calculator },
  ]},
  { title: "งานขายและเอกสาร", items: [
    { href: "/dashboard/sales", label: "เอกสารขาย", icon: FileText },
    { href: "/dashboard/expenses", label: "ค่าใช้จ่าย", icon: Receipt },
    { href: "/dashboard/contacts", label: "ผู้ติดต่อ", icon: Users },
    { href: "/dashboard/products", label: "สินค้าและบริการ", icon: Package },
  ]},
  { title: "เงินและบัญชี", items: [
    { href: "/dashboard/money", label: "การเงินและกระทบยอด", icon: Banknote },
    { href: "/dashboard/journal", label: "สมุดรายวัน", icon: BookOpenText },
    { href: "/dashboard/assets", label: "ทรัพย์สินและปิดงวด", icon: Boxes },
    { href: "/dashboard/reports", label: "รายงานและภาษี", icon: PieChart },
  ]},
  { title: "ระบบ", items: [
    { href: "/dashboard/billing", label: "แพ็กเกจและเครดิต", icon: Wallet },
    { href: "/dashboard/settings", label: "ตั้งค่า", icon: Settings },
    { href: "/dashboard/help", label: "คู่มือใช้งาน", icon: CircleHelp },
  ]},
];

// ⚠️ โซนผู้ดูแลแพลตฟอร์มแยกออกไปมี layout ของตัวเองแล้ว (คำสั่งเจ้าของ 30 ส.ค. 2569:
// "ระบบ admin ต้องแยกออกมาให้ชัดเจนเป็นของมันเฉพาะ") — เมนูร้านจึงเหลือ "ทางเข้า" เดียว
// รายการย่อยทั้งหมดอยู่ในแถบนำทางของโซน admin เอง (ดู admin/layout.tsx)
const ADMIN_ENTRY: NavItem = { href: "/dashboard/admin", label: "ศูนย์ผู้ดูแลแพลตฟอร์ม", icon: ShieldCheck };

/** หน้าไหน active — /dashboard ต้อง exact ไม่งั้นจะสว่างค้างทุกหน้า */
export function isActive(path: string, href: string) {
  return href === "/dashboard" ? path === href : path.startsWith(href);
}

export default function SideNav({ isAdmin, role = "owner", children, foot }: {
  isAdmin: boolean; role?: string; children?: React.ReactNode; foot?: React.ReactNode;
}) {
  const hidden = navHiddenFor(role);
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

      {/* ⚠️ ปุ่มพับเมนูต้องอยู่บน ไม่ใช่ล่างสุด
        เจ้าของเจอจริง (3 ส.ค. 2569): "พับเมนูมันอยู่ล่างกดยากมาก"
        เมนูยาวกว่าจอ ปุ่มที่อยู่ล่างสุดของ <aside> จึงต้องเลื่อนหาก่อนถึงจะกดได้
        ย้ายมาไว้เหนือรายการเมนู = เห็นและกดได้ทันทีเสมอ ไม่ว่าเมนูจะยาวแค่ไหน */}

      <button type="button" onClick={toggle}
        aria-label={collapsed ? "ขยายเมนู" : "พับเมนู"} aria-expanded={!collapsed}
        title={collapsed ? "ขยายเมนู" : "พับเมนู"}
        className={cn(
          "mx-2 mb-1 flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-xs text-neutral-400",
          "transition-colors hover:bg-neutral-100 hover:text-neutral-700",
          collapsed && "justify-center px-0",
        )}>
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" />พับเมนู</>}
      </button>

      {/* min-h-0 จำเป็น — วัดจริง 5 ก.ย. 2569 จอ 1440x900: "ตั้งค่า" กับ "คู่มือใช้งาน" หายไปเฉย ๆ ไม่มี scrollbar
          เพราะ flex child ค่าเริ่มต้น min-height:auto ไม่ยอมหดต่ำกว่าเนื้อหา overflow-y-auto จึงไม่เคยทำงาน */}
      <nav className={cn("min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-visible", collapsed ? "px-2" : "px-3")}>
        {NAV_SECTIONS.map((sec, si) => (
          <div key={si}>
            {sec.title && (collapsed
              ? <div className="my-2 border-t border-neutral-100" />
              : <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{sec.title}</p>)}
            <div className="space-y-0.5">{sec.items.filter((i) => !hidden.includes(i.href)).map((i) => row(i))}</div>
          </div>
        ))}
        {isAdmin && (
          <div>
            {collapsed
              ? <div className="my-2 border-t border-neutral-100" />
              : <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">ผู้ดูแล</p>}
            {row(ADMIN_ENTRY, true)}
          </div>
        )}
      </nav>

      {foot}
    </aside>
  );
}
