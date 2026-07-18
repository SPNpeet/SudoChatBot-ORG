import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });

const SITE = "https://sudochatbot.online";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "SudoChatBot — AI ปิดการขายอัตโนมัติ สำหรับ Facebook / IG / LINE",
    template: "%s | SudoChatBot",
  },
  description: "แชทบอท AI ที่ตอบลูกค้า แนะนำสินค้า สรุปออเดอร์ ส่ง QR พร้อมเพย์ และตรวจสลิปปิดการขายให้ร้านคุณ อัตโนมัติ 24 ชม. เริ่มฟรี 100 ข้อความ ไม่ต้องใช้บัตรเครดิต",
  keywords: [
    "แชทบอท", "แชทบอทตอบลูกค้า", "บอทขายของ", "แชทบอท facebook", "บอทตอบแชท line",
    "ระบบตอบแชทอัตโนมัติ", "AI ตอบลูกค้า", "ปิดการขายอัตโนมัติ", "แชทบอทร้านค้าออนไลน์",
    "chatbot ภาษาไทย", "ตรวจสลิปอัตโนมัติ", "แชทบอทขายของออนไลน์",
  ],
  alternates: { canonical: SITE },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: SITE,
    siteName: "SudoChatBot",
    title: "SudoChatBot — AI ปิดการขายให้ร้านคุณ ตั้งแต่ทักจนโอนเงิน",
    description: "เชื่อมเพจ Facebook, IG, LINE แล้วปล่อยให้ AI ตอบลูกค้า สรุปยอด ส่ง QR พร้อมเพย์ ตรวจสลิป — อัตโนมัติทั้งหมด เริ่มฟรี",
  },
  twitter: {
    card: "summary_large_image",
    title: "SudoChatBot — AI ปิดการขายอัตโนมัติ",
    description: "แชทบอท AI ขายของแทนคุณบน Facebook / IG / LINE ตอบไว เช็กสต๊อกจริง เก็บเงินจริง",
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
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

// JSON-LD ให้ Google เข้าใจว่าเราคือ SaaS แชทบอทขายของ (โผล่ใน rich results ได้)
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "SudoChatBot",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE,
      description: "แชทบอท AI ปิดการขายอัตโนมัติสำหรับร้านค้าออนไลน์ไทย บน Facebook Messenger, Instagram DM และ LINE OA",
      offers: { "@type": "Offer", price: "0", priceCurrency: "THB", description: "เริ่มฟรี ตอบ 100 ข้อความแรกไม่มีค่าใช้จ่าย" },
      inLanguage: "th",
    },
    {
      "@type": "Organization",
      name: "SudoChatBot",
      url: SITE,
      sameAs: [],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={noto.className}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {children}
      </body>
    </html>
  );
}
