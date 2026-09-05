// ============================================================
//  คำเรียกสิทธิ์ในกิจการ — ต้องอยู่ในไฟล์ที่ไม่ใช่ "use client"
//
//  ⚠️ เคยพลาดมาแล้ว: ถ้าเขียนไว้ในไฟล์ที่ขึ้นต้นด้วย "use client"
//  แล้ว Server Component ไป import มาใช้ Next จะแปลง export ทุกตัวเป็น
//  client reference — เรียกจากฝั่งเซิร์ฟเวอร์แล้วพังตอนรันจริง
//  โดยที่ build ผ่านสบาย เพราะหน้าพวกนี้เป็น force-dynamic จึงไม่ถูก render ตอน build
// ============================================================
export const roleLabel = (r: string) =>
  r === "owner" ? "เจ้าของ" : r === "admin" ? "ผู้ดูแล" : r === "agent" ? "พนักงาน" : "ผู้ชม";

// บทบาทที่เชิญเข้ากิจการได้ — "owner" ตั้งได้จากการสร้างกิจการเท่านั้น
// (เคยรับค่าจากฟอร์มตรง ๆ: ผู้ดูแลแก้ HTML ให้ตัวเองเป็น owner ได้)
export const INVITABLE_ROLES = ["admin", "agent", "viewer"] as const;

// สิทธิ์ที่หน้าบ้านใช้ซ่อน/แสดง — ต้องสะท้อน assertMember ฝั่ง server เท่านั้น ห้ามกว้างกว่า
// ปุ่มที่กดแล้ว server ปฏิเสธ = ผู้ใช้เข้าใจว่าระบบพัง ไม่ใช่ว่าตัวเองไม่มีสิทธิ์
export const canManage = (r: string) => r === "owner" || r === "admin";
export const canWork = (r: string) => r === "owner" || r === "admin" || r === "agent";
// พนักงาน (agent) มาทำงานเอกสาร ไม่เห็นเงินรวม/รายงาน/แพ็กเกจ — กติกาเดียวกับหน้าภาพรวม
export const canSeeMoney = (r: string) => r !== "agent";
// เมนูที่ซ่อนตามบทบาท — หน้าปลายทางมีด่านของตัวเองอยู่แล้ว ซ่อนเพื่อไม่ให้กดแล้วเจอกำแพง
export function navHiddenFor(role: string): string[] {
  if (role === "agent") return ["/dashboard/reports", "/dashboard/billing"];
  return [];
}
