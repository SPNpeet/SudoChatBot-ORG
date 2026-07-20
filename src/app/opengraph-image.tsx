import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

// รูป OG เวลาแชร์ลิงก์ลง Facebook/LINE — ฟอนต์ default ของ ImageResponse ไม่มีสระไทย จึงใช้อังกฤษ
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SudoChatBot — AI Sales Chatbot for Facebook / IG / LINE";

export default function OpengraphImage() {
  const logo = fs.readFileSync(path.join(process.cwd(), "public/logo-mark.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #064e3b 0%, #059669 100%)", color: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={96} height={96} style={{ borderRadius: 20, objectFit: "cover" }} />
          <div style={{ fontSize: 84, fontWeight: 700, display: "flex" }}>
            Sudo<span style={{ color: "#6ee7b7" }}>ChatBot</span>
          </div>
        </div>
        <div style={{ fontSize: 34, marginTop: 20, color: "#d1fae5", display: "flex" }}>
          AI Sales Chatbot — Facebook / Instagram / LINE
        </div>
        <div style={{ fontSize: 26, marginTop: 36, padding: "14px 36px", borderRadius: 999, background: "rgba(255,255,255,0.15)", display: "flex" }}>
          Reply · Sell · PromptPay QR · Slip Verify — 24/7
        </div>
      </div>
    ),
    size,
  );
}
