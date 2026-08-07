import type { NextConfig } from "next";

// ============================================================
//  ⚠️ Security headers (เพิ่ม 8 ส.ค. 2569 หลังตรวจของจริงแล้วพบว่ามีแค่ HSTS)
//
//  ระบบนี้เก็บข้อมูลบัญชี ภาษี และเลขผู้เสียภาษีของลูกค้าจริง
//  หัวข้อพวกนี้ไม่ได้ทำให้เว็บเร็วขึ้นหรือสวยขึ้น แต่ปิดช่องที่ใช้หลอกผู้ใช้ได้จริง:
//
//  · X-Frame-Options / frame-ancestors — กันคนเอาหน้าเราไปฝังใน iframe ของเว็บเขา
//    แล้ววางปุ่มปลอมทับ (clickjacking) ผู้ใช้คิดว่ากดปุ่มของเรา แต่จริง ๆ กดของเขา
//    อันตรายมากกับหน้าที่มีปุ่มยืนยันรับเงิน/อนุมัติค่าใช้จ่าย
//  · X-Content-Type-Options: nosniff — กันเบราว์เซอร์เดาชนิดไฟล์เอง
//    ไฟล์ที่ลูกค้าอัปโหลด (สลิป/บิล) จะไม่ถูกตีความเป็นสคริปต์
//  · Referrer-Policy — เดิมเบราว์เซอร์ส่ง URL เต็มไปเว็บปลายทางเวลาผู้ใช้กดลิงก์ออก
//    URL ของเรามีรหัสเอกสารอยู่ (/doc/<share_key>) = ลิงก์ลับหลุดไปเว็บอื่นได้
//  · Permissions-Policy — ปิดสิทธิ์ที่เว็บนี้ไม่ได้ใช้ (ไมค์/ตำแหน่ง) ไว้ก่อน
//    กล้องไม่ปิด เพราะหน้าถ่ายรูปบิลใช้จริง
// ============================================================
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), payment=()" },
  // frame-ancestors ทำงานแม้เบราว์เซอร์ที่เลิกสน X-Frame-Options แล้ว — ใส่คู่กันไว้
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.fbcdn.net" },
      { protocol: "https", hostname: "profile.line-scdn.net" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        // ⚠️ ไฟล์ใน public/ ถูกส่งมาพร้อม max-age=0, must-revalidate เป็นค่าเริ่มต้น
        // วัดจริง 8 ส.ค. 2569: /logo-mark.png (14 KB) ถูกขอใหม่ทุกครั้งที่เปิดหน้า
        // ทั้งที่เป็นรูปที่แทบไม่เคยเปลี่ยน — เสียเวลาผู้ใช้และค่า egress ฟรี ๆ
        //
        // ใช้ 1 วัน + stale-while-revalidate 7 วัน (ไม่ใช่ immutable)
        // เพราะชื่อไฟล์พวกนี้ไม่มี hash ต่อท้าย ถ้าตั้ง immutable แล้วเปลี่ยนโลโก้
        // ผู้ใช้เดิมจะเห็นของเก่าไปอีกนานโดยที่เราแก้อะไรไม่ได้เลย
        source: "/:file*.(png|jpg|jpeg|svg|webp|ico|woff2)",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
