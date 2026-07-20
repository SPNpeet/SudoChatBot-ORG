import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

// ไอคอน iOS "เพิ่มไปหน้าจอโฮม" — ไม่มีไฟล์นี้ = iOS ใช้ภาพแคปหน้าจอแทน (ดูไม่โปร)
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const logo = fs.readFileSync(path.join(process.cwd(), "public/logo-mark.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={180} height={180} style={{ objectFit: "cover" }} />
      </div>
    ),
    size,
  );
}
