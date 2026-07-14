import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "SudoChatBot — AI ปิดการขายอัตโนมัติ สำหรับ Facebook / IG / LINE",
  description: "แชทบอท AI ที่ตอบลูกค้า แนะนำสินค้า สรุปออเดอร์ ส่ง QR พร้อมเพย์ และตรวจสลิปปิดการขายให้ร้านคุณ อัตโนมัติ 24 ชม.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "SudoChatBot" },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={noto.className}>{children}</body>
    </html>
  );
}
