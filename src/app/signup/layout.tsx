import type { Metadata } from "next";

// ============================================================
//  หน้าสมัคร — เป็นหน้าที่คนค้นหา "โปรแกรมบัญชีฟรี" แล้วควรเจอ
//  จึงเก็บเข้าดัชนีได้ แต่ต้องมีชื่อ/คำอธิบายเป็นของตัวเอง
//  ไม่ใช่ใช้ของหน้าแรกซ้ำ (เดิมซ้ำกันเป๊ะทั้งสามหน้า = สัญญาณหน้าซ้ำต่อ Google)
// ============================================================
export const metadata: Metadata = {
  title: "สมัครใช้ฟรี ไม่ต้องใช้บัตรเครดิต",
  description: "สมัครใช้ SudoChatBot ฟรี — ออกใบแจ้งหนี้/ใบกำกับภาษี ถ่ายรูปบิลให้ AI ลงบัญชี เก็บเงินผ่าน QR และรายงานภาษีพร้อมยื่น เริ่มใช้ได้ทันทีไม่ต้องรออีเมลยืนยัน",
  alternates: { canonical: "https://sudochatbot.online/signup" },
  openGraph: {
    title: "สมัครใช้ SudoChatBot ฟรี — ระบบบัญชี + ผู้ช่วย AI",
    description: "ออกเอกสาร เก็บเงิน ลงบัญชี สรุปภาษี ครบในระบบเดียว เริ่มฟรีไม่ต้องใช้บัตรเครดิต",
    url: "https://sudochatbot.online/signup",
    type: "website", siteName: "SudoChatBot", locale: "th_TH", images: ["/opengraph-image"],
  },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
