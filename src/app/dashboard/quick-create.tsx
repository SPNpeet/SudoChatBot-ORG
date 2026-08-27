"use client";
// ============================================================
//  ปุ่ม + ลอย (Speed dial) — สร้างงานที่ทำบ่อยที่สุดจากทุกหน้า ไม่ต้องไล่เมนู
//  แบบเดียวกับ Gmail/Drive: กด + แล้วเลือก 4 อย่างที่ทำทุกวัน
//  จงใจไม่ใส่ทุกเมนู — ใส่เยอะ = ต้องอ่าน = ช้ากว่าเดิม
// ============================================================
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, X, Receipt, FileText, Camera, Calculator, FileSignature } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { href: "/dashboard/sales/new?type=receipt", icon: Receipt, label: "ขายสด / ใบเสร็จ", hint: "รับเงินแล้ว" },
  { href: "/dashboard/sales/new?type=invoice", icon: FileText, label: "ใบแจ้งหนี้", hint: "ขายเชื่อ ตั้งลูกหนี้" },
  // ⚠️ ต้องมีใบเสนอราคาในเมนูนี้ — ปุ่ม + คือทางสร้างเอกสารหลักบนมือถือ
  // เดิมไม่มี ลูกค้าจริงและเจ้าของถามตรงกันว่า "ทำไมไม่มีใบเสนอราคาเลย" (2 ส.ค. 2569)
  // ทั้งที่ฟีเจอร์มีอยู่ แค่เข้าไม่ถึง — ฟีเจอร์ที่หาไม่เจอ = ไม่มีฟีเจอร์
  { href: "/dashboard/sales/new?type=quotation", icon: FileSignature, label: "ใบเสนอราคา", hint: "ยังไม่ตกลงราคา แปลงทีหลังได้" },
  { href: "/dashboard/expenses/new", icon: Camera, label: "ถ่ายรูปบิล", hint: "ให้ AI ลงบัญชีให้" },
  // ⚠️ ไม่มี "สั่งผู้ช่วย AI" ในนี้โดยตั้งใจ (12 ส.ค. 2569)
  // แถบเมนูล่างบนมือถือมี "ผู้ช่วย AI" เป็น 1 ใน 4 ปุ่มหลักอยู่แล้ว และอยู่ห่างจากปุ่ม +
  // ไม่ถึงนิ้วเดียว — ใส่ซ้ำในเมนูนี้คือให้ผู้ใช้เลือกทางไปที่เดียวกันสองทางบนจอเดียว
  // เมนูนี้ควรเหลือเฉพาะ "สร้างเอกสาร" ซึ่งเป็นสิ่งที่แถบล่างทำไม่ได้
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
  // หน้าพิมพ์/PDF คือ "ตัวเอกสาร" ที่ผู้ใช้กำลังตรวจก่อนส่งให้คนอื่น
  // ปุ่มลอยไปทับมุมเอกสารทั้งบนจอและในภาพที่คนแคปส่งต่อ (คนตรวจภายนอกจับได้)
  // หน้านี้ต้องเป็น preview เต็มจอเท่านั้น (แก้ 28 ส.ค. 2569)
  if (path?.startsWith("/dashboard/print")) return null;

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
            {/* ⚠️ สถานะ hover ต้องต่างจาก "ยังไม่ได้แตะ" อย่างชัดเจน (8 ส.ค. 2569)
                เดิมทุกใบเป็นการ์ดขาว shadow-lg เท่ากันหมด แล้ว hover เปลี่ยนแค่สีขอบจาง ๆ
                บนจอจริงจึงดูเหมือน "ใบที่เมาส์ทับอยู่ถูกกดเลือกไปแล้ว" ทั้งที่ยังไม่ได้กด
                เจ้าของรายงานว่า "ไม่ได้กดมันก็เหมือนกดอันนั้นเลย"
                ตอนนี้: ปกติ = แบน ขอบบาง · hover = ยกขึ้น + พื้นเขียวจาง + เลื่อนซ้ายนิดเดียว
                · กดจริง = ยุบลง (scale) — สามสถานะแยกออกจากกันด้วยตาเปล่า */}
            {ACTIONS.map((a) => (
              <Link key={a.href} href={a.href}
                className="group flex items-center gap-3 rounded-2xl border border-neutral-200/80 bg-white py-2.5 pl-3.5 pr-4 shadow-sm transition-all duration-150 hover:-translate-x-0.5 hover:border-emerald-500/40 hover:bg-emerald-50/60 hover:shadow-xl active:translate-x-0 active:scale-[0.97] active:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-x-0">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 transition-colors group-hover:bg-emerald-600">
                  <a.icon className="h-4 w-4 text-emerald-600 transition-colors group-hover:text-white" />
                </span>
                <span className="text-left">
                  <span className="block text-[13px] font-semibold leading-tight text-neutral-800">{a.label}</span>
                  <span className="block text-xs text-neutral-400 transition-colors group-hover:text-emerald-700">{a.hint}</span>
                </span>
              </Link>
            ))}
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
