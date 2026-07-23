import { getCurrentShop } from "@/lib/shop";
import DocForm from "../../finance/doc-form";
import type { Contact, ExpenseCategory } from "@/lib/types/finance";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // AI อ่านบิลอาจใช้เวลา

export default async function NewExpensePage() {
  const { supabase, shop } = await getCurrentShop();
  const [{ data: contacts }, { data: categories }] = await Promise.all([
    supabase.from("contacts").select("*").eq("shop_id", shop.id).eq("status", "active").order("name"),
    supabase.from("expense_categories").select("*").eq("shop_id", shop.id).order("sort"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">บันทึกค่าใช้จ่าย</h1>
        <p className="text-sm text-neutral-400">ถ่ายรูปบิล/ใบเสร็จให้ AI กรอกให้ หรือคีย์เอง — ระบบลงบัญชี แยก VAT ภาษีซื้อ และหัก ณ ที่จ่ายให้ครบ</p>
      </div>
      <DocForm shopId={shop.id} docType="expense"
        contacts={(contacts ?? []) as Contact[]}
        categories={(categories ?? []) as ExpenseCategory[]} />
    </div>
  );
}
