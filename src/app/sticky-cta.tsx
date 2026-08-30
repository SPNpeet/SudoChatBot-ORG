"use client";
// แถบสมัครติดล่างของหน้าแรก (มือถือ) — โผล่เมื่อเลื่อนพ้นจอแรกแล้วเท่านั้น
//
// ⚠️ ทำไมต้องรอ (30 ส.ค. 2569 — ภาพจริงจากมือถือ): จอแรกมีปุ่ม "เริ่มใช้ฟรี" ใหญ่อยู่แล้ว
// แถบนี้ขึ้นทันทีตั้งแต่ยังไม่เลื่อน = ปุ่มหลักสองปุ่มซ้อนกันในจอเดียว อ่านแล้วรก
// และดันเนื้อหาแรกให้เหลือพื้นที่น้อยลงโดยไม่ได้อะไรเพิ่ม
// หน้าที่จริงของแถบนี้คือ "เลื่อนอ่านไปไกลแล้วยังสมัครได้ทันที" — จึงเริ่มทำงานตอนนั้นพอ
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

export default function StickyCta({ label, brand }: { label: string; brand: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setShow(window.scrollY > window.innerHeight * 0.8);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className={`fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur transition-transform duration-200 motion-reduce:transition-none sm:hidden ${show ? "translate-y-0" : "translate-y-full"}`}>
      <Link href="/signup" className="flex h-12 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white active:scale-[0.99]"
        style={{ backgroundColor: brand }}>
        {label} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
