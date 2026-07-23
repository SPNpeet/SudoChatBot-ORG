// ============================================================
//  การเงิน/กระทบยอด — เงินเข้า-ออกทุกช่องทาง · อัปสลิปให้ระบบตรวจ+จับคู่ ·
//  นำเข้า statement ธนาคารมากระทบยอดกับเอกสาร
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Table, Th, Td } from "@/components/ui";
import { baht, dateTH, cn } from "@/lib/utils";
import { PAY_METHOD_TH, docOutstanding } from "@/lib/finance";
import type { FinPayment } from "@/lib/types/finance";
import Link from "next/link";
import SlipMatch from "./slip-match";
import StatementImport from "./statement-import";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const TABS = [
  { id: "all", label: "ทั้งหมด" },
  { id: "in", label: "เงินเข้า" },
  { id: "out", label: "เงินออก" },
] as const;

export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const { t = "all" } = await searchParams;
  const canEdit = ["owner", "admin", "agent"].includes(role);

  let q = supabase.from("fin_payments")
    .select("*, fin_docs(doc_number, doc_type, contact_name)")
    .eq("shop_id", shop.id).order("paid_at", { ascending: false }).limit(150);
  if (t === "in" || t === "out") q = q.eq("direction", t);

  const monthStart = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7) + "-01";
  const [{ data: payments }, { data: monthRows }, { data: openInvoices }] = await Promise.all([
    q,
    supabase.from("fin_payments").select("direction,amount").eq("shop_id", shop.id).gte("paid_at", monthStart),
    supabase.from("fin_docs").select("id,doc_number,contact_name,total,wht_amount,paid_amount,due_date")
      .eq("shop_id", shop.id).eq("doc_type", "invoice").in("status", ["awaiting", "partial"])
      .order("issue_date", { ascending: false }).limit(100),
  ]);

  const rows = (payments ?? []) as unknown as FinPayment[];
  const inMonth = (monthRows ?? []).filter((p) => p.direction === "in").reduce((a, p) => a + Number(p.amount), 0);
  const outMonth = (monthRows ?? []).filter((p) => p.direction === "out").reduce((a, p) => a + Number(p.amount), 0);

  // signed URL รูปสลิป
  const svc = createServiceClient();
  const paths = rows.map((r) => r.slip_storage_path).filter(Boolean) as string[];
  const urlMap = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await svc.storage.from("slips").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
  }

  const invoices = (openInvoices ?? []).map((d) => ({
    docId: d.id, docNumber: d.doc_number, contact: d.contact_name,
    outstanding: docOutstanding(d), due: d.due_date,
  })).filter((c) => c.outstanding > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">การเงิน / กระทบยอด</h1>
        <p className="text-sm text-neutral-400">
          เดือนนี้ เงินเข้า <span className="font-semibold text-emerald-600">{baht(inMonth)}</span> ·
          เงินออก <span className="font-semibold text-red-600">{baht(outMonth)}</span> ·
          ทุกรายการลงสมุดรายวันอัตโนมัติ
        </p>
      </div>

      {canEdit && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SlipMatch shopId={shop.id} />
          <StatementImport shopId={shop.id} invoices={invoices} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((x) => (
          <Link key={x.id} href={x.id === "all" ? "/dashboard/money" : `/dashboard/money?t=${x.id}`}
            className={cn(
              "inline-flex min-h-[36px] items-center rounded-full px-4 py-1.5 text-sm font-medium",
              t === x.id ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
            )}>
            {x.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>รายการเงินล่าสุด</CardTitle></CardHeader>
        <CardContent className="px-0 pb-0">
          {rows.length === 0 ? (
            <EmptyState icon="🏦" title="ยังไม่มีรายการเงิน"
              hint="เมื่อรับ-จ่ายเงินจากเอกสาร หรืออัปสลิป/นำเข้า statement ด้านบน รายการเงินจะขึ้นที่นี่พร้อมลงบัญชีอัตโนมัติ"
              action={{ href: "/dashboard/sales?t=unpaid", label: "ดูใบแจ้งหนี้ค้างรับ" }} />
          ) : (
            <Table>
              <thead><tr><Th>วันที่</Th><Th>ทิศทาง</Th><Th className="text-right">ยอด</Th><Th>ช่องทาง</Th><Th>เอกสาร</Th><Th>สลิป</Th></tr></thead>
              <tbody>
                {rows.map((p) => {
                  const url = p.slip_storage_path ? urlMap.get(p.slip_storage_path) : undefined;
                  return (
                    <tr key={p.id}>
                      <Td className="text-neutral-400">{dateTH(p.paid_at)}</Td>
                      <Td>{p.direction === "in" ? <Badge tone="green">เงินเข้า</Badge> : <Badge tone="red">เงินออก</Badge>}</Td>
                      <Td className={cn("text-right font-medium", p.direction === "in" ? "text-emerald-700" : "text-red-600")}>
                        {p.direction === "in" ? "+" : "-"}{baht(p.amount)}
                      </Td>
                      <Td className="text-neutral-500">{PAY_METHOD_TH[p.method] ?? p.method}</Td>
                      <Td>
                        {p.fin_docs ? (
                          <Link href={p.fin_docs.doc_type === "expense" ? `/dashboard/expenses/${p.doc_id}` : `/dashboard/sales/${p.doc_id}`}
                            className="text-emerald-700 hover:underline">{p.fin_docs.doc_number}</Link>
                        ) : <span className="text-neutral-300">ไม่ผูกเอกสาร</span>}
                        {p.fin_docs?.contact_name && <span className="ml-1 text-xs text-neutral-400">{p.fin_docs.contact_name}</span>}
                      </Td>
                      <Td>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 hover:underline">
                            {p.verify_status === "verified" ? "✓ ตรวจแล้ว" : p.verify_status === "failed" ? "⚠ มีปัญหา" : "ดูสลิป"}
                          </a>
                        ) : <span className="text-neutral-300">-</span>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
