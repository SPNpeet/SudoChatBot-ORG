"use server";
// ============================================================
//  สลับภาษาด้วย Server Action — ไม่ใช่ document.cookie ฝั่ง client
//
//  ⚠️ ของเดิมพัง (เจ้าของแจ้ง 19 ส.ค. 2569: "เปลี่ยนแล้วภาษาไม่เปลี่ยนเลย")
//  เดิมเขียน document.cookie แล้วเรียก router.refresh() ซึ่งไม่รับประกันว่า
//  จะได้ HTML ชุดใหม่จากเซิร์ฟเวอร์เสมอ — Router Cache ฝั่ง client อาจคืนของเดิม
//  ผลคือ cookie เปลี่ยนจริงแต่หน้าจอไม่ขยับ ผู้ใช้เห็นว่า "กดแล้วไม่มีอะไรเกิดขึ้น"
//
//  ตั้ง cookie ที่ฝั่งเซิร์ฟเวอร์แล้ว revalidatePath ทั้ง layout แทน
//  = เซิร์ฟเวอร์เป็นคนบอกว่าเนื้อหาเปลี่ยน ไม่ต้องหวังให้ client ยอมทิ้งแคชเอง
//  และเป็น <form> จริง จึงทำงานได้แม้ JavaScript ยังโหลดไม่เสร็จ
// ============================================================
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LANG_COOKIE } from "@/lib/i18n";

export async function setLang(formData: FormData) {
  const next = formData.get("lang") === "en" ? "en" : "th";
  (await cookies()).set(LANG_COOKIE, next, {
    path: "/",
    maxAge: 31536000,     // 1 ปี
    sameSite: "lax",
    httpOnly: false,      // ไม่ใช่ความลับ และเผื่อฝั่ง client อยากอ่านไปแสดงผล
  });
  revalidatePath("/", "layout");
}
