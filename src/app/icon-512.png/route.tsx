import { ImageResponse } from "next/og";

// ไอคอน PWA 512x512 — ใช้ตอนติดตั้งเป็นแอป/splash screen (อ้างอิงจาก manifest.ts)
export async function GET() {
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center", background: "#059669",
      }}>
        <div style={{ color: "#fff", fontSize: 290, fontWeight: 700, display: "flex" }}>S</div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
