"use client";
// ============================================================
//  ปุ่ม + ลอย (Speed dial) — สร้างงานที่ทำบ่อยที่สุดจากทุกหน้า ไม่ต้องไล่เมนู
//  แบบเดียวกับ Gmail/Drive: กด + แล้วเลือก 4 อย่างที่ทำทุกวัน
//  จงใจไม่ใส่ทุกเมนู — ใส่เยอะ = ต้องอ่าน = ช้ากว่าเดิม
// ============================================================
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, X, Receipt, FileText, Camera, Calculator, MessageCirclePlus, FileSignature } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { href: "/dashboard/sales/new?type=receipt", icon: Receipt, label: "ขายสด / ใบเสร็จ", hint: "รับเงินแล้ว" },
  { href: "/dashboard/sales/new?type=invoice", icon: FileText, label: "ใบแจ้งหนี้", hint: "ขายเชื่อ ตั้งลูกหนี้" },
  // ⚠️ ต้องมีใบเสนอราคาในเมนูนี้ — ปุ่ม + คือทางสร้างเอกสารหลักบนมือถือ
  // เดิมไม่มี ลูกค้าจริงและเจ้าของถามตรงกันว่า "ทำไมไม่มีใบเสนอราคาเลย" (2 ส.ค. 2569)
  // ทั้งที่ฟีเจอร์มีอยู่ แค่เข้าไม่ถึง — ฟีเจอร์ที่หาไม่เจอ = ไม่มีฟีเจอร์
  { href: "/dashboard/sales/new?type=quotation", icon: FileSignature, label: "ใบเสนอราคา", hint: "ยังไม่ตกลงราคา แปลงทีหลังได้" },
  { href: "/dashboard/expenses/new", icon: Camera, label: "ถ่ายรูปบิล", hint: "ให้ AI ลงบัญชีให้" },
  { href: "/dashboard/assistant", icon: Calculator, label: "สั่งผู้ช่วย AI", hint: "พิมพ์เป็นภาษาคน" },
];

export default function QuickCreate() {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => { setOpen(false); }, [path]);          // เปลี่ยนหน้าแล้วปิดเอง
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  // หน้าผู้ช่วย AI สั่งงานด้วยการพิมพ์อยู่แล้ว ปุ่มสร้างเอกสารลอยทับจึงซ้ำซ้อน
  // และไปบังกล่องแชทซึ่งเป็นสิ่งเดียวที่หน้านั้นต้องใช้
  // ต้องอยู่ "หลัง" hooks ทุกตัว ไม่งั้นผิดกฎ Rules of Hooks (จำนวน hook ต้องเท่ากันทุก render)
  if (path?.startsWith("/dashboard/assistant")) return null;

  return (
    <>
      {open && <div className="fixed inset-0 z-[45] bg-black/20 backdrop-blur-[1px]" onClick={() => setOpen(false)} />}

      {/* เมนูล่างสูงประมาณ 60px + safe area — เดิมตั้ง 4.75rem (76px) ซึ่งเฉียดจนนิ้วกดพลาด
          ดันเป็น 6.25rem (100px) ให้มีระยะปลอดภัยจริง ๆ ระหว่างปุ่มลอยกับแถบเมนู */}
      <div className="fixed right-4 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-[46] flex flex-col items-end gap-2 md:bottom-6">
        {/* หุบขึ้น-ลงจากปุ่มเดียว — ไม่มีปุ่มลอยตัวที่สองมาทับของใต้มันอีก
            ใช้ animate เข้าจากล่างเล็กน้อยเพื่อให้รู้ว่าโผล่มาจากปุ่ม ไม่ใช่จู่โจม */}
        {open && (
          <div className="flex flex-col items-end gap-2 duration-150 animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
            {ACTIONS.map((a) => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white py-2.5 pl-3.5 pr-4 shadow-lg transition hover:border-emerald-300 active:scale-[0.98]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50">
                  <a.icon className="h-4 w-4 text-emerald-600" />
                </span>
                <span className="text-left">
                  <span className="block text-[13px] font-semibold leading-tight text-neutral-800">{a.label}</span>
                  <span className="block text-xs text-neutral-400">{a.hint}</span>
                </span>
              </Link>
            ))}
            {/* ติชมย้ายมาอยู่ในเมนูนี้แทนการเป็นปุ่มลอยอีกอัน */}
            <button type="button"
              onClick={() => {
                setOpen(false);
                document.querySelector<HTMLButtonElement>("[data-feedback-open]")?.click();
              }}
              className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white py-2.5 pl-3.5 pr-4 shadow-lg transition hover:border-neutral-400 active:scale-[0.98]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neutral-100">
                <MessageCirclePlus className="h-4 w-4 text-neutral-600" />
              </span>
              <span className="text-left">
                <span className="block text-[13px] font-semibold leading-tight text-neutral-800">แนะนำ/ติชม</span>
                <span className="block text-xs text-neutral-400">ส่งตรงถึงทีมงาน</span>
              </span>
            </button>
          </div>
        )}

        <button onClick={() => setOpen((v) => !v)}
          aria-label={open ? "ปิดเมนูสร้าง" : "สร้างเอกสารใหม่"} aria-expanded={open}
          className={cn(
            "grid h-14 w-14 place-items-center rounded-full text-white shadow-xl transition-all active:scale-95",
            open ? "rotate-45 bg-neutral-800" : "bg-emerald-600 hover:bg-emerald-500",
          )}>
          {open ? <X className="h-6 w-6 -rotate-45" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>
    </>
  );
}
