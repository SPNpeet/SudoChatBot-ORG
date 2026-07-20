import { ImageResponse } from "next/og";

// ไอคอน PWA 192x192 — Android "เพิ่มไปหน้าจอหลัก" ใช้ไฟล์นี้ (อ้างอิงจาก manifest.ts)
export async function GET() {
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center", background: "#059669",
      }}>
        <div style={{ color: "#fff", fontSize: 110, fontWeight: 700, display: "flex" }}>S</div>
      </div>
    ),
    { width: 192, height: 192 },
  );
}
