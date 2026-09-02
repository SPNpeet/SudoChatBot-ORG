import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent } from "@/components/ui";
import { Calculator, FileText, Banknote, Receipt, BarChart3, Package, Landmark, CircleHelp, Brain, Workflow } from "lucide-react";
import Link from "next/link";
import AssistantChat from "./chat";
import AssistantNameEditor from "./name-editor";
import FitViewport from "@/components/fit-viewport";

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

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { shop, role } = await getCurrentShop();
  // คำสั่งที่พิมพ์มาจากช่องสั่งงานบนหน้าแรก — ตัดความยาวฝั่งเซิร์ฟเวอร์ด้วย
  // ห้ามเชื่อความยาวที่ฝั่งหน้าเว็บตัดมา เพราะใครก็พิมพ์ ?q= ยาวเท่าไหร่ก็ได้ใน URL เอง
  const initialMessage = String((await searchParams).q ?? "").trim().slice(0, 300) || undefined;
  const canManage = ["owner", "admin", "agent"].includes(role);
  // ชื่อที่ลูกค้าตั้งให้ผู้ช่วย — คำขอเจ้าของ 4 ส.ค. 2569: อยากให้ "น้อง" มีชื่อเหมือนเลขาจริง
  const assistantName = String((((shop as { settings?: Record<string, unknown> | null }).settings ?? {}) as Record<string, unknown>).assistant_name ?? "").trim() || null;

  if (!canManage) {
    return (
      <div className="mx-auto w-full max-w-xl">
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
    //
    // ⚠️ ห้ามกลับไปตั้งความสูงเป็นตัวเลขคงที่ (เดิมคือ h-[calc(100svh-15rem)] min-h-[28rem])
    // 15rem = การเดาว่าหัวเว็บ+พาดหัว+แถบล่างกินที่ 240px แต่ของจริงบนมือถือ ~317px
    // กล่องจึงสูงเกินที่ว่าง -> หน้าเลื่อนได้ และในกล่องก็เลื่อนได้อีก = เลื่อน 2 ชั้น
    // เจ้าของเจอเองว่า "มันเลื่อนแม่ง 2 อัน ทั้งจอและกรอบที่ให้คุยแชท"
    // FitViewport วัดของจริงทุกครั้ง รวมตอนหมุนจอและตอนแป้นพิมพ์มือถือเด้งขึ้นมา
    <FitViewport className="flex flex-col gap-3" minHeight={340}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-[22px] font-bold leading-tight tracking-tight">
            <Calculator className="h-5 w-5 shrink-0 text-emerald-600" />{assistantName ?? "ผู้ช่วยบัญชี AI"}
          </h1>
          <div className="mt-0.5 flex items-center gap-1.5">
            <p className="truncate text-sm text-neutral-500">พิมพ์สั่งเป็นภาษาคน หรือส่งรูปบิลมาให้ลงบัญชีให้</p>
            {["owner", "admin"].includes(role) && <AssistantNameEditor shopId={shop.id} current={assistantName} />}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
        <Link href="/dashboard/assistant/workflows" title="งานอัตโนมัติที่ตั้งไว้"
          className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50">
          <Workflow className="h-3.5 w-3.5" /><span className="hidden sm:inline">งานอัตโนมัติ</span>
        </Link>
        <Link href="/dashboard/assistant/memory" title="สิ่งที่ผู้ช่วยจำเกี่ยวกับกิจการ"
          className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50">
          <Brain className="h-3.5 w-3.5" /><span className="hidden sm:inline">สิ่งที่จำ</span>
        </Link>
        <details className="relative shrink-0">
          <summary className="inline-flex h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50">
            <CircleHelp className="h-3.5 w-3.5" />ทำอะไรได้บ้าง
          </summary>
          {/* ⚠️ มือถือต้องยึดขอบจอ ไม่ใช่ขอบปุ่ม
              absolute + right-0 ตรึงขอบขวาของแผงไว้กับขอบขวาของ "ปุ่ม"
              ตอนนี้ยังพอดีเพราะปุ่มอยู่ชิดขอบเนื้อหาแล้ว แต่ถ้ามีอะไรมาวางขวาปุ่มอีก
              แผงจะเลื่อนไปทางซ้ายจนหลุดจอทันที (เกิดจริงกับกระดิ่งกล่องจดหมาย 31 ก.ค.)
              fixed + inset-x-3 บนมือถือทำให้ไม่มีทางหลุดจอไม่ว่าปุ่มจะย้ายไปไหน */}
          <div className="fixed inset-x-3 z-20 mt-2 space-y-1.5 rounded-2xl border border-neutral-200 bg-white p-3 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:w-[22rem]">
            {CAPABILITIES.map((c) => (
              <div key={c.text} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-neutral-600">
                <c.icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{c.text}
              </div>
            ))}
          </div>
        </details>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="min-h-0 flex-1 p-0">
          <AssistantChat shopId={shop.id} initialMessage={initialMessage} />
        </CardContent>
      </Card>
    </FitViewport>
  );
}
