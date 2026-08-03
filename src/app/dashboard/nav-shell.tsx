"use client";
// ============================================================
//  โครงเมนู + เนื้อหา — เก็บสถานะ "พับเมนูอยู่ไหม" ไว้ที่เดียว
//  แถบซ้ายกับพื้นที่เนื้อหาต้องขยับพร้อมกันเป๊ะ จึงต้องใช้ state ร่วมกัน
//  (ไม่ใช้ polling / ไม่ใช้ event bus — context ตรงไปตรงมาและถูกต้องที่สุด)
// ============================================================
import { createContext, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const KEY = "sc_nav_collapsed";

interface NavState { collapsed: boolean; toggle: () => void; ready: boolean }
const Ctx = createContext<NavState>({ collapsed: false, toggle: () => {}, ready: false });
export const useNav = () => useContext(Ctx);

export function NavShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  // อ่านค่าที่จำไว้หลัง mount — เซิร์ฟเวอร์ไม่รู้จัก localStorage ถ้าอ่านตอน render จะ hydration พัง
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(KEY) === "1"); } catch { /* ข้าม */ }
    setReady(true);
  }, []);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* ข้าม */ }
      return next;
    });
  }

  return <Ctx.Provider value={{ collapsed, toggle, ready }}>{children}</Ctx.Provider>;
}

/** พื้นที่เนื้อหา — เว้นซ้ายตามความกว้างเมนูที่กำลังเป็นอยู่ */
export function MainArea({ children }: { children: React.ReactNode }) {
  const { collapsed } = useNav();
  return (
    <main className={cn(
      // เว้นที่ด้านบนบนเดสก์ท็อปให้ปุ่มค้นหาที่ลอยอยู่มุมขวาบน (fixed top-3 สูง 36px)
      // ไม่งั้นมันจะทับปุ่มของหัวข้อหน้า เช่น ปุ่ม "ส่งออก" บนหน้ารายงาน
      //
      // ⚠️ ระยะล่างต้องมากกว่าที่ปุ่ม + ลอยกินจริง ไม่งั้นมันทับบรรทัดสุดท้ายของตาราง
      // เจ้าของแคปมาจริง 4 ส.ค. 2569: ยอด "รวม" คอลัมน์เครดิตในสมุดรายวันโดนปุ่มบัง
      // คำนวณจากของจริง: ปุ่มสูง h-14 (56px)
      //   เดสก์ท็อป ปุ่มอยู่ bottom-6 (24px) -> กินถึง 80px แต่เดิมเว้น pb-7 (28px) = ขาด 52px
      //   มือถือ ปุ่มอยู่ 6.25rem (100px) -> กินถึง 156px แต่เดิมเว้น 9.5rem (152px) = ขาด 4px
      "px-4 py-5 pb-[calc(11rem+env(safe-area-inset-bottom))] md:px-8 md:pt-16 md:pb-24",
      "transition-[margin] duration-200 ease-out motion-reduce:transition-none",
      collapsed ? "md:ml-16" : "md:ml-56",
    )}>
      {/* ตีคอกเนื้อหาไว้กลางจอ — บนจอกว้าง 1900px ตารางเดิมกางเต็มจน
          คอลัมน์ซ้ายสุดกับขวาสุดห่างกันเป็นเมตร สายตากวาดแล้วหลงบรรทัด
          1280px คือความกว้างที่ตารางบัญชี 6-7 คอลัมน์ยังอ่านสบายและไม่อึดอัด */}
      <div className="mx-auto w-full max-w-7xl">{children}</div>
    </main>
  );
}
