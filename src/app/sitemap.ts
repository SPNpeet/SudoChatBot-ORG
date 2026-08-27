import type { MetadataRoute } from "next";
import { FEATURE_PAGES, GUIDE_PAGES } from "@/content/seo-pages";

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
    // ⚠️ หน้าเนื้อหาต้องมาจาก src/content/seo-pages.ts เท่านั้น (เพิ่ม 9 ส.ค. 2569)
    // เขียนรายชื่อ URL ซ้ำไว้ที่นี่เมื่อไหร่ = วันหน้าเพิ่มหน้าใหม่แล้วลืมใส่ sitemap
    // หน้านั้นจะไม่มีวันถูก Google เก็บ และไม่มีอะไรเตือนเลยสักอย่าง
    { url: `${SITE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE}/features`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/guide`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...FEATURE_PAGES.map((p) => ({
      url: `${SITE}/features/${p.slug}`,
      lastModified: new Date(p.updated),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...GUIDE_PAGES.map((p) => ({
      url: `${SITE}/guide/${p.slug}`,
      lastModified: new Date(p.updated),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // หน้าความเชื่อถือ — เครื่องมือตรวจ trust ของภายนอกมองหาสามหน้านี้ตรง ๆ (28 ส.ค. 2569)
    { url: `${SITE}/about`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE}/refund`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/data-deletion`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
