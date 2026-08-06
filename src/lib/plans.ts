// ============================================================
//  ราคาแพ็กเกจ — แหล่งความจริงเดียวคือตาราง plans ในฐานข้อมูล
//
//  ⚠️ ทำไมต้องมีไฟล์นี้ (พบ 6 ส.ค. 2569)
//  เดิมหน้าแรกเขียนราคา/สิทธิ์ของแต่ละแพ็กไว้เป็นค่าคงที่ในไฟล์ พร้อมคอมเมนต์ว่า
//  "แก้ราคาต้องแก้ทั้งสองที่" ซึ่งชนกติกาโปรเจกต์ตรง ๆ (กฎต้องอยู่ที่เดียว)
//  ผลที่เกิดจริง: ฐานข้อมูลมีแพ็กเปิดขาย 5 แพ็ก แต่หน้าแรกโชว์ 4
//  แพ็กฟรีหายไปทั้งที่หัวข้อเขียนว่า "เริ่มฟรี" — ลูกค้าอ่านแล้วงงว่าตกลงมีฟรีไหม
//
//  ราคาคือสิ่งที่ผู้ใช้ใช้ตัดสินใจจ่ายเงิน ตัวเลขสองที่ที่ไม่ตรงกัน
//  ไม่ใช่แค่ "ไม่สวย" แต่คือการโฆษณาไม่ตรงกับที่เก็บเงินจริง
//
//  ⚠️ ค่าสำรอง (FALLBACK) ไม่ใช่แหล่งความจริงที่สอง — เป็นเรือชูชีพเฉย ๆ
//  หน้าแรกคือหน้าที่ห้ามล่มที่สุด ถ้าฐานข้อมูลตอบไม่ได้ต้องยังมีราคาให้อ่าน
//  ค่าใน FALLBACK ตรงกับฐานข้อมูล ณ 6 ส.ค. 2569
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";

export interface PublicPlan {
  code: string;
  name: string;
  /** ราคาต่อเดือน เป็นตัวเลขล้วนพร้อมคั่นหลักพัน เช่น "1,990" */
  price: string;
  /** ราคารายปี = จ่าย 10 เดือน ใช้ 12 เดือน · แพ็กฟรีไม่มี */
  yearly?: string;
  items: string[];
  hot: boolean;
  free: boolean;
}

const num = (n: number) => n.toLocaleString("th-TH");

const FALLBACK: PublicPlan[] = [
  { code: "free", name: "ทดลองใช้", price: "0", items: ["1 กิจการ", "ออกเอกสาร/บัญชี คีย์เองไม่จำกัด", "งาน AI 15 คำสั่ง/เดือน", "ตรวจสลิปอัตโนมัติ 10 สลิป/เดือน", "พนักงานไม่จำกัด"], hot: false, free: true },
  { code: "starter", name: "เริ่มต้น", price: "99", yearly: "990", items: ["1 กิจการ", "ออกเอกสาร/บัญชี/ภาษี ครบ คีย์เองไม่จำกัด", "งาน AI 100 คำสั่ง/เดือน", "ตรวจสลิปอัตโนมัติ 100 สลิป/เดือน", "พนักงานไม่จำกัด"], hot: false, free: false },
  { code: "professional", name: "ธุรกิจ", price: "199", yearly: "1,990", items: ["สูงสุด 3 กิจการ (แชร์โควตาร่วมกัน)", "สมุดรายวัน + 50 ทวิ + AI อ่านบิล", "งาน AI 400 คำสั่ง/เดือน", "ตรวจสลิปอัตโนมัติ 200 สลิป/เดือน", "ถูกกว่าเจ้าตลาด และได้ผู้ช่วย AI ที่เขาไม่มี"], hot: true, free: false },
  { code: "executive", name: "สำนักงานบัญชี", price: "499", yearly: "4,990", items: ["สูงสุด 10 กิจการ", "ไฟล์ยื่นสรรพากร ภ.พ.30 / ภ.ง.ด. (.txt)", "งาน AI 1,000 คำสั่ง/เดือน", "ตรวจสลิปอัตโนมัติ 500 สลิป/เดือน", "ชุดส่งนักบัญชี Excel ครบงวด"], hot: false, free: false },
  { code: "agency", name: "สำนักงานบัญชีใหญ่", price: "999", yearly: "9,990", items: ["ไม่จำกัดจำนวนกิจการ", "ทุกอย่างในสำนักงานบัญชี", "งาน AI 3,000 คำสั่ง/เดือน", "ตรวจสลิปอัตโนมัติไม่จำกัด", "Audit Log + แยกข้อมูลลูกค้าเด็ดขาด (RLS)"], hot: false, free: false },
];

/** แพ็กที่เปิดขายจริง เรียงตาม sort — ใช้ทั้งหน้าแรกและที่อื่นที่ต้องโชว์ราคาให้คนนอกดู */
export async function getPublicPlans(): Promise<PublicPlan[]> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc.from("plans")
      .select("code,name,price_monthly,features,active,sort").eq("active", true).order("sort");
    if (error || !data || data.length === 0) return FALLBACK;
    return data.map((p) => {
      const price = Number(p.price_monthly);
      return {
        code: p.code,
        name: p.name,
        price: num(price),
        // รายปีคิดจากราคาจริงเสมอ ห้ามเขียนเลขรายปีแยกไว้ — สูตรเดียวกับ apply_plan_purchase
        yearly: price > 0 ? num(price * 10) : undefined,
        items: Array.isArray(p.features) ? (p.features as string[]) : [],
        // แพ็กที่อยากให้คนเลือก = แพ็กกลางที่รองรับหลายกิจการ
        hot: p.code === "professional",
        free: price <= 0,
      };
    });
  } catch {
    return FALLBACK;
  }
}
