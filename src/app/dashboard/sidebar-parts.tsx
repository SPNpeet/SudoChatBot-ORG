"use client";
// หัวและท้ายของแถบเมนู — ต้องรู้ว่ากำลังพับอยู่ไหม เพื่อย่อ/ซ่อนของที่ไม่จำเป็น
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useNav } from "./nav-shell";
import { Logo } from "@/components/logo";
import CompanySwitcher from "./company-switcher";
import AiQuotaBar, { type AiQuota } from "./ai-quota-bar";
import AccountMenu, { type Me } from "./account-menu";

export function SidebarHead({ companies, currentId }: {
  companies: { id: string; name: string; role: string }[]; currentId: string;
}) {
  const { collapsed } = useNav();
  return (
    <div className={cn("py-4", collapsed ? "px-2" : "px-4")}>
      {/* โลโก้/ชื่อ = ทางกลับหน้าภาพรวมเสมอ (ผู้ใช้คาดหวังแบบนี้จากทุกเว็บ) */}
      <Link href="/dashboard" title="กลับหน้าภาพรวม"
        className={cn("block rounded-lg py-0.5 transition-opacity hover:opacity-70", collapsed ? "flex justify-center" : "px-1")}>
        {collapsed
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src="/logo-mark.png" alt="SudoChatBot" width={28} height={28} className="h-7 w-7 rounded-lg object-cover" />
          : <Logo />}
      </Link>
      {!collapsed && (
        <div className="mt-3">
          <CompanySwitcher companies={companies} currentId={currentId} />
        </div>
      )}
    </div>
  );
}

/**
 * ท้ายแถบเมนู = ที่ที่ผู้ใช้มองหา "บัญชีของฉัน" อยู่แล้วจากเว็บอื่นทั้งหมด
 * เดิมมีแต่ปุ่มออกจากระบบลอย ๆ ไม่มีอะไรบอกว่ากำลังเป็นใครอยู่
 * ตอนนี้ปุ่มออกจากระบบย้ายเข้าไปอยู่ในเมนูบัญชี ซึ่งเป็นที่ที่ควรอยู่ —
 * และได้ผลพลอยได้คือกดพลาดยากขึ้น เดิมมันอยู่ติดเมนูสุดท้ายจนกดโดนบ่อย
 */
export function SidebarFoot({ quota, me, signOut }: {
  quota: AiQuota | null; me: Me; signOut: () => Promise<void>;
}) {
  const { collapsed } = useNav();
  return (
    <>
      {!collapsed && (
        <div className="border-t border-neutral-100 px-2 pt-2">
          <AiQuotaBar quota={quota} />
        </div>
      )}
      <div className={cn("border-t border-neutral-100 pb-3 pt-2", collapsed ? "flex justify-center px-2" : "px-2")}>
        <AccountMenu me={me} signOut={signOut} variant={collapsed ? "icon" : "row"} />
      </div>
    </>
  );
}
