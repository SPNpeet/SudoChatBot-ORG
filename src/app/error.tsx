"use client";
// error boundary ระดับแอป — จับ error ของหน้าอื่น ๆ และของ "layout" ทุกตัวที่อยู่ใต้ root
// (error.tsx ของแต่ละ segment ไม่จับ layout ของตัวเอง ดังนั้น layout พังจะมาโผล่ที่นี่)
//
// เดิมหน้านี้ไม่ส่งรายงานไปไหนเลย — หน้าภาพรวมพังทั้งวันโดยไม่มีร่องรอยใน log สักบรรทัด
// ต้องรอผู้ใช้แคปหน้าจอมาบอกถึงจะรู้ ตอนนี้ยิงเข้า /api/log-error ทุกครั้ง
import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      fetch("/api/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          message: error?.message ?? "unknown",
          digest: error?.digest ?? "",
          url: typeof location !== "undefined" ? location.pathname + location.search : "",
          stack: (error?.stack ?? "").slice(0, 2000),
        }),
      }).catch(() => { /* รายงานไม่ได้ก็ห้ามพังซ้ำ */ });
    } catch { /* ห้ามให้ตัวรายงานทำให้จอ error พังเอง */ }
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 text-center">
        <h2 className="text-base font-bold">เกิดข้อผิดพลาดชั่วคราว</h2>
        <p className="mt-1 text-sm text-neutral-500">รีเฟรชหรือลองใหม่อีกครั้งได้เลย</p>
        {error.digest && <p className="mt-2 text-xs text-neutral-300">รหัสอ้างอิง: {error.digest}</p>}
        <button onClick={reset}
          className="mt-4 h-10 rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-500">
          ลองอีกครั้ง
        </button>
      </div>
    </main>
  );
}
