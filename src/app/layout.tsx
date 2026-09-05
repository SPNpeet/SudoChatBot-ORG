import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

// IBM Plex Sans Thai — ออกแบบมาเพื่องานธุรกิจ/เอกสารโดยเฉพาะ ตัวเลขคมและกว้างเท่ากันทุกตัว
// (สำคัญมากกับตารางเงิน: หลักหน่วย-สิบ-ร้อย ตรงคอลัมน์กันเป๊ะ) — โหลดผ่าน next/font จึงไม่มี
// request ออกนอกโดเมนตอนผู้ใช้เปิดเว็บ และไม่มี layout shift
const font = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const SITE = "https://sudochatbot.online";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "SudoChatBot — ระบบบัญชี + ผู้ช่วย AI ออกเอกสาร ภาษี ครบวงจร",
    template: "%s | SudoChatBot",
  },
  // ⚠️ ต้องไม่เกิน ~160 ตัวอักษร — ของเดิม 182 ตัว Google ตัดท้ายทิ้ง
  // ประโยคปิดที่สำคัญที่สุด ("เริ่มฟรี") จึงไม่เคยถูกแสดงในหน้าผลค้นหาเลย
  description: "ระบบบัญชีออนไลน์ + ผู้ช่วย AI สำหรับ SME ไทย: ออกใบแจ้งหนี้-ใบกำกับภาษี เก็บเงินผ่าน QR ตรวจสลิปอัตโนมัติ ถ่ายรูปบิลให้ AI ลงบัญชี รายงานภาษีพร้อมยื่น เริ่มฟรี",
  keywords: [
    "โปรแกรมบัญชี", "โปรแกรมบัญชีออนไลน์", "ออกใบกำกับภาษี", "ออกใบแจ้งหนี้", "ระบบบัญชี AI",
    "AP AR automation", "กระทบยอด statement", "ตรวจสลิปอัตโนมัติ", "หัก ณ ที่จ่าย 50 ทวิ",
    "ภ.พ.30", "ภ.ง.ด.3", "ภ.ง.ด.53", "สำนักงานบัญชี", "โปรแกรมบัญชี SME",
  ],
  // ⚠️ ห้ามตั้ง canonical ที่ layout (แก้ 8 ส.ค. 2569)
  // canonical ใน layout ถูกสืบทอดไปทุกหน้าที่ไม่ได้ตั้งของตัวเอง
  // ผลจริงที่วัดได้: /privacy และ /login ประกาศ canonical เป็นหน้าแรก
  // = บอก Google ตรง ๆ ว่า "หน้านี้คือสำเนาของหน้าแรก" ซึ่งทำให้หน้าเหล่านั้น
  // ถูกตัดออกจากดัชนี และหน้าแรกก็ไม่ได้อะไรเพิ่มด้วย
  // ให้แต่ละหน้าประกาศ canonical ของตัวเอง (หน้าแรกอยู่ใน src/app/page.tsx)
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
  // ⚠️ ห้ามใส่ maximumScale: 1 (เอาออก 8 ส.ค. 2569)
  // มันปิดการซูมด้วยนิ้วบนมือถือทั้งหน้า — คนสายตาไม่ดีขยายอ่านตัวเลขในเอกสารไม่ได้เลย
  // ผิดเกณฑ์การเข้าถึง (WCAG 1.4.4) และเป็นข้อที่ Lighthouse ตัดคะแนน
  // เหตุผลเดียวที่คนใส่กันคือกัน iOS ซูมเองตอนแตะช่องกรอก
  // ซึ่งเราแก้ถูกจุดแล้วด้วยการบังคับ font-size 16px บน iOS (ดู globals.css)
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
      // ราคาเต็มทุกแพ็กอยู่ใน Product schema ของ /pricing (ดึงจากตาราง plans) — ที่นี่บอกแค่ "เริ่มฟรี" และชี้ไปหน้านั้น
      offers: { "@type": "Offer", price: "0", priceCurrency: "THB", description: "เริ่มฟรี ไม่ต้องใช้บัตรเครดิต", url: `${SITE}/pricing` },
      image: `${SITE}/opengraph-image`,
      inLanguage: "th",
    },
    {
      // ⚠️ WebSite ช่วยให้เครื่องมือค้นหาและผู้ช่วย AI รู้ว่า "ชื่อเว็บนี้คืออะไร"
      // ไม่มีอันนี้ บางเจ้าจะเดาชื่อจาก <title> ซึ่งมีคำโฆษณาปนอยู่
      "@type": "WebSite",
      name: "SudoChatBot",
      url: SITE,
      inLanguage: "th",
      description: "ระบบบัญชีออนไลน์และผู้ช่วยบัญชี AI สำหรับ SME ไทย",
    },
    {
      "@type": "Organization",
      name: "SudoChatBot",
      url: SITE,
      logo: `${SITE}/icon-512.png`,
      email: "support@sudochatbot.online",
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "support@sudochatbot.online", availableLanguage: ["th", "en"] },
      // ห้ามใส่ sameAs ว่าง — เครื่องมือตรวจ schema นับเป็น property ที่ผิดรูป ใส่เมื่อมีเพจโซเชียลจริงเท่านั้น
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${font.className} antialiased`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {children}
      </body>
    </html>
  );
}
