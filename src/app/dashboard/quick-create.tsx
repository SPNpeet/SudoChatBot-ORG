"use client";
// ============================================================
//  ปุ่ม + ลอย (Speed dial) — สร้างงานที่ทำบ่อยที่สุดจากทุกหน้า ไม่ต้องไล่เมนู
//  แบบเดียวกับ Gmail/Drive: กด + แล้วเลือก 4 อย่างที่ทำทุกวัน
//  จงใจไม่ใส่ทุกเมนู — ใส่เยอะ = ต้องอ่าน = ช้ากว่าเดิม
// ============================================================
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, X, Receipt, FileText, Camera, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { href: "/dashboard/sales/new?type=receipt", icon: Receipt, label: "ขายสด / ใบเสร็จ", hint: "รับเงินแล้ว" },
  { href: "/dashboard/sales/new?type=invoice", icon: FileText, label: "ใบแจ้งหนี้", hint: "ขายเชื่อ ตั้งลูกหนี้" },
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

  return (
    <>
      {open && <div className="fixed inset-0 z-[45] bg-black/20 backdrop-blur-[1px]" onClick={() => setOpen(false)} />}

      <div className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[46] flex flex-col items-end gap-2 md:bottom-6">
        {open && ACTIONS.map((a) => (
          <Link key={a.href} href={a.href}
            className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white py-2.5 pl-3.5 pr-4 shadow-lg transition hover:border-emerald-300 active:scale-[0.98]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50">
              <a.icon className="h-4 w-4 text-emerald-600" />
            </span>
            <span className="text-left">
              <span className="block text-[13px] font-semibold leading-tight text-neutral-800">{a.label}</span>
              <span className="block text-[10px] text-neutral-400">{a.hint}</span>
            </span>
          </Link>
        ))}

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
