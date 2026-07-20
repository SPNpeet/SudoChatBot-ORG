import { ImageResponse } from "next/og";

// ไอคอน iOS "เพิ่มไปหน้าจอโฮม" — ไม่มีไฟล์นี้ = iOS ใช้ภาพแคปหน้าจอแทน (ดูไม่โปร)
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center", background: "#059669",
      }}>
        <div style={{ color: "#fff", fontSize: 100, fontWeight: 700, display: "flex" }}>S</div>
      </div>
    ),
    size,
  );
}
