"use client";
// error boundary ของ dashboard — query พัง/เน็ตสะดุดต้องไม่เจอจอ error ดิบของ Next
//
// สำคัญ: เดิมหน้านี้โชว์ error ให้ผู้ใช้เห็นแล้วจบ ไม่ส่งไปไหนเลย
// เจ้าของระบบจึงไม่มีทางรู้ว่าลูกค้าเจอปัญหาอะไร ต้องรอลูกค้าแคปหน้าจอมาบอก
// ตอนนี้ยิงเข้า /api/log-error เหมือน global-error เพื่อให้ตามรอยได้จากฐานข้อมูล
import { useEffect } from "react";
import { CircleAlert } from "lucide-react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      const body = JSON.stringify({
        message: error?.message ?? "unknown",
        digest: error?.digest ?? "",
        url: typeof location !== "undefined" ? location.pathname + location.search : "",
        stack: (error?.stack ?? "").slice(0, 2000),
      });
      // keepalive เผื่อผู้ใช้กดออกจากหน้าทันที — รายงานจะยังถูกส่ง
      fetch("/api/log-error", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
        .catch(() => { /* รายงานไม่ได้ก็ห้ามพังซ้ำ */ });
    } catch { /* ห้ามให้ตัวรายงานทำให้จอ error พังเอง */ }
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 text-center">
        <CircleAlert className="mx-auto h-9 w-9 text-neutral-300" />
        <h2 className="mt-3 text-base font-bold">หน้านี้โหลดไม่สำเร็จ</h2>
        <p className="mt-1 text-sm text-neutral-500">
          อาจเป็นปัญหาเครือข่ายชั่วคราว ลองใหม่ได้เลย — ข้อมูลของร้านคุณปลอดภัยไม่หายไปไหน
        </p>
        {error.digest && <p className="mt-2 text-[11px] text-neutral-300">รหัสอ้างอิง: {error.digest}</p>}
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={reset}
            className="h-10 rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-500">
            ลองอีกครั้ง
          </button>
          <a href="/dashboard"
            className="flex h-10 items-center rounded-xl border border-neutral-300 px-5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            กลับหน้าภาพรวม
          </a>
        </div>
      </div>
    </div>
  );
}
