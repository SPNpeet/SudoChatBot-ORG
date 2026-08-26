"use client";
// หัวและท้ายของแถบเมนู — ต้องรู้ว่ากำลังพับอยู่ไหม เพื่อย่อ/ซ่อนของที่ไม่จำเป็น
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useNav } from "./nav-shell";
import { Logo } from "@/components/logo";
import CompanySwitcher from "./company-switcher";
import AiQuotaBar, { type AiQuota } from "./ai-quota-bar";
import AccountMenu, { type Me } from "./account-menu";
import SystemInbox from "./system-inbox";
import type { Notice } from "@/lib/notices";
import { MessageCirclePlus } from "lucide-react";

/** ปุ่มเปิดกล่อง "แนะนำ/ติชม" — ตัวกล่องอยู่ใน FeedbackWidget ที่ layout เรนเดอร์ไว้แล้ว */
function FeedbackTrigger({ variant }: { variant: "icon" | "row" }) {
  return (
    <button type="button" title="แนะนำ/ติชม"
      onClick={() => document.querySelector<HTMLButtonElement>("[data-feedback-open]")?.click()}
      className={cn(
        "flex items-center text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900",
        variant === "icon"
          ? "h-11 w-11 shrink-0 justify-center rounded-full"
          : "min-h-11 w-full gap-2.5 rounded-xl px-2.5 py-2 text-sm",
      )}>
      <MessageCirclePlus className="h-[18px] w-[18px] shrink-0" />
      {variant === "row" && <span className="flex-1 text-left">แนะนำ/ติชม</span>}
    </button>
  );
}

export function SidebarHead({ companies, currentId, shopId, notices }: {
  companies: { id: string; name: string; role: string }[]; currentId: string;
  shopId: string; notices: Notice[];
}) {
  const { collapsed } = useNav();
  return (
    <div className={cn("py-4", collapsed ? "px-2" : "px-4")}>
      {/* โลโก้/ชื่อ = ทางกลับหน้าภาพรวมเสมอ (ผู้ใช้คาดหวังแบบนี้จากทุกเว็บ) */}
      {/* กระดิ่งย้ายมาอยู่บนสุดคู่กับโลโก้ (8 ส.ค. 2569 ตามที่เจ้าของขอ)
          เดิมอยู่ท้ายแถบเมนูติดกับเมนูบัญชี ซึ่งเป็นมุมที่คนมองหา "ตัวเอง" ไม่ใช่ "เรื่องแจ้ง"
          บนสุด-ซ้ายเป็นตำแหน่งที่เว็บสากลใช้วางแจ้งเตือนอยู่แล้ว จึงหาเจอโดยไม่ต้องสอน */}
      <div className={cn("flex items-center", collapsed ? "flex-col gap-1" : "justify-between gap-2")}>
        <Link href="/dashboard" title="กลับหน้าภาพรวม"
          className={cn("block rounded-lg py-0.5 transition-opacity hover:opacity-70", collapsed ? "flex justify-center" : "px-1")}>
          {collapsed
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src="/logo-mark.png" alt="SudoChatBot" width={28} height={28} className="h-7 w-7 rounded-lg object-cover" />
            : <Logo subtitle="ผู้ช่วยบัญชี AI" />}
        </Link>
        <SystemInbox shopId={shopId} notices={notices} variant="icon" place="sidebar-top" />
      </div>
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
      {/* "แนะนำ/ติชม" มาอยู่ตรงนี้แทนกระดิ่ง (กระดิ่งย้ายขึ้นบนสุด)
          เดิมซ่อนอยู่ในเมนูของปุ่ม + ลอย ซึ่งคนเปิดเพื่อ "สร้างเอกสาร" ไม่ใช่เพื่อบ่น
          ช่องทางบอกปัญหาที่ต้องเปิดเมนูสร้างเอกสารก่อนถึงจะเจอ = แทบไม่มีใครใช้ */}
      <div className={cn("border-t border-neutral-100 pt-2", collapsed ? "flex justify-center px-2" : "px-2")}>
        <FeedbackTrigger variant={collapsed ? "icon" : "row"} />
      </div>
      <div className={cn("border-t border-neutral-100 pb-3 pt-2", collapsed ? "flex justify-center px-2" : "px-2")}>
        <AccountMenu me={me} signOut={signOut} variant={collapsed ? "icon" : "row"} />
      </div>
    </>
  );
}
