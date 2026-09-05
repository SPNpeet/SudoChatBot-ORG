import { getCurrentShop } from "@/lib/shop";
import DocForm from "../../finance/doc-form";
import { DOC_TYPE_TH } from "@/lib/finance";
import type { Contact, DocType } from "@/lib/types/finance";
import { canWork } from "@/lib/roles";
import RoleWall from "../../role-wall";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function NewSalesDocPage({ searchParams }: { searchParams: Promise<{ type?: string; contact?: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  if (!canWork(role)) return <RoleWall title="บทบาทผู้ชมออกเอกสารไม่ได้"
    detail="บัญชีนี้ได้รับสิทธิ์ดูข้อมูลอย่างเดียว — ถ้าต้องออกเอกสารหรือบันทึกรายการ ให้เจ้าของเปลี่ยนบทบาทเป็นพนักงานที่ ตั้งค่า > ทีม" />;
  const { type, contact } = await searchParams;
  const docType: DocType = type === "quotation" || type === "receipt" ? type : "invoice";

  const [{ data: contacts }, { data: products }] = await Promise.all([
    supabase.from("contacts").select("*").eq("shop_id", shop.id).eq("status", "active").order("name"),
    supabase.from("products").select("id,name,price,stock,track_stock").eq("shop_id", shop.id).eq("status", "active").order("name").limit(300),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">ออกเอกสารขาย</h1>
        <p className="text-sm text-neutral-400">
          {docType === "receipt"
            ? "ขายสด — รับเงินทันที ระบบบันทึกเงินเข้า ตัดสต๊อก และลงบัญชีให้ครบ"
            : docType === "invoice"
              ? "ขายเชื่อ — ระบบตั้งลูกหนี้ ลงบัญชี และตามยอดค้างให้อัตโนมัติ"
              : "เสนอราคา — ตอบรับแล้วกดแปลงเป็นใบแจ้งหนี้ได้ทันที"}
        </p>
      </div>
      <DocForm shopId={shop.id} docType={docType}
        seller={{
          name: shop.billing_name || shop.name,
          address: shop.billing_address, taxId: shop.tax_id, branch: shop.branch,
        }}
        contacts={(contacts ?? []) as Contact[]}
        initialContactId={contact}
        products={products ?? []} />
    </div>
  );
}
