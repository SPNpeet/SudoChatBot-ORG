import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent } from "@/components/ui";
import { Calculator, FileText, Banknote, Receipt, BarChart3, Package, Landmark } from "lucide-react";
import AssistantChat from "./chat";

export const dynamic = "force-dynamic";
// agent วนลูป tool กับฐานข้อมูล/AI สูงสุด 10 รอบ — กัน Vercel ตัดกลางคัน
export const maxDuration = 90;

const CAPABILITIES = [
  { icon: FileText, text: "เอกสาร: ออกใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จ — บอกเป็นภาษาคน เดี๋ยวออกให้พร้อมลิงก์ส่งลูกค้า" },
  { icon: Receipt, text: "รายจ่าย: แนบรูปบิล เดี๋ยวอ่าน แยก VAT/หัก ณ ที่จ่าย แล้วลงบัญชีให้ถูกหมวด" },
  { icon: Banknote, text: "เงิน: บันทึกรับ-จ่าย เช็คใครค้างเรา เราค้างใคร ทวงใครก่อนดี" },
  { icon: Landmark, text: "ภาษี: สรุป ภ.พ.30 / ภ.ง.ด.3 / ภ.ง.ด.53 ที่ต้องยื่นเดือนนี้" },
  { icon: Package, text: "สินค้า: เพิ่ม แก้ราคา/ต้นทุน เติมสต๊อก เช็คตัวใกล้หมด" },
  { icon: BarChart3, text: "สรุป: กำไร-ขาดทุน กระแสเงินสด — ตัวเลขจริงจากสมุดรายวัน" },
];

export default async function AssistantPage() {
  const { shop, role } = await getCurrentShop();
  const canManage = ["owner", "admin", "agent"].includes(role);

  if (!canManage) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-bold">ผู้ช่วยบัญชี AI</h1>
        <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">
          สิทธิ์ผู้ชม (viewer) ใช้ผู้ช่วย AI สั่งงานไม่ได้ — ดูรายงานและเอกสารได้ตามปกติ
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold"><Calculator className="h-5 w-5 text-emerald-600" /> ผู้ช่วยบัญชี AI</h1>
        <p className="text-sm text-neutral-400">นักบัญชีคู่ใจในแชทเดียว — พิมพ์สั่งเป็นภาษาคน หรือแนบรูปบิลให้ลงบัญชีให้เลย</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map((c) => (
          <div key={c.text} className="flex items-start gap-2 rounded-xl border border-neutral-100 bg-white px-3 py-2.5 text-[13px] text-neutral-600">
            <c.icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {c.text}
          </div>
        ))}
      </div>

      <Card className="flex h-[70svh] min-h-[26rem] flex-col overflow-hidden sm:h-[34rem]">
        <CardContent className="min-h-0 flex-1 p-0">
          <AssistantChat shopId={shop.id} />
        </CardContent>
      </Card>
    </div>
  );
}
