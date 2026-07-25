"use client";
// หัวและท้ายของแถบเมนู — ต้องรู้ว่ากำลังพับอยู่ไหม เพื่อย่อ/ซ่อนของที่ไม่จำเป็น
import Link from "next/link";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNav } from "./nav-shell";
import { Logo } from "@/components/logo";
import CompanySwitcher from "./company-switcher";
import AiQuotaBar, { type AiQuota } from "./ai-quota-bar";

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

export function SidebarFoot({ quota, signOut }: { quota: AiQuota | null; signOut: () => Promise<void> }) {
  const { collapsed } = useNav();
  return (
    <>
      {!collapsed && (
        <div className="border-t border-neutral-100 px-2 pt-2">
          <AiQuotaBar quota={quota} />
        </div>
      )}
      <form action={signOut} className={cn("pb-3 pt-1", collapsed ? "px-2" : "p-3 pt-1")}>
        <button title="ออกจากระบบ"
          className={cn(
            "flex w-full items-center rounded-xl py-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800",
            collapsed ? "justify-center px-0" : "gap-2.5 px-3",
          )}>
          <LogOut className="h-4 w-4 shrink-0" />{!collapsed && "ออกจากระบบ"}
        </button>
      </form>
    </>
  );
}
