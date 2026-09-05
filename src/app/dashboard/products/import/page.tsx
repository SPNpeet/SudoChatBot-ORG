import { getCurrentShop } from "@/lib/shop";
import ImportClient from "./import-client";
import { canManage } from "@/lib/roles";
import RoleWall from "../../role-wall";

export const dynamic = "force-dynamic";

export default async function ImportProductsPage() {
  const { shop, role } = await getCurrentShop();
  // importProducts ฝั่ง server รับเฉพาะเจ้าของ/ผู้ดูแล — อย่าให้อัปโหลดเสร็จแล้วค่อยรู้ว่าบันทึกไม่ได้
  if (!canManage(role)) return <RoleWall title="นำเข้าสินค้าทำได้เฉพาะเจ้าของหรือผู้ดูแล"
    detail="รายการสินค้าและราคาเป็นข้อมูลตั้งต้นของกิจการ — บทบาทพนักงานและผู้ชมเลือกใช้สินค้าตอนออกเอกสารได้ แต่เพิ่มหรือแก้รายการไม่ได้" />;
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-bold">นำเข้าสินค้าจากไฟล์</h1>
        <p className="text-sm text-neutral-400">
          อัปโหลด Excel/CSV หรือ PDF/รูปแคตตาล็อก — ระบบแปลงเป็นรายการสินค้าให้ตรวจก่อนบันทึก
        </p>
      </div>
      <ImportClient shopId={shop.id} />
    </div>
  );
}
