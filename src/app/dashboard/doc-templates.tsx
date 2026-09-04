// ============================================================
//  กริดเทมเพลตเอกสาร — ทางเข้าออกเอกสารที่ "เห็นอยู่บนหน้า" ไม่ใช่ซ่อนหลังปุ่มลอย
//
//  ⚠️ ทำไมมีทั้งที่มีปุ่ม + ลอยมุมขวาล่างอยู่แล้ว (quick-create.tsx)
//  ปุ่มลอยเป็นไอคอนบวกเปล่า ๆ คนที่เพิ่งเริ่มใช้ไม่รู้ว่ากดแล้วเจออะไร
//  และไม่มีอะไรบนหน้าบอกว่า "ระบบนี้ออกเอกสารได้กี่ชนิด" — ต้องกดเข้าไปดูถึงจะรู้
//  กริดนี้ตอบคำถามนั้นตั้งแต่ยังไม่กด ซึ่งสำคัญกับคนที่กำลังตัดสินใจว่าจะใช้ต่อไหม
//
//  ⚠️ ไม่ได้เอาปุ่มลอยออก และห้ามเอาออก
//  ปุ่มลอยตามผู้ใช้ไปทุกหน้าและอยู่ในระยะนิ้วโป้งบนมือถือ ส่วนกริดนี้อยู่แค่หน้าแรก
//  คนละงานกัน ไม่ใช่ของซ้ำ
//
//  ⚠️ ใบลดหนี้/ใบเพิ่มหนี้ไม่อยู่ในกริดนี้โดยตั้งใจ
//  ทั้งสองใบต้องอ้างอิงใบกำกับภาษีเดิมเสมอ (ม.86/9-10) จึงออกจากหน้าเอกสารต้นทาง
//  เท่านั้น การมีทางลัดออกลอย ๆ จากหน้าแรกจะพาคนไปออกใบที่ไม่มีใบอ้างอิง = ใบที่ใช้ไม่ได้
// ============================================================
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { FileText, Receipt, FileSignature, Camera, Banknote } from "lucide-react";
import TemplatePreview from "./template-preview";

const TEMPLATES = [
  { href: "/dashboard/sales/new?type=invoice", icon: FileText, label: "ใบแจ้งหนี้", sub: "INVOICE", hint: "ขายเชื่อ ตั้งลูกหนี้" },
  { href: "/dashboard/sales/new?type=receipt", icon: Receipt, label: "ใบเสร็จรับเงิน", sub: "RECEIPT", hint: "รับเงินแล้ว" },
  { href: "/dashboard/sales/new?type=quotation", icon: FileSignature, label: "ใบเสนอราคา", sub: "QUOTATION", hint: "แปลงเป็นใบแจ้งหนี้ทีหลังได้" },
  { href: "/dashboard/expenses/new", icon: Camera, label: "บันทึกค่าใช้จ่าย", sub: "EXPENSE", hint: "แนบรูปบิลให้ AI อ่าน" },
  { href: "/dashboard/money", icon: Banknote, label: "บันทึกรับ-จ่ายเงิน", sub: "PAYMENT", hint: "ตัดยอดค้าง" },
];

export default function DocTemplates() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>ออกเอกสารใหม่</CardTitle>
        <Link href="/dashboard/sales" className="-mx-2 inline-flex min-h-11 shrink-0 items-center px-2 text-xs font-medium text-emerald-700 hover:underline">
          เอกสารทั้งหมด →
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {TEMPLATES.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group flex min-h-[44px] flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100">
                <t.icon className="h-4 w-4" />
              </span>
              <span className="mt-1 text-[13px] font-semibold leading-tight text-neutral-900">{t.label}</span>
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-300">{t.sub}</span>
              <span className="text-xs leading-snug text-neutral-400">{t.hint}</span>
            </Link>
          ))}
        </div>
        {/* เอกสารตัวอย่างแบบป๊อบอัพ — เห็นหน้าตาใบจริงก่อนตัดสินใจกดออก (เจ้าของขอ 5 ก.ย. 2569) */}
        <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-neutral-400">
          <span className="pr-1">ยังไม่แน่ใจว่าใบไหน?</span>
          <TemplatePreview docType="quotation" href="/dashboard/sales/new?type=quotation" label="ใบเสนอราคา" />
          <TemplatePreview docType="invoice" href="/dashboard/sales/new?type=invoice" label="ใบแจ้งหนี้" />
          <TemplatePreview docType="receipt" href="/dashboard/sales/new?type=receipt" label="ใบเสร็จรับเงิน" />
        </div>
      </CardContent>
    </Card>
  );
}
