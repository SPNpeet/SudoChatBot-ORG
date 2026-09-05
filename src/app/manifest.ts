import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SudoChatBot — ระบบบัญชี + ผู้ช่วย AI",
    short_name: "SudoChatBot",
    description: "ระบบบัญชีและออกเอกสารครบวงจร พร้อมผู้ช่วย AI สำหรับธุรกิจไทย",
    // start_url คงเป็น /dashboard — คนติดตั้งแอปคือลูกค้าที่ล็อกอินแล้ว ถ้ายังไม่ล็อกอิน middleware พาไป /login เอง
    id: "/",
    scope: "/",
    lang: "th",
    dir: "ltr",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#059669",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // ไอคอนเต็มพื้นสีอยู่แล้ว (โลโก้กลางบนพื้นเขียว) ใช้เป็น maskable ได้โดยไม่ต้องทำไฟล์แยก
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
