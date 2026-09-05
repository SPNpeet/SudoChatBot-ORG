import type { Metadata } from "next";

// หน้านี้ไม่มีเนื้อหาให้ค้นหา (ขอลิงก์ตั้งรหัสผ่านใหม่) — ตัว page เป็น client component จึงประกาศ metadata ที่นี่
// เดิมไม่มี robots เลย = สืบทอด index:true จาก root แล้ว Google เก็บหน้ากรอกรหัสผ่านเข้าดัชนี
// canonical/og:url ต้องชี้ตัวเอง (กติกาเดียวกับ /login — ด่าน check:seo ตรวจทุกหน้า)
export const metadata: Metadata = {
  title: "ลืมรหัสผ่าน",
  description: "ขอลิงก์ตั้งรหัสผ่านใหม่ของ SudoChatBot ทางอีเมล — ใช้ได้เมื่อจำรหัสผ่านไม่ได้หรือต้องการเปลี่ยนรหัสผ่าน",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://sudochatbot.online/forgot-password" },
  openGraph: { url: "https://sudochatbot.online/forgot-password", images: ["/opengraph-image"], siteName: "SudoChatBot", locale: "th_TH", type: "website" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
