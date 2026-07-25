import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent } from "@/components/ui";
import { Calculator, FileText, Banknote, Receipt, BarChart3, Package, Landmark, CircleHelp } from "lucide-react";
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
    // หน้านี้มีงานเดียวคือ "คุย" — จึงให้แชทกินพื้นที่จอทั้งหมด ไม่มีอะไรมาแย่งสายตา
    // (เดิมมีการ์ดบอกความสามารถ 6 ใบดันแชทตกจอ ทั้งที่ตัวอย่างคำสั่งอยู่ในแชทอยู่แล้ว)
    <div className="flex h-[calc(100svh-13rem)] min-h-[28rem] flex-col gap-3 md:h-[calc(100svh-7.5rem)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-[22px] font-bold leading-tight tracking-tight">
            <Calculator className="h-5 w-5 shrink-0 text-emerald-600" />ผู้ช่วยบัญชี AI
          </h1>
          <p className="mt-0.5 truncate text-sm text-neutral-500">พิมพ์สั่งเป็นภาษาคน หรือส่งรูปบิลมาให้ลงบัญชีให้</p>
        </div>
        <details className="relative shrink-0">
          <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50">
            <CircleHelp className="h-3.5 w-3.5" />ทำอะไรได้บ้าง
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] space-y-1.5 rounded-2xl border border-neutral-200 bg-white p-3 shadow-lg">
            {CAPABILITIES.map((c) => (
              <div key={c.text} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-neutral-600">
                <c.icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{c.text}
              </div>
            ))}
          </div>
        </details>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="min-h-0 flex-1 p-0">
          <AssistantChat shopId={shop.id} />
        </CardContent>
      </Card>
    </div>
  );
}
