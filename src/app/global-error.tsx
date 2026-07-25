"use client";
// Error boundary ระดับแอป — จับ client-side crash แล้วรายงานเข้า server log (เห็นใน Vercel Logs)
// พร้อมหน้า error ภาษาไทยแทน "Application error" ดิบ ๆ ของ Next.js
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message, digest: error.digest,
        stack: error.stack?.slice(0, 2000), url: location.href,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="th">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#fafafa", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          {/* วาด SVG ตรงๆ เพราะ global-error ต้องไม่พึ่งอะไรเลย (มันคือด่านสุดท้ายตอนแอปพัง) */}
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto" }} aria-hidden>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
          </svg>
          <h1 style={{ fontSize: 18, margin: "12px 0 4px" }}>เกิดข้อผิดพลาดชั่วคราว</h1>
          <p style={{ fontSize: 14, color: "#737373", margin: "0 0 20px" }}>ทีมงานได้รับรายงานแล้ว ลองโหลดหน้าใหม่อีกครั้ง</p>
          <button onClick={reset}
            style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: "#059669", color: "#fff", fontSize: 14, cursor: "pointer" }}>
            โหลดใหม่
          </button>
        </div>
      </body>
    </html>
  );
}
