// ============================================================
//  หน้าผู้ติดต่อรายคน (เพิ่ม 28 ส.ค. 2569 ตามผลตรวจภายนอก)
//
//  หลักคิด object-centric: กดที่ "คน" แล้วต้องได้ทั้งประวัติและงานต่อในที่เดียว
//  เดิมการ์ดผู้ติดต่อแก้ไขได้อย่างเดียว — อยากรู้ว่าเคยออกบิลอะไรให้เขา
//  ต้องไปเปิดหน้าเอกสารขายแล้วไล่หาชื่อเอาเอง ซึ่งไม่มีใครทำ
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent, CardHeader, CardTitle, Badge, BackLink, Table, Th, Td, EmptyState, buttonClass } from "@/components/ui";
import { baht, dateOnlyTH, cn } from "@/lib/utils";
import { DOC_TYPE_TH, docStatusLabel, docStatusTone, docOutstanding } from "@/lib/finance";
import type { Contact, DocStatus, DocType, FinDoc } from "@/lib/types/finance";
import Link from "next/link";
import { notFound } from "next/navigation";
import RowLink from "@/components/row-link";
import ContactForm from "../contact-form";
import { FileText, Plus, Receipt } from "lucide-react";
import { canManage } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const { id } = await params;
  const canEdit = ["owner", "admin", "agent"].includes(role);

  const [{ data }, { data: docsData }] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle(),
    supabase.from("fin_docs").select("*").eq("shop_id", shop.id).eq("contact_id", id)
      .order("created_at", { ascending: false }).limit(50),
  ]);
  if (!data) notFound();
  const contact = data as Contact;
  const docs = (docsData ?? []) as FinDoc[];

  const ar = docs.filter((d) => d.doc_type === "invoice" && ["awaiting", "partial"].includes(d.status))
    .reduce((a, d) => a + docOutstanding(d), 0);
  const ap = docs.filter((d) => d.doc_type === "expense" && ["awaiting", "partial"].includes(d.status))
    .reduce((a, d) => a + docOutstanding(d), 0);
  const totalBilled = docs.filter((d) => d.status !== "void" && d.doc_type !== "quotation")
    .reduce((a, d) => a + Number(d.total), 0);

  const kindTH: Record<string, string> = { customer: "ลูกค้า", vendor: "ผู้ขาย", both: "ลูกค้า+ผู้ขาย" };
  const isVendorish = contact.kind === "vendor" || contact.kind === "both";
  const isCustomerish = contact.kind === "customer" || contact.kind === "both";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <BackLink href="/dashboard/contacts" label="กลับไปผู้ติดต่อ" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-[22px] font-bold leading-tight tracking-tight">
            {contact.name}
            <Badge tone={contact.kind === "vendor" ? "blue" : contact.kind === "both" ? "amber" : "green"}>{kindTH[contact.kind]}</Badge>
          </h1>
          <p className="text-sm text-neutral-400">
            {contact.tax_id ? `เลขผู้เสียภาษี ${contact.tax_id}${contact.branch ? ` · ${contact.branch}` : ""}` : "ยังไม่มีเลขผู้เสียภาษี"}
            {contact.phone && ` · โทร ${contact.phone}`}
          </p>
          {contact.address && <p className="mt-0.5 text-xs text-neutral-400">{contact.address}</p>}
        </div>
        {canEdit && <ContactForm shopId={shop.id} contact={contact} canArchive={canManage(role)} />}
      </div>

      {/* ตัวเลขที่ต้องเห็นก่อนคุยกับรายนี้ — ค้างเท่าไร เคยซื้อขายกันเท่าไร */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-400">ค้างรับจากรายนี้</p>
          <p className={cn("mt-0.5 whitespace-nowrap text-base font-bold tabular-nums", ar > 0 ? "text-amber-600" : "text-neutral-900")}>{baht(ar)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-400">เราค้างจ่ายรายนี้</p>
          <p className={cn("mt-0.5 whitespace-nowrap text-base font-bold tabular-nums", ap > 0 ? "text-red-600" : "text-neutral-900")}>{baht(ap)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-400">ยอดซื้อขายสะสม</p>
          <p className="mt-0.5 whitespace-nowrap text-base font-bold tabular-nums text-neutral-900">{baht(totalBilled)}</p>
        </div>
      </div>

      {/* งานต่อจากหน้านี้ได้เลย — ไม่ต้องกลับไปหาเมนู */}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {isCustomerish && <>
            <Link href={`/dashboard/sales/new?type=invoice&contact=${contact.id}`} className={buttonClass("primary", "sm")}>
              <Plus className="h-4 w-4" /> ออกใบแจ้งหนี้ให้รายนี้
            </Link>
            <Link href={`/dashboard/sales/new?type=quotation&contact=${contact.id}`} className={buttonClass("outline", "sm")}>
              ใบเสนอราคา
            </Link>
            <Link href={`/dashboard/sales/new?type=receipt&contact=${contact.id}`} className={buttonClass("outline", "sm")}>
              ขายสด/ใบเสร็จ
            </Link>
          </>}
          {isVendorish && (
            <Link href={`/dashboard/expenses/new?contact=${contact.id}`} className={buttonClass(isCustomerish ? "outline" : "primary", "sm")}>
              <Receipt className="h-4 w-4" /> บันทึกค่าใช้จ่ายจากรายนี้
            </Link>
          )}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>ประวัติเอกสารกับรายนี้</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          {docs.length === 0 ? (
            <EmptyState icon={FileText} title="ยังไม่เคยมีเอกสารกับรายนี้"
              hint="ออกใบแรกได้จากปุ่มด้านบน — ข้อมูลชื่อ/เลขภาษีจะถูกเติมให้อัตโนมัติ" />
          ) : (
            <Table>
              <thead><tr><Th>เลขที่</Th><Th>ประเภท</Th><Th>วันที่</Th><Th className="text-right">ยอด</Th><Th>สถานะ</Th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <RowLink key={d.id} href={d.doc_type === "expense" ? `/dashboard/expenses/${d.id}` : `/dashboard/sales/${d.id}`}
                    className={cn(d.status === "void" && "opacity-50")}>
                    <Td><span className={cn("font-medium text-emerald-700", d.status === "void" && "text-neutral-400 line-through")}>{d.doc_number}</span></Td>
                    <Td label="ประเภท">{DOC_TYPE_TH[d.doc_type as DocType]}</Td>
                    <Td label="วันที่" className="text-neutral-400">{dateOnlyTH(d.issue_date)}</Td>
                    <Td label="ยอด" className="text-right">{baht(d.total)}</Td>
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
