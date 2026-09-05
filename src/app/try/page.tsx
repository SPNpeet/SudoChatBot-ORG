// ============================================================
//  หน้าลองใช้ก่อนสมัคร — ออกเอกสารได้จริงโดยไม่ต้องมีบัญชี
//
//  ที่มา: เจ้าของเทียบกับระบบคู่แข่งแล้วพบว่าเขาให้ "ลองก่อน" ได้
//  ของเราต้องสมัคร -> ยืนยันอีเมล -> ตั้งค่ากิจการ ถึงจะเห็นว่าออกเอกสารสวยไหม
//  คนที่ยังไม่เชื่อว่าระบบดีจะไม่ยอมผ่าน 3 ด่านนั้น
//
//  ไม่มี force-dynamic โดยตั้งใจ — หน้านี้เป็น static ล้วน ไม่แตะฐานข้อมูล
//  ไม่นับโควตา AI ไม่สร้างแถวใด ๆ จึงไม่มีทางถูกยิงให้เสียเงิน
// ============================================================
import type { Metadata } from "next";
import TryDocEditor from "./doc-editor";

export const metadata: Metadata = {
  // layout แม่ต่อท้าย " | SudoChatBot" ให้อยู่แล้ว (template) — ใส่เองซ้ำจะได้ชื่อซ้ำสองรอบ
  title: "ลองออกใบเสนอราคา/ใบแจ้งหนี้ฟรี ไม่ต้องสมัคร",
  description:
    "พิมพ์ลงบนตัวเอกสารได้เลย เห็นหน้าตาจริงทันที คำนวณ VAT 7% และตัวอักษรจำนวนเงินให้อัตโนมัติ สั่งพิมพ์หรือบันทึก PDF ได้ฟรี ไม่ต้องสมัครสมาชิก",
  alternates: { canonical: "https://sudochatbot.online/try" },
  // og:url ต้องตรง canonical เสมอ — เดิมสืบทอด url หน้าแรกจาก root (ตรวจพบ 5 ก.ย. 2569 ทุกหน้า)
  openGraph: { url: "https://sudochatbot.online/try", images: ["/opengraph-image"], siteName: "SudoChatBot", locale: "th_TH", type: "website" },
};

export default function TryPage() {
  return <TryDocEditor />;
}
