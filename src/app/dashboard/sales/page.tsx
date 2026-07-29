// ============================================================
//  เอกสารขาย (AR) — ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Badge, Button, Card, CardContent, EmptyState, Table, Th, Td, PageHeader } from "@/components/ui";
import { baht, dateOnlyTH, cn } from "@/lib/utils";
import { DOC_TYPE_TH, docStatusLabel, docStatusTone, docOutstanding } from "@/lib/finance";
import type { DocStatus, DocType, FinDoc } from "@/lib/types/finance";
import Link from "next/link";
import RowLink from "@/components/row-link";
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
      <PageHeader
        title="เอกสารขาย"
        lead={<>ลูกค้ายังค้างเราอยู่ <b className="text-amber-600">{baht(outstandingTotal)}</b></>}
        help="ขายของ/บริการแล้วออกเอกสารที่นี่ — ได้เงินแล้วเลือก “ขายสด/ใบเสร็จ” · ให้เครดิตเลือก “ใบแจ้งหนี้” ระบบจะตามยอดค้างให้เอง · ยังไม่ตกลงราคาเลือก “ใบเสนอราคา” แล้วแปลงเป็นใบแจ้งหนี้ทีหลังได้ ไม่ต้องพิมพ์ใหม่"
        action={canEdit && (
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/sales/new?type=quotation"><Button variant="outline" size="sm">ใบเสนอราคา</Button></Link>
            <Link href="/dashboard/sales/new?type=invoice"><Button variant="outline" size="sm">ใบแจ้งหนี้</Button></Link>
            <Link href="/dashboard/sales/new?type=receipt"><Button size="sm"><Plus className="h-4 w-4" /> ขายสด/ใบเสร็จ</Button></Link>
          </div>
        )}
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((x) => (
          <Link key={x.id} href={x.id === "all" ? "/dashboard/sales" : `/dashboard/sales?t=${x.id}`}
            className={cn(
              "inline-flex min-h-[36px] items-center rounded-full px-4 py-1.5 text-sm font-medium",
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
            <Table>
              <thead><tr><Th>เลขที่</Th><Th>ประเภท</Th><Th>ลูกค้า</Th><Th>วันที่</Th><Th className="text-right">ยอด</Th><Th className="text-right">ค้างรับ</Th><Th>สถานะ</Th></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <RowLink key={d.id} href={`/dashboard/sales/${d.id}`} className={cn(d.status === "void" && "opacity-50")}>
                    {/* คง Link ไว้บนเลขที่เอกสาร — RowLink ทำให้กดได้ทั้งแถวก็จริง แต่คีย์บอร์ด/
                        โปรแกรมอ่านหน้าจอต้องมีของที่ focus ได้จริงอย่างน้อย 1 จุดต่อแถว */}
                    <Td><Link href={`/dashboard/sales/${d.id}`}
                      className={cn("font-medium text-emerald-700 hover:underline", d.status === "void" && "text-neutral-400 line-through")}>
                      {d.doc_number}
                    </Link></Td>
                    <Td label="ประเภท">{DOC_TYPE_TH[d.doc_type as DocType]}</Td>
                    <Td label="ลูกค้า">{d.contact_name ?? "-"}</Td>
                    <Td label="วันที่" className="text-neutral-400">{dateOnlyTH(d.issue_date)}</Td>
                    <Td label="ยอด" className="text-right">{baht(d.total)}</Td>
                    <Td label="ค้างรับ" className="text-right">{d.doc_type === "invoice" && ["awaiting", "partial"].includes(d.status) ? <span className="font-medium text-amber-600">{baht(docOutstanding(d))}</span> : "-"}</Td>
                    <Td label="สถานะ"><Badge tone={docStatusTone(d.status as DocStatus)}>{docStatusLabel(d.doc_type as DocType, d.status as DocStatus)}</Badge></Td>
                  </RowLink>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
