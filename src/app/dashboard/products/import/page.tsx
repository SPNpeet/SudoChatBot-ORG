import { getCurrentShop } from "@/lib/shop";
import ImportClient from "./import-client";

export const dynamic = "force-dynamic";

export default async function ImportProductsPage() {
  const { shop } = await getCurrentShop();
  return (
    <div className="max-w-5xl space-y-5">
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
