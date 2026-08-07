import type { Metadata } from "next";

// ============================================================
//  ⚠️ หน้าเข้าสู่ระบบต้องไม่ถูกเก็บเข้าดัชนี Google (8 ส.ค. 2569)
//
//  เดิมหน้านี้ใช้ title/description ของหน้าแรกทั้งดุ้น และ canonical ก็ชี้หน้าแรก
//  ผลคือ Google เห็นสามหน้า (/ , /login , /signup) ที่มีชื่อและคำอธิบายเหมือนกันเป๊ะ
//  = สัญญาณหน้าซ้ำ ซึ่งทำให้หน้าแรกเสียน้ำหนักไปด้วย
//
//  หน้าล็อกอินไม่มีเนื้อหาให้คนค้นหา — คนที่ค้นหาเจอแล้วกดเข้ามาจะเจอแค่ช่องกรอกรหัสผ่าน
//  จึงเป็นหน้าที่ควร noindex แต่ยัง follow (ให้เก็บลิงก์ต่อไปหน้าอื่นได้)
// ============================================================
export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
  description: "เข้าสู่ระบบ SudoChatBot เพื่อจัดการเอกสาร บัญชี และภาษีของกิจการคุณ",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://sudochatbot.online/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
