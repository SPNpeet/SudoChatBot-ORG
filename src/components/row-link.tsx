"use client";
// ============================================================
//  แถวตารางที่กดได้ทั้งแถว
//
//  ปัญหาเดิม: ในตารางมีแค่ "เลขที่เอกสาร" ที่เป็นลิงก์ ผู้ใช้กดตรงชื่อลูกค้าหรือยอดเงิน
//  แล้วไม่มีอะไรเกิดขึ้น — เป็นกับดักที่เจอทุกวันและทำให้รู้สึกว่าระบบพัง
//
//  ที่นี่ทำให้ทั้งแถวกดได้ โดยยังไม่ทำลายของเดิม:
//   · ปุ่ม/ลิงก์ที่ซ้อนอยู่ในแถว (เช่น ปุ่มลบ) ยังกดได้ตามปกติ — เช็คจาก closest()
//   · ลากเลือกข้อความเพื่อคัดลอกได้ ไม่เด้งหน้า — เช็คว่ามี selection อยู่ไหม
//   · คลิกกลาง/Ctrl+คลิก เปิดแท็บใหม่ได้เหมือนลิงก์จริง
// ============================================================
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type * as React from "react";

export default function RowLink({ href, className, children, ...rest }: {
  href: string; className?: string; children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLTableRowElement>, "onClick">) {
  const router = useRouter();

  /** อยู่ในของที่กดได้อยู่แล้วไหม (ปุ่ม ลิงก์ ช่องกรอก) — ถ้าใช่ ปล่อยให้มันทำงานของมัน */
  const insideInteractive = (t: EventTarget | null) =>
    t instanceof Element && !!t.closest("a,button,input,select,textarea,label,[role='button']");

  return (
    <tr
      {...rest}
      className={cn("cursor-pointer transition-colors hover:bg-neutral-50", className)}
      onClick={(e) => {
        if (insideInteractive(e.target)) return;
        if (window.getSelection()?.toString()) return;   // กำลังลากคัดลอกข้อความอยู่
        if (e.metaKey || e.ctrlKey) { window.open(href, "_blank", "noopener"); return; }
        router.push(href);
      }}
      onAuxClick={(e) => {
        if (e.button === 1 && !insideInteractive(e.target)) window.open(href, "_blank", "noopener");
      }}
    >
      {children}
    </tr>
  );
}
