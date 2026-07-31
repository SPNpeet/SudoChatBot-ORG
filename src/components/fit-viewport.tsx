"use client";
// ============================================================
//  กล่องที่สูง "พอดีกับที่ว่างที่เหลือบนจอ" — วัดจริง ไม่ใช่เดาเป็น rem
//
//  ทำไมต้องมี: หน้าผู้ช่วยบัญชี AI เคยตั้งความสูงไว้ว่า h-[calc(100svh-15rem)]
//  ตัวเลข 15rem เป็นการเดาว่าหัวเว็บ+พาดหัว+แถบล่างกินที่เท่าไร ซึ่งเดาผิด
//  ของจริงบนมือถือ: หัวเว็บ ~69px + ระยะบน 20px + พาดหัวหน้า ~76px
//  + padding ล่างของพื้นที่เนื้อหา 152px = ~317px ไม่ใช่ 240px
//  ผลคือกล่องแชทสูงเกินที่ว่าง หน้าเลยเลื่อนได้ด้วย และในกล่องก็เลื่อนได้อีก
//  เจ้าของเจอเองว่า "มันเลื่อนแม่ง 2 อัน ทั้งจอและกรอบที่ให้คุยแชท"
//
//  แถม min-h-[28rem] ยังบังคับให้สูงอย่างน้อย 448px ด้วย จอเตี้ย ๆ (iPhone SE)
//  จึงล้นแน่นอนไม่ว่าคำนวณยังไง
//
//  ⚠️ ต้องหักลบ padding ล่างของ <main> ออกด้วย ไม่งั้นถึงกล่องจะสูงพอดี
//  ก็ยังมีที่ว่างใต้กล่องอีก 152px ทำให้หน้ายังเลื่อนได้อยู่ดี
// ============================================================
import { useEffect, useRef, useState } from "react";

export default function FitViewport({ children, className, minHeight = 320 }: {
  children: React.ReactNode;
  className?: string;
  /** ต่ำกว่านี้ให้ยอมให้หน้าเลื่อนแทน — จอเตี้ยมากบีบจนใช้ไม่ได้แย่กว่าเลื่อน */
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ h: number; mb: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let last = { h: -1, mb: -1 };
    const fit = () => {
      // top เทียบขอบบนจอ — ไม่ขึ้นกับความสูงของตัวเราเอง จึงไม่วนลูป
      const top = el.getBoundingClientRect().top;
      const nav = document.querySelector("[data-bottom-nav]");
      const navH = nav ? nav.getBoundingClientRect().height : 0;
      const main = el.closest("main");
      const padB = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;

      const h = Math.round(window.innerHeight - top - navH - 8);
      const next = { h: Math.max(minHeight, h), mb: Math.round(padB) };
      // กันสั่น: ต่างไม่ถึง 2px ถือว่าเท่าเดิม
      if (Math.abs(next.h - last.h) < 2 && next.mb === last.mb) return;
      last = next;
      setSize(next);
    };

    fit();

    // ⚠️ ห้ามพึ่ง ResizeObserver เป็นทางเดียว
    // วัดจริงแล้วพบ browser บางตัว (รวม embedded webview) ไม่ยิง callback เลย
    // แม้แต่ครั้งแรกตอน observe ซึ่งตามสเปกต้องยิง — ถ้าพึ่งมันอย่างเดียว
    // ความสูงจะค้างที่ค่าแรกตลอด จึงต้องมีเส้นทางที่การันตีว่าเกิดแน่:
    //
    // 1. document.fonts.ready — ฟอนต์ IBM Plex Sans Thai โหลดเสร็จคือจังหวะเดียว
    //    ที่ความสูงของหัวเรื่องเปลี่ยนจริงแล้วดันตำแหน่งเรา (เกิดแน่ทุกเครื่อง)
    // 2. วัดซ้ำที่ 300ms/1000ms — เผื่อรูป/แบนเนอร์ด้านบนโผล่ช้า
    // 3. resize + visualViewport — หมุนจอ / แป้นพิมพ์มือถือเด้ง
    // 4. ResizeObserver เก็บไว้เป็นชั้นเสริมสำหรับ browser ที่มันทำงาน
    document.fonts?.ready.then(fit).catch(() => {});
    const t1 = setTimeout(fit, 300);
    const t2 = setTimeout(fit, 1000);
    let ro: ResizeObserver | null = null;
    try { ro = new ResizeObserver(fit); ro.observe(document.body); } catch { /* ไม่มีก็ไม่เป็นไร มีชั้นอื่นรับ */ }
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    // แป้นพิมพ์มือถือเด้งขึ้นมาแล้ว innerHeight ไม่เปลี่ยน แต่ visualViewport เปลี่ยน
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      ro?.disconnect();
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
  }, [minHeight]);

  return (
    <div ref={ref} className={className}
      style={size ? { height: size.h, marginBottom: -size.mb } : undefined}>
      {children}
    </div>
  );
}
