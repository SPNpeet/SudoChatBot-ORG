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
import { unstable_noStore as noStore } from "next/cache";
import { PLAN_NAME_TH } from "@/lib/plan-names";

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
  // ⚠️ ต้องตรงกับตาราง plans หลัง migration 113 ทุกตัวอักษร (ราคา · เครดิต · สิทธิ์)
  { code: "free", name: PLAN_NAME_TH.free, price: "0", items: ["1 กิจการ · พนักงานไม่จำกัด", "ออกเอกสาร ลงบัญชี รายงานภาษี คีย์เองไม่จำกัด", "เครดิต AI 60/เดือน (สั่งงานได้ราว 60 ครั้ง หรืออ่านบิล 30 ใบ)", "ตรวจสลิปอัตโนมัติ 10 สลิป/เดือน"], hot: false, free: true },
  { code: "starter", name: PLAN_NAME_TH.starter, price: "199", yearly: "1,990", items: ["1 กิจการ · พนักงานไม่จำกัด", "ทุกอย่างในทดลองใช้ + แจ้งเตือน LINE", "เครดิต AI 400/เดือน", "ตรวจสลิปอัตโนมัติ 100 สลิป/เดือน", "เติมเครดิตเพิ่มได้ 1 บาท/เครดิต"], hot: false, free: false },
  { code: "professional", name: PLAN_NAME_TH.professional, price: "499", yearly: "4,990", items: ["สูงสุด 3 กิจการ (แชร์เครดิตร่วมกัน)", "ทุกอย่างในเริ่มต้น + ชุดส่งนักบัญชี Excel ครบงวด", "เครดิต AI 1,500/เดือน", "ตรวจสลิปอัตโนมัติ 500 สลิป/เดือน", "ถูกกว่าเจ้าตลาด และได้ผู้ช่วย AI ที่เขาไม่มี"], hot: true, free: false },
  { code: "executive", name: PLAN_NAME_TH.executive, price: "1,290", yearly: "12,900", items: ["สูงสุด 15 กิจการ", "ทุกอย่างในธุรกิจ + ไฟล์ยื่นสรรพากร ภ.พ.30 / ภ.ง.ด. (.txt)", "เครดิต AI 5,000/เดือน", "ตรวจสลิปอัตโนมัติ 2,000 สลิป/เดือน", "Audit Log ครบทุกรายการ"], hot: false, free: false },
  { code: "agency", name: PLAN_NAME_TH.agency, price: "2,990", yearly: "29,900", items: ["ไม่จำกัดจำนวนกิจการ", "ทุกอย่างในสำนักงานบัญชี", "เครดิต AI 15,000/เดือน", "ตรวจสลิปอัตโนมัติไม่จำกัด", "แยกข้อมูลลูกค้าเด็ดขาด (RLS) + ดูแลเฉพาะทาง"], hot: false, free: false },
];

/** แพ็กที่เปิดขายจริง เรียงตาม sort — ใช้ทั้งหน้าแรกและที่อื่นที่ต้องโชว์ราคาให้คนนอกดู */
export async function getPublicPlans(): Promise<PublicPlan[]> {
  // ⚠️ ราคาห้ามค้างในแคช (5 ก.ย. 2569): หลังเปลี่ยนราคาใน DB แล้ว build ใหม่ หน้าราคายังโชว์
  // ราคาเก่าทั้งชุด เพราะ fetch cache ของ Next เก็บผลคิวรีข้าม build — คนเห็นราคาหนึ่ง
  // แต่ระบบคิดอีกราคา = ปัญหาเงินโดยตรง ดึงสดทุกครั้ง (หน้าราคาช้าลงไม่กี่สิบ ms ยอมได้)
  noStore();
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
