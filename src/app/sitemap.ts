import type { MetadataRoute } from "next";

const SITE = "https://sudochatbot.online";

// ============================================================
//  ⚠️ แก้ 8 ส.ค. 2569 — sitemap เดิมชี้ผิดทั้งสองทาง
//
//  มี /login อยู่ด้วย priority 0.8 ทั้งที่เป็นหน้าที่ไม่มีเนื้อหาให้ค้นหาเลย
//  (คนค้นเจอแล้วกดเข้ามาจะเจอแค่ช่องกรอกรหัสผ่าน) — ตอนนี้หน้านั้น noindex แล้ว
//  ใส่ไว้ใน sitemap ต่อ = บอก Google ให้ไปเก็บหน้าที่เราสั่งไม่ให้เก็บ ซึ่งขัดกันเอง
//
//  และ **ขาด /try** ซึ่งเป็นหน้าที่มีคุณค่าทาง SEO สูงที่สุดที่เรามี:
//  ออกใบเสนอราคา/ใบแจ้งหนี้ได้ฟรีโดยไม่ต้องสมัคร = ตรงกับสิ่งที่คนค้นหาจริง
//  ("ทำใบเสนอราคาออนไลน์ฟรี") และใช้งานได้ทันทีโดยไม่มีกำแพงสมัครสมาชิก
//  หน้าแบบนี้คือหน้าที่ควรถูกดันสุด แต่กลับไม่เคยบอก Google ว่ามีอยู่
// ============================================================
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    // เครื่องมือฟรีที่ใช้ได้เลยไม่ต้องสมัคร — ประตูหน้าที่ดีที่สุดของเว็บนี้
    { url: `${SITE}/try`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/data-deletion`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
