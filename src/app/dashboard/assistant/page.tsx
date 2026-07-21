import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent } from "@/components/ui";
import { BrainCircuit, ShoppingBag, MessageSquare, Package, Settings2, BarChart3, BookOpen } from "lucide-react";
import AssistantChat from "./chat";

export const dynamic = "force-dynamic";
// agent วนลูป tool กับฐานข้อมูล/AI สูงสุด 10 รอบ — กัน Vercel ตัดกลางคัน
export const maxDuration = 90;

const CAPABILITIES = [
  { icon: ShoppingBag, text: "ออเดอร์: เช็คสถานะ ยืนยันยอดโอน ใส่เลขพัสดุ + แจ้งลูกค้าให้เอง" },
  { icon: MessageSquare, text: "แชท: ดูคิวที่รอตอบ อ่านบทสนทนา สั่งให้ตอบลูกค้าแทน สลับบอท/แอดมิน" },
  { icon: Package, text: "สินค้า: เพิ่มตัวใหม่ แก้ราคา เติมสต๊อก เปิด-ปิดการขาย" },
  { icon: Settings2, text: "บอทขาย: ปรับคำทักทาย บุคลิก โปรโมชั่น ระบบตอบคอมเมนต์ — บอกเป็นภาษาคนได้เลย" },
  { icon: BookOpen, text: "คลังความรู้: เพิ่มนโยบาย/ข้อมูลร้านให้บอทใช้ตอบ" },
  { icon: BarChart3, text: "สถิติ: ยอดขาย สินค้าขายดี โควตา เครดิตคงเหลือ" },
];

export default async function AssistantPage() {
  const { shop, role } = await getCurrentShop();
  const canManage = role === "owner" || role === "admin";

  if (!canManage) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-bold">ผู้จัดการร้าน AI</h1>
        <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">
          เฉพาะเจ้าของ/ผู้ดูแลร้านใช้ผู้จัดการร้าน AI ได้ — สิทธิ์พนักงานใช้หน้าแชทและออเดอร์ได้ตามปกติ
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold"><BrainCircuit className="h-5 w-5 text-emerald-600" /> ผู้จัดการร้าน AI</h1>
        <p className="text-sm text-neutral-400">ศูนย์สั่งการร้านทั้งร้านในแชทเดียว — พิมพ์สั่งเป็นภาษาคน เดี๋ยวจัดการให้ครบ</p>
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
