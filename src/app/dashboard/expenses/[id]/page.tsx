// รายละเอียดค่าใช้จ่าย — ทำจ่าย · พิมพ์ 50 ทวิ (ถ้ามีหัก ณ ที่จ่าย) · ยกเลิก
import { getCurrentShop } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, Th, Td } from "@/components/ui";
import { baht, bahtDoc, dateOnlyTH, dateTH } from "@/lib/utils";
import { DOC_STATUS_TH, docStatusTone, docOutstanding, PAY_METHOD_TH } from "@/lib/finance";
import type { DocStatus, FinDoc, FinPayment } from "@/lib/types/finance";
import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import DocActions from "../../finance/doc-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ExpenseDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const { id } = await params;
  const canEdit = ["owner", "admin", "agent"].includes(role);

  const { data } = await supabase.from("fin_docs")
    .select("*, fin_doc_items(*), expense_categories(name)")
    .eq("id", id).eq("shop_id", shop.id).eq("doc_type", "expense").maybeSingle();
  if (!data) notFound();
  const doc = data as unknown as FinDoc & { expense_categories: { name: string } | null };

  const { data: payments } = await supabase.from("fin_payments").select("*").eq("doc_id", id).order("paid_at", { ascending: false });

  const svc = createServiceClient();
  let fileUrl: string | null = null;
  if (doc.file_path) {
    const { data: signed } = await svc.storage.from("slips").createSignedUrl(doc.file_path, 3600);
    fileUrl = signed?.signedUrl ?? null;
  }

  const outstanding = docOutstanding(doc);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-400"><Link href="/dashboard/expenses" className="hover:underline">ค่าใช้จ่าย</Link> / {doc.doc_number}</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-bold">
            {doc.doc_number}
            <Badge tone={docStatusTone(doc.status as DocStatus)}>{DOC_STATUS_TH[doc.status as DocStatus]}</Badge>
          </h1>
          <p className="text-sm text-neutral-400">
            {doc.contact_name ?? "ไม่ระบุผู้ขาย"} · {doc.expense_categories?.name ?? "ไม่ระบุหมวด"} · {dateOnlyTH(doc.issue_date)}
            {doc.due_date && ` · ครบกำหนด ${dateOnlyTH(doc.due_date)}`}
          </p>
        </div>
        {canEdit && <DocActions doc={{
          id: doc.id, shopId: shop.id, docType: "expense", docNumber: doc.doc_number,
          status: doc.status as DocStatus, outstanding, shareKey: null, whtAmount: Number(doc.wht_amount),
        }} />}
      </div>

      {Number(doc.wht_amount) > 0 && doc.status !== "void" && (
        <a href={`/dashboard/print/${doc.id}?form=wht`} target="_blank"
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100">
          <FileText className="h-4 w-4" /> พิมพ์หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ) — {baht(doc.wht_amount)}
        </a>
      )}

      <Card>
        <CardContent className="px-0 pb-0 pt-1">
          <Table>
            <thead><tr><Th>รายการ</Th><Th className="text-right">จำนวน</Th><Th className="text-right">ราคา/หน่วย</Th><Th className="text-right">รวม</Th></tr></thead>
            <tbody>
              {(doc.fin_doc_items ?? []).map((it, i) => (
                <tr key={i}>
                  <Td>{it.name}</Td>
                  <Td className="text-right">{Number(it.qty).toLocaleString()}{it.unit ? ` ${it.unit}` : ""}</Td>
                  <Td className="text-right">{bahtDoc(it.unit_price)}</Td>
                  <Td className="text-right">{bahtDoc(it.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="ml-auto max-w-xs space-y-1 px-5 py-4 text-sm">
            {Number(doc.discount) > 0 && <div className="flex justify-between"><span className="text-neutral-400">ส่วนลด</span><span>-{baht(doc.discount)}</span></div>}
            {doc.vat_mode !== "none" && <div className="flex justify-between"><span className="text-neutral-400">VAT 7% (ภาษีซื้อ)</span><span>{baht(doc.vat_amount)}</span></div>}
            <div className="flex justify-between font-semibold"><span>ยอดเอกสาร</span><span>{baht(doc.total)}</span></div>
            {Number(doc.wht_amount) > 0 && <div className="flex justify-between text-neutral-500"><span>หัก ณ ที่จ่าย {Number(doc.wht_rate)}%</span><span>-{baht(doc.wht_amount)}</span></div>}
            <div className="flex justify-between text-emerald-700"><span>จ่ายแล้ว</span><span>{baht(doc.paid_amount)}</span></div>
            <div className="flex justify-between border-t border-neutral-200 pt-1 font-semibold text-red-600"><span>ค้างจ่าย</span><span>{baht(outstanding)}</span></div>
          </div>
        </CardContent>
      </Card>

      {fileUrl && (
        <Card>
          <CardHeader><CardTitle>บิล/เอกสารแนบ</CardTitle></CardHeader>
          <CardContent>
            <a href={fileUrl} target="_blank" rel="noreferrer" className="block max-w-xs">
              {doc.file_path?.endsWith(".pdf") ? (
                <span className="text-sm text-emerald-700 hover:underline">เปิดไฟล์ PDF</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl} alt="บิล" className="max-h-72 rounded-xl border border-neutral-200 object-contain" />
              )}
            </a>
          </CardContent>
        </Card>
      )}

      {doc.notes && <p className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">{doc.notes}</p>}

      {(payments ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle>ประวัติจ่ายเงิน</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {((payments ?? []) as FinPayment[]).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-neutral-100 px-3 py-2 text-sm">
                <span className="font-medium">{baht(p.amount)}</span>
                <span className="text-neutral-400">{PAY_METHOD_TH[p.method] ?? p.method} · {dateTH(p.paid_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
