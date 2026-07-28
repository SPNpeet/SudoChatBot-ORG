"use client";
// ============================================================
//  กติกาการปิดกล่องซ้อน (modal / dropdown) — เขียนที่เดียวใช้ทุกที่
//
//  ทำไมต้องมี: ผู้ใช้แจ้งว่าเจอ "ปุ่มค้าง" บนมือถือตอนเพิ่มกิจการใหม่
//  ไล่แล้วพบว่ากล่องซ้อนในระบบ 10 จุดกด Esc ปิดไม่ได้เลย รวมถึงกล่องจ่ายเงิน
//  คนที่ใช้คีย์บอร์ดจึงติดอยู่ในกล่องนั้น ต้องเมาส์ไปกดกากบาทอย่างเดียว
//
//  รวมพฤติกรรมที่กล่องซ้อนทุกอันควรมีเหมือนกัน
//   1. กด Esc ปิด
//   2. ล็อกไม่ให้หน้าข้างหลังเลื่อน (บนมือถือถ้าไม่ล็อก พอเลื่อนในกล่อง
//      หน้าข้างหลังจะเลื่อนตามจนกล่องหลุดออกนอกจอ ดูเหมือนแอปค้าง)
//
//  ไม่รวมการแตะข้างนอกเพื่อปิด เพราะแต่ละที่วาง backdrop ต่างกัน
//  ให้ผูก onClick ที่ backdrop เองตามเดิม
// ============================================================
import { useEffect } from "react";

export function useDismiss(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey);

    // จำค่าเดิมไว้คืนตอนปิด เผื่อมีกล่องซ้อนกันหลายชั้น
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}
