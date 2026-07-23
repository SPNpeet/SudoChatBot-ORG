import { getCurrentShop } from "@/lib/shop";
import DocForm from "../../finance/doc-form";
import { DOC_TYPE_TH } from "@/lib/finance";
import type { Contact, DocType } from "@/lib/types/finance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function NewSalesDocPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { supabase, shop } = await getCurrentShop();
  const { type } = await searchParams;
  const docType: DocType = type === "quotation" || type === "receipt" ? type : "invoice";

  const [{ data: contacts }, { data: products }] = await Promise.all([
    supabase.from("contacts").select("*").eq("shop_id", shop.id).eq("status", "active").order("name"),
    supabase.from("products").select("id,name,price,stock,track_stock").eq("shop_id", shop.id).eq("status", "active").order("name").limit(300),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">ออก{DOC_TYPE_TH[docType]}</h1>
        <p className="text-sm text-neutral-400">
          {docType === "receipt"
            ? "ขายสด — รับเงินทันที ระบบบันทึกเงินเข้า ตัดสต๊อก และลงบัญชีให้ครบ"
            : docType === "invoice"
              ? "ขายเชื่อ — ระบบตั้งลูกหนี้ ลงบัญชี และตามยอดค้างให้อัตโนมัติ"
              : "เสนอราคา — ตอบรับแล้วกดแปลงเป็นใบแจ้งหนี้ได้ทันที"}
        </p>
      </div>
      <DocForm shopId={shop.id} docType={docType}
        contacts={(contacts ?? []) as Contact[]}
        products={products ?? []} />
    </div>
  );
}
