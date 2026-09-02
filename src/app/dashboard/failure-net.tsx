"use client";
// ============================================================
//  ตาข่ายรองรับ "ล้มเงียบ" ทั้งแดชบอร์ด (เพิ่ม 31 ส.ค. 2569)
//
//  ทำไมต้องมี: กวาดทั้ง src พบ start(async () => { await serverAction() })
//  ที่ไม่มี try/catch อยู่ 39 จุด — เน็ตหลุดตอนกดปุ่มพวกนั้น = reject เงียบ
//  ผู้ใช้เห็นแค่ "กดแล้วไม่เกิดอะไร" ซึ่งเป็นอาการอันดับหนึ่งที่ทำให้คนเลิกใช้
//  (บทเรียนเดียวกับ ask_user ในกติกาข้อ 3: อยากให้ครอบทุกจุด ต้องบังคับที่โค้ดชั้นเดียว
//  ไม่ใช่ตามแปะ try ทีละไฟล์แล้วหลุดไฟล์ที่ 40 ที่มีคนเขียนใหม่พรุ่งนี้)
//
//  ตัวนี้ดัก unhandledrejection ระดับหน้าต่าง แล้วบอกผู้ใช้ผ่าน toast ว่า
//  "ทำรายการไม่สำเร็จ" — ข้อมูลในฟอร์มยังอยู่ (state ไม่หาย) กดซ้ำได้เสมอ
//
//  กติกาของตาข่าย:
//   · เป็นตาข่าย ไม่ใช่ที่จัดการ error หลัก — จุดที่รู้บริบทควร catch เองต่อไป
//     (doc-form/แชท/สลิป มีข้อความเฉพาะทางของตัวเองแล้ว ตัวนี้รับเฉพาะที่เหลือ)
//   · โชว์อย่างมากทุก 5 วิ กัน error รัวถล่มจอด้วย toast ซ้อน
//   · ไม่กลืน error — ปล่อยขึ้น console ตามปกติให้ยังดีบักได้
// ============================================================
import { useEffect, useRef } from "react";
import { useToast } from "@/components/toast";

export default function FailureNet() {
  const toast = useToast();
  const lastRef = useRef(0);

  useEffect(() => {
    const onReject = (e: PromiseRejectionEvent) => {
      // redirect ของ Next โยน object พิเศษที่ไม่ใช่ความผิดพลาด — ห้ามฟ้องผู้ใช้
      const digest = (e.reason as { digest?: string } | null)?.digest ?? "";
      if (typeof digest === "string" && digest.startsWith("NEXT_")) return;

      const now = Date.now();
      if (now - lastRef.current < 5000) return;
      lastRef.current = now;
      toast({ text: "ทำรายการไม่สำเร็จ — ข้อมูลที่กรอกยังอยู่ กดซ้ำได้เลย (ถ้าเป็นซ้ำ ลองเช็คสัญญาณเน็ต)", tone: "error" });
    };
    window.addEventListener("unhandledrejection", onReject);
    return () => window.removeEventListener("unhandledrejection", onReject);
  }, [toast]);

  return null;
}
