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
