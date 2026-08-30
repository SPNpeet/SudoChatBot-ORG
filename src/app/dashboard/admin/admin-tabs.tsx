"use client";
// แถบนำทางของโซนผู้ดูแล — รายการย่อยทั้งหมดของ admin อยู่ที่นี่ที่เดียว
// (เมนูร้านเหลือทางเข้า "ศูนย์ผู้ดูแลแพลตฟอร์ม" ทางเดียว — ดู side-nav.tsx)
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/admin", label: "ศูนย์ AI" },
  { href: "/dashboard/admin/stats", label: "สถิติแพลตฟอร์ม" },
  { href: "/dashboard/admin/billing", label: "รายได้ + บัญชีรับเงิน" },
  { href: "/dashboard/admin/shops", label: "ผู้ใช้ระบบ" },
  { href: "/dashboard/admin/feedback", label: "ความเห็นผู้ใช้" },
  { href: "/dashboard/admin/tax-kb", label: "คลังความรู้ภาษี" },
  { href: "/dashboard/admin/logs", label: "Audit Log" },
];

export default function AdminTabs() {
  const path = usePathname();
  return (
    // แถวเดียวเลื่อนแนวนอนได้ ห้ามตกบรรทัด — เหตุผลเดียวกับ .tabstrip ของหน้ารายงาน
    <nav className="flex gap-1 overflow-x-auto border-t border-neutral-800 px-3 py-2 [scrollbar-width:none]">
      {TABS.map((t) => {
        const active = t.href === "/dashboard/admin" ? path === t.href : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "bg-white text-neutral-900" : "text-neutral-400 hover:bg-neutral-800 hover:text-white",
            )}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
