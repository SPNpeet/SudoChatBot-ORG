// ============================================================
//  เอกสารขาย (AR) — ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Badge, Button, Card, CardContent, EmptyState, Table, Th, Td } from "@/components/ui";
import { baht, dateOnlyTH, cn } from "@/lib/utils";
import { DOC_TYPE_TH, docStatusLabel, docStatusTone, docOutstanding } from "@/lib/finance";
import type { DocStatus, DocType, FinDoc } from "@/lib/types/finance";
import Link from "next/link";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const TABS: { id: string; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  { id: "quotation", label: "ใบเสนอราคา" },
  { id: "invoice", label: "ใบแจ้งหนี้" },
  { id: "receipt", label: "ใบเสร็จ" },
  { id: "unpaid", label: "ค้างรับ" },
];

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const { t = "all" } = await searchParams;
  const canEdit = ["owner", "admin", "agent"].includes(role);

  let q = supabase.from("fin_docs").select("*")
    .eq("shop_id", shop.id).in("doc_type", ["quotation", "invoice", "receipt"])
    .order("created_at", { ascending: false }).limit(200);
  if (t === "quotation" || t === "invoice" || t === "receipt") q = q.eq("doc_type", t);
  if (t === "unpaid") q = q.eq("doc_type", "invoice").in("status", ["awaiting", "partial"]);
  const { data } = await q;
  const rows = (data ?? []) as FinDoc[];

  const outstandingTotal = rows
    .filter((d) => d.doc_type === "invoice" && ["awaiting", "partial"].includes(d.status))
    .reduce((a, d) => a + docOutstanding(d), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">เอกสารขาย</h1>
          <p className="text-sm text-neutral-400">
            ใบเสนอราคา → ใบแจ้งหนี้ → ใบเสร็จ/ใบกำกับภาษี · ยอดค้างรับตอนนี้ <span className="font-semibold text-amber-600">{baht(outstandingTotal)}</span>
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Link href="/dashboard/sales/new?type=quotation"><Button variant="outline" size="sm">ใบเสนอราคา</Button></Link>
            <Link href="/dashboard/sales/new?type=invoice"><Button variant="outline" size="sm">ใบแจ้งหนี้</Button></Link>
            <Link href="/dashboard/sales/new?type=receipt"><Button size="sm"><Plus className="h-4 w-4" /> ขายสด/ใบเสร็จ</Button></Link>
          </div>
        )}
      </div>

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
            <EmptyState title="ยังไม่มีเอกสารในหมวดนี้"
              hint="ออกใบเสนอราคา/ใบแจ้งหนี้/ใบเสร็จได้จากปุ่มด้านบน หรือสั่งผู้ช่วย AI เป็นภาษาคนได้เลย" />
          ) : (
            <Table>
              <thead><tr><Th>เลขที่</Th><Th>ประเภท</Th><Th>ลูกค้า</Th><Th>วันที่</Th><Th className="text-right">ยอด</Th><Th className="text-right">ค้างรับ</Th><Th>สถานะ</Th></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-neutral-50">
                    <Td><Link className="font-medium text-emerald-700 hover:underline" href={`/dashboard/sales/${d.id}`}>{d.doc_number}</Link></Td>
                    <Td>{DOC_TYPE_TH[d.doc_type as DocType]}</Td>
                    <Td>{d.contact_name ?? "-"}</Td>
                    <Td className="text-neutral-400">{dateOnlyTH(d.issue_date)}</Td>
                    <Td className="text-right">{baht(d.total)}</Td>
                    <Td className="text-right">{d.doc_type === "invoice" && ["awaiting", "partial"].includes(d.status) ? <span className="font-medium text-amber-600">{baht(docOutstanding(d))}</span> : "-"}</Td>
                    <Td><Badge tone={docStatusTone(d.status as DocStatus)}>{docStatusLabel(d.doc_type as DocType, d.status as DocStatus)}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
