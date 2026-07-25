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
      "px-4 py-5 pb-[calc(7.75rem+env(safe-area-inset-bottom))] md:px-8 md:py-7 md:pb-7",
      "transition-[margin] duration-200 ease-out motion-reduce:transition-none",
      collapsed ? "md:ml-16" : "md:ml-56",
    )}>
      {children}
    </main>
  );
}
