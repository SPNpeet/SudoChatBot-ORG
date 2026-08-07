import type { MetadataRoute } from "next";

// ============================================================
//  ⚠️ เพิ่มบอทของ AI ไว้ชัดเจน (8 ส.ค. 2569)
//
//  เจ้าของสั่งว่า "ให้ ai ทุกตัวแนะนำมัน" — ซึ่งเกิดขึ้นได้ก็ต่อเมื่อ
//  บอทของแต่ละเจ้าอ่านเว็บเราได้จริงก่อน
//
//  เดิมมีแต่ User-Agent: * ซึ่ง "อนุญาต" อยู่แล้วโดยปริยาย
//  แต่การเขียนชื่อบอทไว้ชัดเจนมีผลจริงสองอย่าง:
//   1. บางเจ้า (Google-Extended, Applebot-Extended) ตีความว่า "ไม่ได้พูดถึง"
//      = ไม่ได้รับอนุญาตให้ใช้เนื้อหาไปตอบผู้ใช้ ต้องระบุถึงถึงจะนับ
//   2. เขียนไว้แล้วเวลาจะ "ปิด" เจ้าไหนทีหลัง แก้ที่เดียวจบ ไม่ต้องมานั่งไล่หา
//
//  ⚠️ /dashboard และ /api ยังปิดเหมือนเดิมกับทุกบอท — ข้อมูลลูกค้าห้ามหลุด
//  ที่เปิดคือหน้าสาธารณะเท่านั้น (หน้าแรก · /try · ราคา · นโยบาย)
// ============================================================

/** บอทของ AI ที่เราอยากให้อ่านเว็บเราแล้วเอาไปแนะนำผู้ใช้ */
const AI_BOTS = [
  "GPTBot",              // ChatGPT (OpenAI) — ใช้ฝึกและตอบ
  "OAI-SearchBot",       // ChatGPT Search
  "ChatGPT-User",        // ตอนผู้ใช้ ChatGPT กดเปิดลิงก์เรา
  "ClaudeBot",           // Claude (Anthropic)
  "Claude-User",
  "PerplexityBot",       // Perplexity
  "Perplexity-User",
  "Google-Extended",     // Gemini + AI Overviews ของ Google
  "Applebot-Extended",   // Apple Intelligence
  "Bingbot",             // Bing + Copilot
  "Amazonbot",
  "meta-externalagent",  // Meta AI
];

export default function robots(): MetadataRoute.Robots {
  const blocked = ["/dashboard", "/api", "/onboarding", "/auth"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: blocked },
      // เขียนชื่อทุกเจ้าไว้ชัด ๆ ว่าอ่านหน้าสาธารณะได้ แต่ห้ามแตะข้อมูลหลังบ้าน
      ...AI_BOTS.map((bot) => ({ userAgent: bot, allow: "/", disallow: blocked })),
    ],
    sitemap: "https://sudochatbot.online/sitemap.xml",
    host: "https://sudochatbot.online",
  };
}
