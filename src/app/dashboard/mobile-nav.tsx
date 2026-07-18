"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, MessageSquare, ShoppingBag, Package, Menu } from "lucide-react";
import { useState } from "react";
import { BookOpen, Share2, Settings, ShieldCheck, Wallet, Sparkles, Receipt } from "lucide-react";

const main = [
  { href: "/dashboard", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/dashboard/chats", label: "แชท", icon: MessageSquare },
  { href: "/dashboard/orders", label: "ออเดอร์", icon: ShoppingBag },
  { href: "/dashboard/products", label: "สินค้า", icon: Package },
];
const more = [
  { href: "/dashboard/playground", label: "ทดลองบอท", icon: Sparkles },
  { href: "/dashboard/slips", label: "คลังสลิป", icon: Receipt },
  { href: "/dashboard/knowledge", label: "คลังความรู้", icon: BookOpen },
  { href: "/dashboard/channels", label: "ช่องทาง", icon: Share2 },
  { href: "/dashboard/billing", label: "แพ็กเกจ/เครดิต", icon: Wallet },
  { href: "/dashboard/settings", label: "ตั้งค่า", icon: Settings },
];

export default function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (h: string) => h === "/dashboard" ? path === h : path.startsWith(h);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute bottom-16 left-3 right-3 rounded-2xl border border-neutral-200 bg-white p-2" onClick={(e) => e.stopPropagation()}>
            {[...more, ...(isAdmin ? [{ href: "/dashboard/admin", label: "ศูนย์ AI (Admin)", icon: ShieldCheck }] : [])].map((m) => (
              <Link key={m.href} href={m.href} onClick={() => setOpen(false)}
                className={cn("flex items-center gap-3 rounded-xl px-4 py-3 text-sm", active(m.href) ? "bg-emerald-50 text-emerald-700" : "text-neutral-700 hover:bg-neutral-50")}>
                <m.icon className="h-4 w-4" /> {m.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-neutral-200 bg-white/95 backdrop-blur md:hidden">
        {main.map((m) => (
          <Link key={m.href} href={m.href}
            className={cn("flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px]", active(m.href) ? "text-emerald-600" : "text-neutral-400")}>
            <m.icon className="h-5 w-5" /> {m.label}
          </Link>
        ))}
        <button onClick={() => setOpen((v) => !v)}
          className={cn("flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px]", open ? "text-emerald-600" : "text-neutral-400")}>
          <Menu className="h-5 w-5" /> เพิ่มเติม
        </button>
      </nav>
    </>
  );
}
