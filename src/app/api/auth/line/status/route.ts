import { NextResponse } from "next/server";
import { getLineLoginKeys } from "@/lib/line-login";

// ============================================================
//  บอก client ว่า LINE Login พร้อมใช้หรือยัง (ตั้ง env ครบหรือไม่)
//  ปุ่ม LINE จะโผล่เฉพาะเมื่อ enabled=true — ไม่มี env = หน้าเดิมไม่เปลี่ยนเลย
//  เจตนา: เจ้าของเปิดใช้ได้ด้วยการตั้งค่า Vercel env ล้วน ๆ ไม่ต้องแตะโค้ด
// ============================================================
export async function GET() {
  // ⚠️ อ่านจากที่เดียวกับเส้น /api/line/* (ดู src/lib/line-login.ts)
  // เดิมดูแต่ env ทำให้ปุ่มไม่เคยโผล่ ทั้งที่คีย์ถูกตั้งไว้ในหน้าแอดมินนานแล้ว
  const enabled = !!(await getLineLoginKeys());
  return NextResponse.json({ enabled });
}
