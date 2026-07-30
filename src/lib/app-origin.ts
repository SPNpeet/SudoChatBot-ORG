/**
 * โดเมนหลักของระบบ — ใช้กับทุกอย่างที่ต้อง "ตรงเป๊ะ" กับที่ลงทะเบียนไว้ที่ผู้ให้บริการภายนอก
 * (LINE Login callback, ลิงก์ในข้อความแจ้งเตือน, Rich Menu)
 *
 * เหตุผล: เว็บเข้าถึงได้หลายโดเมน (sudochatbot.online และ *.vercel.app)
 * ถ้าสร้าง redirect_uri จาก request origin ตรงๆ คนที่เผลอเปิดจาก vercel.app
 * จะโดน LINE ตีกลับ "400 Invalid redirect_uri" ทันที — เคยเกิดจริงมาแล้ว
 */
export const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_ORIGIN || "https://sudochatbot.online").replace(/\/$/, "");

export const LINE_CALLBACK_URL = `${APP_ORIGIN}/api/line/callback`;

/**
 * origin สำหรับลิงก์ที่ Supabase Auth จะพากลับมา (ยืนยันอีเมล / ตั้งรหัสผ่านใหม่ / OAuth)
 *
 * ทำไมไม่ใช้ window.location.origin ตรง ๆ: เว็บเปิดได้ทั้ง sudochatbot.online และ *.vercel.app
 * ใครเผลอเปิดจาก vercel.app แล้วกดลืมรหัสผ่าน จะได้ลิงก์ในอีเมลเป็นโดเมน vercel.app
 * ซึ่งเป็นโดเมนที่เราไม่ได้ใช้จริง — บั๊กชนิดเดียวกับ LINE callback ข้างบนที่แก้ไปนานแล้ว
 * แต่ตอนนั้นแก้แค่จุดของ LINE ไม่ได้กวาดดูว่าฝั่ง Auth มีปัญหาเดียวกันอยู่ด้วย
 *
 * ⚠️ ยกเว้น localhost ให้ใช้ origin ของตัวเอง ไม่งั้นทดสอบล็อกอินในเครื่องจะถูกเด้งไป production
 */
export function authOrigin(): string {
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return window.location.origin;
  }
  return APP_ORIGIN;
}
