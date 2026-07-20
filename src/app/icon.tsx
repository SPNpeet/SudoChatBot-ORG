import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

// favicon ทั่วไป — Next.js ลิงก์ <link rel="icon"> ให้อัตโนมัติทุกหน้า
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  const logo = fs.readFileSync(path.join(process.cwd(), "public/logo-mark.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center", borderRadius: 6, overflow: "hidden",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={32} height={32} style={{ objectFit: "cover" }} />
      </div>
    ),
    size,
  );
}
