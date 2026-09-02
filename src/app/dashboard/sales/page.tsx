// ============================================================
//  เอกสารขาย (AR) — ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { baht, cn } from "@/lib/utils";
import { docOutstanding } from "@/lib/finance";
import SalesTable, { type SalesRow } from "./sales-table";
import type { FinDoc } from "@/lib/types/finance";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const TABS: { id: string; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  { id: "quotation", label: "ใบเสนอราคา" },
  { id: "invoice", label: "ใบแจ้งหนี้" },
  { id: "receipt", label: "ใบเสร็จ" },
  // ใบลดหนี้/ใบเพิ่มหนี้ต้องหาเจอที่นี่ด้วย ไม่งั้นออกแล้วหาไม่เจออีกเลย
  { id: "note", label: "ใบลดหนี้/เพิ่มหนี้" },
  { id: "unpaid", label: "ค้างรับ" },
];

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const { t = "all" } = await searchParams;
  const canEdit = ["owner", "admin", "agent"].includes(role);

  // ต้องรวม credit_note / debit_note ด้วย เดิมกรองทิ้ง ทำให้ออกใบลดหนี้แล้วหาไม่เจอ
  const SALES_TYPES = ["quotation", "invoice", "receipt", "credit_note", "debit_note"];
  let q = supabase.from("fin_docs").select("*")
    .eq("shop_id", shop.id).in("doc_type", SALES_TYPES)
    .order("created_at", { ascending: false }).limit(200);
  if (t === "quotation" || t === "invoice" || t === "receipt") q = q.eq("doc_type", t);
  if (t === "note") q = q.in("doc_type", ["credit_note", "debit_note"]);
  if (t === "unpaid") q = q.eq("doc_type", "invoice").in("status", ["awaiting", "partial"]);
  const { data } = await q;
  const rows = (data ?? []) as FinDoc[];

  const outstandingTotal = rows
    .filter((d) => d.doc_type === "invoice" && ["awaiting", "partial"].includes(d.status))
    .reduce((a, d) => a + docOutstanding(d), 0);

  return (
    <div className="space-y-5">
      <PageHeader icon={FileText} tone="emerald"
        title="เอกสารขาย"
        lead={<>ลูกค้ายังค้างเราอยู่ <b className="text-amber-600">{baht(outstandingTotal)}</b></>}
        help="ขายของ/บริการแล้วออกเอกสารที่นี่ — ได้เงินแล้วเลือก “ขายสด/ใบเสร็จ” · ให้เครดิตเลือก “ใบแจ้งหนี้” ระบบจะตามยอดค้างให้เอง · ยังไม่ตกลงราคาเลือก “ใบเสนอราคา” แล้วแปลงเป็นใบแจ้งหนี้ทีหลังได้ ไม่ต้องพิมพ์ใหม่"
        /* ⚠️ ซ่อนบนมือถือโดยตั้งใจ (12 ส.ค. 2569 เจ้าของรายงาน "ปุ่มซ้ำกันเยอะเวลามองในมือถือ")
           ปุ่ม + ลอยมุมขวาล่างมีทั้ง 3 อย่างนี้อยู่แล้วเป๊ะ ๆ (ดู quick-create.tsx)
           บนจอมือถือจึงเห็นปุ่มชื่อเดียวกันสองชุดพร้อมกัน ต้องหยุดคิดว่าต่างกันยังไง
           เก็บไว้บนเดสก์ท็อปเพราะที่นั่นมีที่ว่างพอ และเมาส์เอื้อมหัวหน้าง่ายกว่าปุ่มลอยมุมจอ */
        action={canEdit && (
          <div className="hidden flex-wrap gap-2 sm:flex">
            <Link href="/dashboard/sales/new?type=quotation" className={buttonClass("outline", "sm")}>ใบเสนอราคา</Link>
            <Link href="/dashboard/sales/new?type=invoice" className={buttonClass("outline", "sm")}>ใบแจ้งหนี้</Link>
            <Link href="/dashboard/sales/new?type=receipt" className={buttonClass("primary", "sm")}><Plus className="h-4 w-4" /> ขายสด/ใบเสร็จ</Link>
          </div>
        )}
      />

      {/* แถบตัวกรองต้องเป็นแถวเดียวที่เลื่อนได้ ห้ามตกบรรทัด (แก้ 28 ส.ค. 2569)
          บนจอ 390px ตัวกรองหลายอันตกลงมา 2-3 แถว กินหน้าจอแรกก่อนที่ผู้ใช้จะเห็นรายการจริง
          เหตุผลและ CSS เดียวกับหน้ารายงาน ดู .tabstrip ใน globals.css */}
      <div className="tabstrip">
        {TABS.map((x) => (
          <Link key={x.id} href={x.id === "all" ? "/dashboard/sales" : `/dashboard/sales?t=${x.id}`}
            className={cn(
              "inline-flex min-h-[44px] items-center rounded-full px-4 py-1.5 text-sm font-medium",
              t === x.id ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
            )}>
            {x.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="px-0 pb-0 pt-1">
          {rows.length === 0 ? (
            <EmptyState icon={FileText} title="ยังไม่มีเอกสารในหมวดนี้"
              hint="ที่นี่คือทุกใบที่คุณออกให้ลูกค้า และระบบจะตามยอดค้างให้เอง"
              steps={[
                "เลือกลูกค้า ใส่รายการกับราคา — ระบบคิด VAT ให้อัตโนมัติ",
                "ส่งลิงก์ให้ลูกค้า มี QR พร้อมเพย์ให้สแกนจ่ายได้เลย",
                "ลูกค้าโอนแล้วอัปสลิป ระบบตัดยอดค้างและลงบัญชีให้ทันที",
              ]}
              action={{ href: "/dashboard/sales/new?type=invoice", label: "ออกเอกสารใบแรก" }}
              secondary={{ href: "/dashboard/assistant", label: "สั่ง AI เป็นภาษาคน" }} />
          ) : (
            <SalesTable rows={rows.map((d): SalesRow => ({
              id: d.id, doc_number: d.doc_number, doc_type: d.doc_type, contact_name: d.contact_name,
              issue_date: d.issue_date, total: Number(d.total),
              outstanding: d.doc_type === "invoice" && ["awaiting", "partial"].includes(d.status) ? docOutstanding(d) : 0,
              status: d.status, share_key: d.share_key ?? null,
            }))} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
