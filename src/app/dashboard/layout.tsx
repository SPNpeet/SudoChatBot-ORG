import Link from "next/link";
import { getCurrentShop, isPlatformAdmin } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  LayoutDashboard, Package, Settings, LogOut, ShieldCheck, Wallet, Receipt, CircleHelp,
  BarChart3, Landmark, Store, MessagesSquare, ScrollText, Calculator, FileText,
  Users, Banknote, BookOpenText, PieChart,
} from "lucide-react";
import MobileNav from "./mobile-nav";
import Notifications from "./notifications";
import FeedbackWidget from "./feedback-widget";
import CompanySwitcher from "./company-switcher";
import AiQuotaBar, { type AiQuota } from "./ai-quota-bar";
import { Logo } from "@/components/logo";

const nav = [
  { href: "/dashboard", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/dashboard/assistant", label: "ผู้ช่วยบัญชี AI", icon: Calculator },
  { href: "/dashboard/sales", label: "เอกสารขาย", icon: FileText },
  { href: "/dashboard/expenses", label: "ค่าใช้จ่าย", icon: Receipt },
  { href: "/dashboard/money", label: "การเงิน/กระทบยอด", icon: Banknote },
  { href: "/dashboard/contacts", label: "ผู้ติดต่อ", icon: Users },
  { href: "/dashboard/products", label: "สินค้า/บริการ", icon: Package },
  { href: "/dashboard/journal", label: "สมุดรายวัน", icon: BookOpenText },
  { href: "/dashboard/reports", label: "รายงาน + ภาษี", icon: PieChart },
  { href: "/dashboard/billing", label: "แพ็กเกจ/เครดิต", icon: Wallet },
  { href: "/dashboard/settings", label: "ตั้งค่า", icon: Settings },
  { href: "/dashboard/help", label: "คู่มือใช้งาน", icon: CircleHelp },
];

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [{ supabase, shop, memberships }, isAdmin] = await Promise.all([getCurrentShop(), isPlatformAdmin()]);
  const companies = memberships.map((m) => ({ id: m.shop.id, name: m.shop.name, role: m.role }));
  const { data: quota } = await supabase.rpc("get_ai_quota_status", { p_shop_id: shop.id });

  return (
    <div className="min-h-screen">
      {/* Sidebar — เดสก์ท็อป */}
      <aside className="fixed inset-y-0 z-30 hidden w-56 flex-col border-r border-neutral-200 bg-white md:flex">
        <div className="px-4 py-4">
          <div className="px-1"><Logo /></div>
          <div className="mt-3">
            <CompanySwitcher companies={companies} currentId={shop.id} />
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {nav.map((item) => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900">
              <item.icon className="h-4 w-4" />{item.label}
            </Link>
          ))}
          {isAdmin && (
            <>
              <Link href="/dashboard/admin"
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50">
                <ShieldCheck className="h-4 w-4" /> ศูนย์ AI (Admin)
              </Link>
              <Link href="/dashboard/admin/stats"
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50">
                <BarChart3 className="h-4 w-4" /> แดชบอร์ดแพลตฟอร์ม
              </Link>
              <Link href="/dashboard/admin/billing"
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50">
                <Landmark className="h-4 w-4" /> รายได้ + บัญชีรับเงิน
              </Link>
              <Link href="/dashboard/admin/shops"
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50">
                <Store className="h-4 w-4" /> จัดการผู้ใช้ระบบ
              </Link>
              <Link href="/dashboard/admin/feedback"
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50">
                <MessagesSquare className="h-4 w-4" /> ความเห็นผู้ใช้
              </Link>
              <Link href="/dashboard/admin/logs"
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50">
                <ScrollText className="h-4 w-4" /> Audit Log
              </Link>
            </>
          )}
        </nav>
        <div className="border-t border-neutral-100 px-2 pt-2">
          <AiQuotaBar quota={quota as AiQuota | null} />
        </div>
        <form action={signOut} className="p-3 pt-1">
          <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">
            <LogOut className="h-4 w-4" /> ออกจากระบบ
          </button>
        </form>
      </aside>

      {/* Header — มือถือ */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <div className="w-44">
          <CompanySwitcher companies={companies} currentId={shop.id} />
        </div>
      </header>

      {/* เนื้อหา */}
      <main className="px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:ml-56 md:px-8 md:py-7 md:pb-7">
        <Notifications />
        {children}
      </main>

      {/* Bottom nav — มือถือ */}
      <MobileNav isAdmin={!!isAdmin} />

      {/* ปุ่มแนะนำ/ติชม — เสียงผู้ใช้ตรงถึงเจ้าของแพลตฟอร์ม */}
      <FeedbackWidget shopId={shop.id} />
    </div>
  );
}
