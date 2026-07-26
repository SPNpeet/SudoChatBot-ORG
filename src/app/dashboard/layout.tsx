import Link from "next/link";
import { getCurrentShop, isPlatformAdmin } from "@/lib/shop";
import SideNav from "./side-nav";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MobileNav from "./mobile-nav";
import { NavShell, MainArea } from "./nav-shell";
import { SidebarHead, SidebarFoot } from "./sidebar-parts";
import { ToastProvider } from "@/components/toast";
import CommandPalette from "./command-palette";
import Notifications from "./notifications";
import SystemAlertBanner from "./system-alert-banner";
import VatRateAlert from "./vat-rate-alert";
import FeedbackWidget from "./feedback-widget";
import QuickCreate from "./quick-create";
import CompanySwitcher from "./company-switcher";
import { type AiQuota } from "./ai-quota-bar";
import { Logo } from "@/components/logo";

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
      {/* ส่งได้เฉพาะข้อมูลที่ serialize ได้ (boolean / object ธรรมดา / server action / JSX)
          รายการเมนูพร้อมไอคอนอยู่ใน side-nav.tsx ฝั่ง client แล้ว ห้ามย้ายกลับมาที่นี่ */}
      <SideNav isAdmin={!!isAdmin}
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
        {/* แบนเนอร์แจ้งเตือนเป็นของหน้าจอ ไม่ใช่ของเอกสาร
            หน้าพิมพ์ใบกำกับภาษีอยู่ใต้ layout นี้ด้วย ถ้าไม่กัน จะมีข้อความเตือน
            ไปโผล่บนใบกำกับภาษีที่ส่งให้ลูกค้าและกรมสรรพากร */}
        <div data-noprint>
          <SystemAlertBanner />
          <VatRateAlert />
          <Notifications />
        </div>
        {children}
      </MainArea>

      {/* ปุ่มลอยทั้งหมด — ต้องไม่ติดไปกับกระดาษ (globals.css ซ่อน [data-noprint] ตอนพิมพ์) */}
      <div data-noprint>
        {/* ค้นหาทุกอย่างด้วย Ctrl+K — ทางลัดที่ทำให้คนใช้คล่องขึ้นเร็วที่สุด */}
        <CommandPalette shopId={shop.id} />

        {/* Bottom nav — มือถือ */}
        <MobileNav isAdmin={!!isAdmin} />

        {/* ปุ่ม + สร้างงานที่ทำบ่อย จากทุกหน้า */}
        <QuickCreate />

        {/* ปุ่มแนะนำ/ติชม — เสียงผู้ใช้ตรงถึงเจ้าของแพลตฟอร์ม */}
        <FeedbackWidget shopId={shop.id} />
      </div>
    </div>
    </NavShell>
    </ToastProvider>
  );
}
