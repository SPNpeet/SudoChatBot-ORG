import { getCurrentShop } from "@/lib/shop";
import DocForm from "../../finance/doc-form";
import type { Contact, ExpenseCategory } from "@/lib/types/finance";
import { canWork } from "@/lib/roles";
import RoleWall from "../../role-wall";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // AI อ่านบิลอาจใช้เวลา

export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ contact?: string }> }) {
  const { contact } = await searchParams;
  const { supabase, shop, role } = await getCurrentShop();
  if (!canWork(role)) return <RoleWall title="บทบาทผู้ชมออกเอกสารไม่ได้"
    detail="บัญชีนี้ได้รับสิทธิ์ดูข้อมูลอย่างเดียว — ถ้าต้องออกเอกสารหรือบันทึกรายการ ให้เจ้าของเปลี่ยนบทบาทเป็นพนักงานที่ ตั้งค่า > ทีม" />;
  const [{ data: contacts }, { data: categories }] = await Promise.all([
    supabase.from("contacts").select("*").eq("shop_id", shop.id).eq("status", "active").order("name"),
    supabase.from("expense_categories").select("*").eq("shop_id", shop.id).order("sort"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">บันทึกค่าใช้จ่าย</h1>
        <p className="text-sm text-neutral-400">ถ่ายรูปบิล/ใบเสร็จให้ AI กรอกให้ หรือคีย์เอง — ระบบลงบัญชี แยก VAT ภาษีซื้อ และหัก ณ ที่จ่ายให้ครบ</p>
      </div>
      <DocForm shopId={shop.id} docType="expense"
        contacts={(contacts ?? []) as Contact[]}
        initialContactId={contact}
        categories={(categories ?? []) as ExpenseCategory[]} />
    </div>
  );
}
