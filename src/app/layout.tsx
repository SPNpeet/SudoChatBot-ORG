import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });

const SITE = "https://sudochatbot.online";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "SudoChatBot — ระบบบัญชี + ผู้ช่วย AI ออกเอกสาร ภาษี ครบวงจร",
    template: "%s | SudoChatBot",
  },
  description: "ระบบบัญชีหลังบ้านที่สั่งด้วยภาษาคน: ออกใบแจ้งหนี้-ใบกำกับภาษี เก็บเงินผ่าน QR ตรวจสลิปอัตโนมัติ ถ่ายรูปบิลให้ AI ลงบัญชี สมุดรายวันอัตโนมัติ รายงาน ภ.พ.30/ภ.ง.ด. พร้อมยื่น — เริ่มฟรี",
  keywords: [
    "โปรแกรมบัญชี", "โปรแกรมบัญชีออนไลน์", "ออกใบกำกับภาษี", "ออกใบแจ้งหนี้", "ระบบบัญชี AI",
    "AP AR automation", "กระทบยอด statement", "ตรวจสลิปอัตโนมัติ", "หัก ณ ที่จ่าย 50 ทวิ",
    "ภ.พ.30", "ภ.ง.ด.3", "ภ.ง.ด.53", "สำนักงานบัญชี", "โปรแกรมบัญชี SME",
  ],
  alternates: { canonical: SITE },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: SITE,
    siteName: "SudoChatBot",
    title: "SudoChatBot — บัญชีทั้งบริษัท เสร็จด้วยการพิมพ์สั่ง",
    description: "ออกเอกสาร เก็บเงิน ตรวจสลิป ลงบัญชี สรุปภาษีพร้อมยื่น — ผู้ช่วยบัญชี AI ทำให้ครบในระบบเดียว เริ่มฟรี",
  },
  twitter: {
    card: "summary_large_image",
    title: "SudoChatBot — ระบบบัญชี + ผู้ช่วย AI",
    description: "ถ่ายรูปบิล = ลงบัญชีเสร็จ · ใบแจ้งหนี้ + QR เก็บเงิน · ภาษีพร้อมยื่น",
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

// JSON-LD ให้ Google เข้าใจว่าเราคือ SaaS ระบบบัญชี AI (โผล่ใน rich results ได้)
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "SudoChatBot",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE,
      description: "ระบบบัญชีและออกเอกสารครบวงจรสำหรับธุรกิจไทย พร้อมผู้ช่วย AI: ใบแจ้งหนี้ ใบกำกับภาษี ตรวจสลิป สมุดรายวันอัตโนมัติ รายงานภาษีพร้อมยื่น",
      offers: { "@type": "Offer", price: "0", priceCurrency: "THB", description: "เริ่มฟรี ไม่ต้องใช้บัตรเครดิต" },
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
