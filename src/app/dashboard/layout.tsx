import Link from "next/link";
import { getCurrentShop, isPlatformAdmin } from "@/lib/shop";
import SideNav from "./side-nav";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  LayoutDashboard, Package, Settings, LogOut, ShieldCheck, Wallet, Receipt, CircleHelp,
  BarChart3, Landmark, Store, MessagesSquare, ScrollText, Calculator, FileText,
  Users, Banknote, BookOpenText, PieChart,
} from "lucide-react";
import MobileNav from "./mobile-nav";
import { NavShell, MainArea } from "./nav-shell";
import { SidebarHead, SidebarFoot } from "./sidebar-parts";
import { ToastProvider } from "@/components/toast";
import CommandPalette from "./command-palette";
import Notifications from "./notifications";
import SystemAlertBanner from "./system-alert-banner";
import FeedbackWidget from "./feedback-widget";
import QuickCreate from "./quick-create";
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

const ADMIN_NAV = [
  { href: "/dashboard/admin", label: "ศูนย์ AI (Admin)", icon: ShieldCheck },
  { href: "/dashboard/admin/stats", label: "แดชบอร์ดแพลตฟอร์ม", icon: BarChart3 },
  { href: "/dashboard/admin/billing", label: "รายได้ + บัญชีรับเงิน", icon: Landmark },
  { href: "/dashboard/admin/shops", label: "จัดการผู้ใช้ระบบ", icon: Store },
  { href: "/dashboard/admin/feedback", label: "ความเห็นผู้ใช้", icon: MessagesSquare },
  { href: "/dashboard/admin/logs", label: "Audit Log", icon: ScrollText },
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
    <ToastProvider>
    <NavShell>
    <div className="min-h-screen">
      {/* Sidebar — เดสก์ท็อป (พับได้ SideNav คุมความกว้างเอง) */}
      <SideNav items={nav} adminItems={isAdmin ? ADMIN_NAV : []}
        foot={<SidebarFoot quota={quota as AiQuota | null} signOut={signOut} />}>
        <SidebarHead companies={companies} currentId={shop.id} />
      </SideNav>

      {/* Header — มือถือ */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/dashboard" aria-label="กลับหน้าภาพรวม" className="shrink-0 rounded-lg transition-opacity active:opacity-60">
          <Logo />
        </Link>
        <div className="w-44">
          <CompanySwitcher companies={companies} currentId={shop.id} />
        </div>
      </header>

      {/* เนื้อหา — pb มือถือ = bottom nav + ปุ่มลอย ปุ่มแถวล่างสุดต้องกดได้เสมอ */}
      <MainArea>
        <SystemAlertBanner />
        <Notifications />
        {children}
      </MainArea>

      {/* ค้นหาทุกอย่างด้วย Ctrl+K — ทางลัดที่ทำให้คนใช้คล่องขึ้นเร็วที่สุด */}
      <CommandPalette shopId={shop.id} />

      {/* Bottom nav — มือถือ */}
      <MobileNav isAdmin={!!isAdmin} />

      {/* ปุ่ม + สร้างงานที่ทำบ่อย จากทุกหน้า */}
      <QuickCreate />

      {/* ปุ่มแนะนำ/ติชม — เสียงผู้ใช้ตรงถึงเจ้าของแพลตฟอร์ม */}
      <FeedbackWidget shopId={shop.id} />
    </div>
    </NavShell>
    </ToastProvider>
  );
}
