// ============================================================
//  รายละเอียดเอกสารขาย — รับชำระ แปลงเอกสาร พิมพ์ แชร์ลิงก์ลูกค้า ยกเลิก
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, Th, Td } from "@/components/ui";
import { baht, bahtDoc, dateOnlyTH, dateTH } from "@/lib/utils";
import { DOC_TYPE_TH, docStatusLabel, docStatusTone, docOutstanding, PAY_METHOD_TH } from "@/lib/finance";
import type { DocStatus, DocType, FinDoc, FinPayment } from "@/lib/types/finance";
import { notFound } from "next/navigation";
import Link from "next/link";
import DocActions from "../../finance/doc-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function SalesDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const { id } = await params;
  const canEdit = ["owner", "admin", "agent"].includes(role);

  const { data } = await supabase.from("fin_docs")
    .select("*, fin_doc_items(*)").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!data) notFound();
  const doc = data as unknown as FinDoc;

  const [{ data: payments }, { data: related }] = await Promise.all([
    supabase.from("fin_payments").select("*").eq("doc_id", id).order("paid_at", { ascending: false }),
    supabase.from("fin_docs").select("id,doc_number,doc_type,status").eq("shop_id", shop.id).eq("ref_doc_id", id).neq("status", "void"),
  ]);

  // สลิปแนบ — ลิงก์ชั่วคราว
  const svc = createServiceClient();
  const slipPaths = (payments ?? []).map((p) => p.slip_storage_path).filter(Boolean) as string[];
  const urlMap = new Map<string, string>();
  if (slipPaths.length) {
    const { data: signed } = await svc.storage.from("slips").createSignedUrls(slipPaths, 3600);
    for (const s of signed ?? []) if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
  }

  const outstanding = docOutstanding(doc);
  const isMoneyDoc = doc.doc_type === "invoice";

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-400"><Link href="/dashboard/sales" className="hover:underline">เอกสารขาย</Link> / {doc.doc_number}</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-bold">
            {DOC_TYPE_TH[doc.doc_type as DocType]} {doc.doc_number}
            <Badge tone={docStatusTone(doc.status as DocStatus)}>{docStatusLabel(doc.doc_type as DocType, doc.status as DocStatus)}</Badge>
          </h1>
          <p className="text-sm text-neutral-400">
            {doc.contact_name ?? "ไม่ระบุลูกค้า"} · ออกเมื่อ {dateOnlyTH(doc.issue_date)}
            {doc.due_date && ` · ครบกำหนด ${dateOnlyTH(doc.due_date)}`}
          </p>
        </div>
        {canEdit && <DocActions doc={{
          id: doc.id, shopId: shop.id, docType: doc.doc_type as DocType, docNumber: doc.doc_number,
          status: doc.status as DocStatus, outstanding, shareKey: doc.share_key ?? null, whtAmount: Number(doc.wht_amount),
        }} />}
      </div>

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
            {doc.vat_mode !== "none" && <div className="flex justify-between"><span className="text-neutral-400">VAT 7%</span><span>{baht(doc.vat_amount)}</span></div>}
            <div className="flex justify-between font-semibold"><span>ยอดเอกสาร</span><span>{baht(doc.total)}</span></div>
            {Number(doc.wht_amount) > 0 && <div className="flex justify-between text-neutral-500"><span>หัก ณ ที่จ่าย {Number(doc.wht_rate)}%</span><span>-{baht(doc.wht_amount)}</span></div>}
            {isMoneyDoc && (
              <>
                <div className="flex justify-between text-emerald-700"><span>รับแล้ว</span><span>{baht(doc.paid_amount)}</span></div>
                <div className="flex justify-between border-t border-neutral-200 pt-1 font-semibold text-amber-600"><span>ค้างรับ</span><span>{baht(outstanding)}</span></div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {doc.notes && <p className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">{doc.notes}</p>}

      {(related ?? []).length > 0 && (
        <p className="text-sm text-neutral-500">
          เอกสารต่อเนื่อง: {(related ?? []).map((r) => (
            <Link key={r.id} href={`/dashboard/sales/${r.id}`} className="mr-2 text-emerald-700 hover:underline">{r.doc_number}</Link>
          ))}
        </p>
      )}

      {(payments ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle>ประวัติรับเงิน</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {((payments ?? []) as FinPayment[]).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-100 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{baht(p.amount)}</span>
                  <span className="ml-2 text-neutral-400">{PAY_METHOD_TH[p.method] ?? p.method} · {dateTH(p.paid_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {p.verify_status === "verified" && <Badge tone="green">สลิปผ่านการตรวจ</Badge>}
                  {p.verify_status === "failed" && <Badge tone="red">สลิปมีปัญหา</Badge>}
                  {p.slip_storage_path && urlMap.get(p.slip_storage_path) && (
                    <a href={urlMap.get(p.slip_storage_path)} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 hover:underline">ดูสลิป</a>
                  )}
                </div>
                {p.verify_note && <p className="w-full text-xs text-red-500">{p.verify_note}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
