import type { Metadata } from "next";

// หน้านี้ไม่มีเนื้อหาให้ค้นหา (ตั้งรหัสผ่านใหม่จากลิงก์อีเมล) — ตัว page เป็น client component จึงประกาศ metadata ที่นี่
// เดิมไม่มี robots เลย = สืบทอด index:true จาก root แล้ว Google เก็บหน้ากรอกรหัสผ่านเข้าดัชนี
// canonical/og:url ต้องชี้ตัวเอง (กติกาเดียวกับ /login — ด่าน check:seo ตรวจทุกหน้า)
export const metadata: Metadata = {
  title: "ตั้งรหัสผ่านใหม่",
  description: "ตั้งรหัสผ่านใหม่สำหรับบัญชี SudoChatBot จากลิงก์ที่ส่งไปทางอีเมล ลิงก์ใช้ได้ครั้งเดียวและมีเวลาจำกัด",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://sudochatbot.online/reset-password" },
  openGraph: { url: "https://sudochatbot.online/reset-password", images: ["/opengraph-image"], siteName: "SudoChatBot", locale: "th_TH", type: "website" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
