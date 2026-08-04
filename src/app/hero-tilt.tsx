"use client";
// ============================================================
//  เอฟเฟกต์ 3D ให้การ์ดตัวอย่างในหน้าแรก (แนว jaonin.com แต่เบากว่า)
//  CSS transform ล้วน — ไม่มี lib ไม่มี WebGL ไม่มี .gif ต้นทุนฝั่ง server = 0
//
//  · เดสก์ท็อป: การ์ดเอียงตามเมาส์ (perspective + rotateX/Y, จำกัด ~8 องศา)
//    ป้ายผลลัพธ์ที่ translateZ ต่างชั้นจะแยกระยะให้เห็นความลึกจริง
//  · จอสัมผัส: ไม่เอียงตามนิ้ว (จะตีกับการสกรอล) — ป้ายลอยช้า ๆ ด้วย keyframes แทน
//  · prefers-reduced-motion: นิ่งสนิททุกอย่าง (Tailwind motion-reduce)
// ============================================================
import { useRef } from "react";

export default function HeroTilt({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  function onMove(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(1100px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg)`;
    });
  }
  function onLeave() {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(raf.current);
    el.style.transform = "perspective(1100px) rotateX(0deg) rotateY(0deg)";
  }

  return (
    <div onPointerMove={onMove} onPointerLeave={onLeave}>
      <div ref={ref}
        className="will-change-transform transition-transform duration-200 ease-out [transform-style:preserve-3d] motion-reduce:!transform-none">
        {children}
      </div>
    </div>
  );
}
