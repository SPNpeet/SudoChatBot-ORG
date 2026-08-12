// ============================================================
//  แอป Android / iOS — เปลือกเนทีฟที่ห่อเว็บจริง
//
//  ⚠️ ทำไม `server.url` ชี้ไปเว็บจริง แทนที่จะ bundle หน้าเว็บลงแอป
//  นี่คือการตัดสินใจที่สำคัญที่สุดของฝั่งแอป และเป็นเรื่องเฉพาะทางของโปรดักต์บัญชี:
//  อัตรา VAT มีวันหมดอายุ และกฎภาษีเปลี่ยนได้ทุกเมื่อ ถ้า bundle ตรรกะลงแอป
//  ผู้ใช้ที่ไม่กดอัปเดตจะ "ออกเอกสารผิดกฎหมายต่อไปเรื่อย ๆ" โดยไม่รู้ตัว
//  ชี้ URL จริง = แก้ที่ server แล้วถึงมือทุกคนทันที เหมือนเว็บ
//
//  แลกมาด้วย: ต้องมีเน็ตถึงใช้ได้ ซึ่งยอมรับได้ เพราะงานบัญชีต้องเขียนฐานข้อมูลอยู่แล้ว
//  และการทำงานออฟไลน์ในระบบบัญชีคือบ่อเกิดของการลงบัญชีซ้ำ/ชนกัน
//
//  ⚠️ ห้ามใส่ปุ่มสมัคร/จ่ายเงินในแอป — ดู docs/MOBILE-APP-PLAN.md ข้อ 5.1
// ============================================================
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "online.sudochatbot.app",
  appName: "SudoChatBot",
  // เว็บถูก build โดย Next.js บน Vercel ไม่ได้ถูกห่อลงแอป
  // โฟลเดอร์นี้มีแค่หน้าสำรองตอนเน็ตหลุด (ดู mobile/www/index.html)
  webDir: "mobile/www",
  server: {
    url: process.env.CAP_SERVER_URL ?? "https://sudochatbot.online",
    cleartext: false,
    // กันไม่ให้ลิงก์ภายนอกเปิดในเปลือกแอป — ต้องเด้งออกเบราว์เซอร์จริง
    // สำคัญกับหน้าจ่ายเงินของ Stripe: ต้องให้ผู้ใช้เห็นแถบที่อยู่เว็บและกุญแจ
    allowNavigation: ["sudochatbot.online", "*.sudochatbot.online"],
  },
  android: {
    // ไม่อนุญาต http ธรรมดาเด็ดขาด — ข้อมูลบัญชีวิ่งผ่านสายนี้
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
    // แถบสถานะไม่ทับเนื้อหา
    scrollEnabled: true,
  },
  plugins: {
    PushNotifications: {
      // แจ้งเตือนเรื่องเงิน/กำหนดยื่นภาษี ต้องเด้งให้เห็นจริง ไม่ใช่เงียบ ๆ
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
