import { NextResponse } from "next/server";

// ============================================================
//  บอก client ว่า LINE Login พร้อมใช้หรือยัง (ตั้ง env ครบหรือไม่)
//  ปุ่ม LINE จะโผล่เฉพาะเมื่อ enabled=true — ไม่มี env = หน้าเดิมไม่เปลี่ยนเลย
//  เจตนา: เจ้าของเปิดใช้ได้ด้วยการตั้งค่า Vercel env ล้วน ๆ ไม่ต้องแตะโค้ด
// ============================================================
export async function GET() {
  const enabled = !!(process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET);
  return NextResponse.json({ enabled });
}
