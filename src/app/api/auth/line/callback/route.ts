import { handleLineLoginCallback } from "@/lib/line-login-flow";

// เส้นเดิม — ใช้ได้ทันทีถ้าวันหนึ่งเจ้าของเพิ่ม URL นี้ในคอนโซล LINE
// ตัวจัดการจริงอยู่ที่ src/lib/line-login-flow.ts เพราะ route ของ Next.js
// export อย่างอื่นนอกจาก handler ไม่ได้
export async function GET(request: Request) {
  return handleLineLoginCallback(request, `${new URL(request.url).origin}/api/auth/line/callback`);
}
