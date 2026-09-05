import type { Metadata } from "next";

// หน้านี้ไม่มีเนื้อหาให้ค้นหา (ทางเข้าจาก LINE เด้งต่อไปหน้าปลายทางทันที) — ตัว page เป็น client component จึงประกาศ metadata ที่นี่
// เดิมไม่มี robots เลย = สืบทอด index:true จาก root แล้ว Google เก็บหน้ากรอกรหัสผ่านเข้าดัชนี
// canonical/og:url ต้องชี้ตัวเอง (กติกาเดียวกับ /login — ด่าน check:seo ตรวจทุกหน้า)
export const metadata: Metadata = {
  title: "กำลังเปิดจาก LINE",
  description: "ทางเข้าระบบบัญชี SudoChatBot จากเมนูในแชท LINE — เปิดแล้วพาไปหน้าปลายทางในระบบให้อัตโนมัติ",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://sudochatbot.online/liff" },
  openGraph: { url: "https://sudochatbot.online/liff", images: ["/opengraph-image"], siteName: "SudoChatBot", locale: "th_TH", type: "website" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
