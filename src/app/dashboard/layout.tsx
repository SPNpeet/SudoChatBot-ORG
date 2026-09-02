import Link from "next/link";
import { getCurrentShop, isPlatformAdmin } from "@/lib/shop";
import SideNav from "./side-nav";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MobileNav from "./mobile-nav";
import { NavShell, MainArea } from "./nav-shell";
import { SidebarHead, SidebarFoot } from "./sidebar-parts";
import { ToastProvider } from "@/components/toast";
import FailureNet from "./failure-net";
import CommandPalette from "./command-palette";
import SystemInbox from "./system-inbox";
import { getNotices, type Notice, type QuotaLike } from "@/lib/notices";
import FeedbackWidget from "./feedback-widget";
import QuickCreate from "./quick-create";
import CompanySwitcher from "./company-switcher";
import { type AiQuota } from "./ai-quota-bar";
import AccountMenu, { type Me } from "./account-menu";
import { Logo } from "@/components/logo";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [{ supabase, shop, memberships, user, role }, isAdmin] = await Promise.all([getCurrentShop(), isPlatformAdmin()]);
  const companies = memberships.map((m) => ({ id: m.shop.id, name: m.shop.name, role: m.role }));
  const [{ data: quota }, { data: prof }] = await Promise.all([
    supabase.rpc("get_ai_quota_status", { p_shop_id: shop.id }),
    supabase.from("profiles").select("display_name,email").eq("id", user.id).maybeSingle(),
  ]);

  // ⚠️ ห้ามให้กล่องจดหมายล้มทั้ง layout
  // ไฟล์นี้หุ้มทุกหน้าใน dashboard ถ้า getNotices โยน error ขึ้นมา
  // ผู้ใช้จะเข้าระบบไม่ได้เลยทั้งระบบ แลกกับข้อความแจ้งเตือนไม่กี่บรรทัด — ไม่คุ้ม
  //
  // ⚠️ ล้มแล้วต้อง "บอกว่าล้ม" ไม่ใช่เงียบเป็นกระดิ่งว่าง
  // ตั้งแต่ยกแถบเตือนออกจากหน้าภาพรวมหมดแล้ว กระดิ่งคือที่เดียวที่คำเตือนอยู่
  // ถ้าล้มแล้วเงียบ ผู้ใช้จะอ่านว่า "ไม่มีเรื่องค้าง" ทั้งที่ระบบตรวจไม่ได้ต่างหาก
  // ซึ่งอันตรายกว่าคำเตือนรก เพราะเป็นการโกหกแบบที่ไม่มีใครรู้
  // ส่ง quota ที่ดึงไว้แล้วเข้าไปด้วย ไม่ให้ยิง RPC ซ้ำ — layout นี้รันทุกหน้า
  const notices: Notice[] = await getNotices(shop.id, quota as QuotaLike | null).then((r) => r.notices).catch(() => [{
    key: "notices:unavailable",
    tone: "warn" as const,
    title: "ตรวจสถานะระบบไม่สำเร็จชั่วคราว",
    body: "กล่องจดหมายอ่านข้อมูลไม่ได้รอบนี้ จึงยังบอกไม่ได้ว่ามีเรื่องค้างหรือไม่ "
      + "ถ้าใกล้กำหนดยื่นภาษี ให้เปิดหน้ารายงานตรวจเองอีกครั้ง",
    href: "/dashboard/reports", cta: "ไปหน้ารายงาน",
  }]);

  // อีเมลยึดจาก auth เป็นหลัก — แถว profiles อาจตกหล่นได้ถ้า trigger ตอนสมัครพลาด
  // แต่ตัวตนที่ใช้ล็อกอินจริงอยู่ที่ auth เสมอ ตรงนี้ผิดไม่ได้เพราะคือสิ่งที่ผู้ใช้ใช้ยืนยันตัวเอง
  const me: Me = {
    name: prof?.display_name ?? (user.user_metadata?.full_name as string | undefined) ?? null,
    email: user.email ?? prof?.email ?? null,
    role,
    shopName: shop.name,
  };

  return (
    <ToastProvider>
      <FailureNet />
    <NavShell>
    {/* พื้นเทาอ่อนทั้งแคนวาส — เดิมขาวชนขาว การ์ดกับพื้นแยกไม่ออก เจ้าของอ่านว่า "จืด"
        เงาอ่อน ๆ บนการ์ดทำงานได้ก็ต่อเมื่อพื้นหลังเข้มกว่าการ์ดสักหนึ่งขั้น */}
    <div className="min-h-screen bg-neutral-100/60">
      {/* Sidebar — เดสก์ท็อป (พับได้ SideNav คุมความกว้างเอง) */}
      {/* ส่งได้เฉพาะข้อมูลที่ serialize ได้ (boolean / object ธรรมดา / server action / JSX)
          รายการเมนูพร้อมไอคอนอยู่ใน side-nav.tsx ฝั่ง client แล้ว ห้ามย้ายกลับมาที่นี่ */}
      <SideNav isAdmin={!!isAdmin}
        foot={<SidebarFoot quota={quota as AiQuota | null} planCode={shop.plan} me={me} signOut={signOut} />}>
        <SidebarHead companies={companies} currentId={shop.id} shopId={shop.id} notices={notices} />
      </SideNav>

      {/* Header — มือถือ
          บนมือถือไม่มีแถบเมนูซ้าย ถ้าไม่วางรูปบัญชีไว้ตรงนี้ จะไม่เหลือที่ไหน
          ให้ผู้ใช้เช็คเลยว่ากำลังล็อกอินด้วยบัญชีไหน (มือถือคือเครื่องที่คนสลับบัญชีบ่อยที่สุด) */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        {/* จอแคบเหลือแค่โลโก้ ไม่เอาตัวอักษร — คืนพื้นที่ ~105px ให้ชื่อกิจการ
            บนจอ 360px ถ้าโชว์ตัวอักษรด้วย ชื่อกิจการจะเหลือที่แค่ 8 ตัวอักษร
            "ตอนนี้ทำบัญชีของบริษัทไหน" สำคัญกว่าการเห็นชื่อแบรนด์ตัวเองซ้ำทุกหน้า */}
        <Link href="/dashboard" aria-label="กลับหน้าภาพรวม" className="shrink-0 rounded-lg transition-opacity active:opacity-60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="SudoChatBot" width={28} height={28} className="h-7 w-7 rounded-lg object-cover sm:hidden" />
          <Logo className="hidden sm:inline-flex" />
        </Link>
        <div className="min-w-0 flex-1">
          <CompanySwitcher companies={companies} currentId={shop.id} />
        </div>
        <SystemInbox shopId={shop.id} notices={notices} variant="icon" />
        <AccountMenu me={me} signOut={signOut} variant="icon" />
      </header>

      {/* เนื้อหา — pb มือถือ = bottom nav + ปุ่มลอย ปุ่มแถวล่างสุดต้องกดได้เสมอ
          ⚠️ ห้ามเอาแบนเนอร์แจ้งเตือนกลับมาไว้ที่นี่
          เดิมมี 3 กล่อง (ประกาศระบบ · อัตรา VAT · แจ้งเตือน) วางไว้ตรงนี้
          ผลคือเปิดหน้าไหนก็เจอ กินที่บนสุดของทุกหน้าตลอดเวลา
          เจ้าของใช้คำว่า "รกจัด ๆ" ซึ่งถูก — คำเตือนที่เห็นทุกวันคือคำเตือนที่ตาชา
          รอบ 1 ย้ายไปหน้าภาพรวม · รอบ 2 ยกเข้ากล่องจดหมายระบบ (กระดิ่ง) แล้วทั้งหมด
          ตอนนี้ไม่มีแถบเตือนอยู่ทั้ง layout และหน้าภาพรวม — ดู src/lib/notices.ts */}
      <MainArea>{children}</MainArea>

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
