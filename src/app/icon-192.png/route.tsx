import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

// ไอคอน PWA 192x192 — Android "เพิ่มไปหน้าจอหลัก" ใช้ไฟล์นี้ (อ้างอิงจาก manifest.ts)
export async function GET() {
  const logo = fs.readFileSync(path.join(process.cwd(), "public/logo-mark.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={192} height={192} style={{ objectFit: "cover" }} />
      </div>
    ),
    { width: 192, height: 192 },
  );
}
