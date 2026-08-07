"use client";
// ============================================================
//  บัญชีผู้ใช้ที่กำลังล็อกอินอยู่ — ต้องเห็นได้จากทุกหน้า
//
//  ปัญหาเดิม (ผู้ใช้แจ้งเอง): ทั้งเว็บไม่มีสักจุดเดียวที่บอกว่าใครล็อกอินอยู่
//  มีแค่ปุ่ม "ออกจากระบบ" — แปลว่าวิธีเดียวที่จะรู้ว่าตัวเองเป็นบัญชีไหน
//  คือกดออกจากระบบแล้วดูตอนล็อกอินใหม่ ซึ่งเป็นราคาที่แพงเกินไปสำหรับคำถามง่าย ๆ
//
//  ทำไมเรื่องนี้สำคัญกับระบบบัญชีมากกว่าเว็บทั่วไป
//   1. ทุกครั้งที่บันทึก/ยกเลิกเอกสาร ระบบประทับ user id ลง audit log
//      ถ้านั่งเครื่องที่ค้างบัญชีคนอื่นไว้ ร่องรอยจะชี้ไปผิดคน และลบไม่ได้
//   2. สำนักงานบัญชีมีหลายบัญชีสลับกันดูแลลูกค้าคนละชุด ต้องแยกให้ออกก่อนลงมือ
//   3. SME ใช้คอมเครื่องเดียวกันหลายคนและเปิดค้างไว้ทั้งวัน
//  คำถาม "ตอนนี้ฉันเป็นใคร" ต้องตอบได้ภายในหนึ่งสายตา ก่อนจะกดบันทึกอะไรลงบัญชี
//
//  ⚠️ ต้อง portal ออกไป document.body
//  หัวมือถือเป็น sticky z-20 = สร้าง stacking context ของตัวเอง ของที่ render
//  ข้างในจะติดอยู่ในกรอบนั้นต่อให้ตั้ง z สูงแค่ไหน ปุ่มลอยนอก header จะทับเมนู
//  (บั๊ก "ปุ่มค้าง" ตัวเดียวกับที่เคยเจอในตัวสลับกิจการ)
// ============================================================
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UserRound, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/roles";

export interface Me {
  name: string | null;
  email: string | null;
  role: string;
  shopName: string;
}

/** ตัวย่อบนวงกลม — ตัดด้วย Array.from ให้ปลอดภัยกับสระ/วรรณยุกต์ไทยที่เป็นคนละ codepoint */
export function initialsOf(name: string | null, email: string | null) {
  const src = (name ?? "").trim();
  if (src) {
    const words = src.split(/\s+/).slice(0, 2);
    return words.map((w) => Array.from(w)[0] ?? "").join("");
  }
  return (Array.from((email ?? "?").trim())[0] ?? "?").toUpperCase();
}

export default function AccountMenu({ me, signOut, variant = "row" }: {
  me: Me;
  signOut: () => Promise<void>;
  variant?: "row" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const path = usePathname();

  useEffect(() => setMounted(true), []);
  // อยู่ใน layout จึงไม่ remount ตอนเปลี่ยนหน้า — ต้องปิดเองไม่งั้นค้างข้ามหน้า
  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    // ตำแหน่งคำนวณจากปุ่มตอนเปิด ถ้าจอขยับ/ย่อ ค่าเดิมจะเพี้ยน ปิดไปเลยตรงไปตรงมากว่า
    const close = () => setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("resize", close); };
  }, [open]);

  function toggle() {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(288, vw - 24);
    // เมนูอยู่ท้ายแถบเมนูซ้าย (ล่างสุดของจอ) จึงต้องกางขึ้นเป็นปกติ
    // แต่บนหัวมือถือมันอยู่บนสุด ต้องกางลง — ตัดสินจากที่ว่างจริงตอนกด
    const useDown = vh - r.bottom > 320;
    setPos({
      left: Math.min(Math.max(12, r.left), vw - w - 12),
      ...(useDown ? { top: r.bottom + 8 } : { bottom: vh - r.top + 8 }),
    });
    setOpen(true);
  }

  const initials = initialsOf(me.name, me.email);
  const shown = me.name?.trim() || me.email || "บัญชีของฉัน";
  const label = `บัญชีผู้ใช้ — ${shown}${me.email && me.name ? ` (${me.email})` : ""}`;

  const Avatar = ({ big }: { big?: boolean }) => (
    <span aria-hidden className={cn(
      "grid shrink-0 place-items-center rounded-full bg-emerald-600 font-semibold text-white",
      big ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs",
    )}>{initials}</span>
  );

  return (
    <>
      <button ref={btnRef} onClick={toggle} title={label} aria-label={label}
        aria-haspopup="menu" aria-expanded={open}
        className={cn(
          "flex items-center rounded-xl transition-colors hover:bg-neutral-100",
          variant === "icon" ? "p-1" : "w-full gap-2.5 px-2 py-2 text-left",
          open && "bg-neutral-100",
        )}>
        <Avatar />
        {variant === "row" && (
          <>
            {/* ชื่อบรรทัดบน อีเมลบรรทัดล่าง — อีเมลคือสิ่งที่ระบุตัวตนได้จริง
                ชื่อซ้ำกันได้ จึงต้องเห็นอีเมลโดยไม่ต้องกดอะไรเลย */}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-neutral-800">{me.name?.trim() || "ยังไม่ได้ตั้งชื่อ"}</span>
              <span className="block truncate text-xs text-neutral-400">{me.email ?? "—"}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
          </>
        )}
      </button>

      {open && pos && mounted && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden />
          <div role="menu" aria-label="บัญชีผู้ใช้"
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: "min(18rem, calc(100vw - 1.5rem))" }}
            className="fixed z-[61] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-neutral-100 px-4 py-3.5">
              <Avatar big />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{me.name?.trim() || "ยังไม่ได้ตั้งชื่อ"}</p>
                {/* break-all เพราะอีเมลบริษัทไทยยาวเกินกล่องบ่อย — ตัดท้ายทิ้งแล้วระบุตัวไม่ได้ */}
                <p className="break-all text-xs leading-snug text-neutral-500">{me.email ?? "ไม่มีอีเมล"}</p>
              </div>
            </div>

            <div className="border-b border-neutral-100 px-4 py-2.5">
              <p className="text-xs leading-relaxed text-neutral-500">
                กำลังทำงานในกิจการ <b className="text-neutral-700">{me.shopName}</b>
                {" "}สิทธิ์ <b className="text-neutral-700">{roleLabel(me.role)}</b>
              </p>
              {/* บอกให้รู้ว่าการกระทำถูกบันทึกในชื่อนี้ — คนที่ใช้เครื่องร่วมกันจะได้เช็คก่อนลงบัญชี */}
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                เอกสารที่บันทึกจะถูกประทับชื่อบัญชีนี้ไว้ในประวัติการแก้ไข
              </p>
            </div>

            <div className="p-1.5">
              <Link href="/dashboard/account" onClick={() => setOpen(false)} role="menuitem"
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50">
                <UserRound className="h-4 w-4 text-neutral-400" /> บัญชีของฉัน
              </Link>
              <form action={signOut}>
                <button role="menuitem"
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-sm text-red-600 hover:bg-red-50">
                  <LogOut className="h-4 w-4" /> ออกจากระบบ
                </button>
              </form>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
