// ============================================================
//  การเงิน/กระทบยอด — เงินเข้า-ออกทุกช่องทาง · อัปสลิปให้ระบบตรวจ+จับคู่ ·
//  นำเข้า statement ธนาคารมากระทบยอดกับเอกสาร
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Table, Th, Td, PageHeader } from "@/components/ui";
import { baht, dateTH, cn } from "@/lib/utils";
import { PAY_METHOD_TH, docOutstanding } from "@/lib/finance";
import type { FinPayment } from "@/lib/types/finance";
import Link from "next/link";
import { Landmark } from "lucide-react";
import RowLink from "@/components/row-link";
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

  // ⚠️ ต้องดึงสถานะเอกสารมาด้วย เพื่อกันรายการของเอกสารที่ยกเลิกแล้ว
  // เมื่อยกเลิกเอกสาร ระบบกลับรายการในสมุดรายวันให้แล้ว (เงินสดถูกกลับออกไป)
  // แต่แถวใน fin_payments ยังอยู่ ถ้าหน้าจอนับต่อ = ตัวเลขบนจอไม่ตรงสมุดรายวัน
  // ของจริงที่เจอ 5 ส.ค. 2569: เอกสารที่ยกเลิกแล้ว 7 รายการ รวม 374,182 บาท ยังถูกนับอยู่
  // ⚠️ ห้ามใช้ !inner ตรงนี้ (เคยพลาดมาแล้ว 5 ส.ค. 2569)
  // fin_payments.doc_id เป็น null ได้ = เงินที่ยังไม่ผูกเอกสาร (นำเข้า statement แล้วยังไม่จับคู่)
  // ซึ่งลงสมุดรายวันไปแล้วจริง · !inner จะตัดแถวพวกนี้ทิ้งทั้งหมด
  // = เงินหายจากทุกหน้าจอ และการ์ด "สลิปรอจับคู่" บนแดชบอร์ดกลายเป็นทางตัน (กดแล้วไม่เจอ)
  // จึงต้อง left join ตามเดิม แล้วกรองเอกสารที่ยกเลิกทิ้งในโค้ดแทน
  let q = supabase.from("fin_payments")
    .select("*, fin_docs(doc_number, doc_type, contact_name, status)")
    .eq("shop_id", shop.id)
    .order("paid_at", { ascending: false }).limit(150);
  if (t === "in" || t === "out") q = q.eq("direction", t);

  const monthStart = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7) + "-01";
  const [{ data: payments }, { data: monthRows }, { data: openInvoices }] = await Promise.all([
    q,
    supabase.from("fin_payments").select("direction,amount,fin_docs(status)")
      .eq("shop_id", shop.id).gte("paid_at", monthStart),
    supabase.from("fin_docs").select("id,doc_number,contact_name,total,wht_amount,paid_amount,due_date")
      .eq("shop_id", shop.id).eq("doc_type", "invoice").in("status", ["awaiting", "partial"])
      .order("issue_date", { ascending: false }).limit(100),
  ]);

  // กรองเอกสารที่ยกเลิกแล้วออก (สมุดรายวันกลับรายการไปแล้ว) แต่เก็บแถวที่ยังไม่ผูกเอกสารไว้
  const notVoided = (p: { fin_docs?: { status?: string } | null }) => (p.fin_docs?.status ?? "") !== "void";
  const rows = ((payments ?? []) as unknown as (FinPayment & { fin_docs?: { status?: string } | null })[])
    .filter(notVoided) as unknown as FinPayment[];
  const monthKept = ((monthRows ?? []) as unknown as { direction: string; amount: number; fin_docs?: { status?: string } | null }[]).filter(notVoided);
  const inMonth = monthKept.filter((p) => p.direction === "in").reduce((a, p) => a + Number(p.amount), 0);
  const outMonth = monthKept.filter((p) => p.direction === "out").reduce((a, p) => a + Number(p.amount), 0);

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
      <PageHeader
        title="การเงิน / กระทบยอด"
        lead={<>เดือนนี้เงินเข้า <b className="text-emerald-600">{baht(inMonth)}</b> · เงินออก <b className="text-red-600">{baht(outMonth)}</b></>}
        help="ที่นี่ไว้เช็คว่าเงินที่เข้าบัญชีจริง ตรงกับเอกสารที่ออกไปไหม — อัปสลิปที่ลูกค้าโอนมา ระบบจะจับคู่กับใบแจ้งหนี้และตัดยอดให้เอง หรือโหลดรายการเดินบัญชีจากแอปธนาคารมาเทียบทีเดียวทั้งเดือนก็ได้"
      />

      {canEdit && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SlipMatch shopId={shop.id} />
          <StatementImport shopId={shop.id} invoices={invoices} />
        </div>
      )}

      {/* แถบตัวกรองต้องเป็นแถวเดียวที่เลื่อนได้ ห้ามตกบรรทัด (แก้ 28 ส.ค. 2569)
          บนจอ 390px ตัวกรองหลายอันตกลงมา 2-3 แถว กินหน้าจอแรกก่อนที่ผู้ใช้จะเห็นรายการจริง
          เหตุผลและ CSS เดียวกับหน้ารายงาน ดู .tabstrip ใน globals.css */}
      <div className="tabstrip">
        {TABS.map((x) => (
          <Link key={x.id} href={x.id === "all" ? "/dashboard/money" : `/dashboard/money?t=${x.id}`}
            className={cn(
              "inline-flex min-h-[44px] items-center rounded-full px-4 py-1.5 text-sm font-medium",
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
            <EmptyState icon={Landmark} title="ยังไม่มีรายการเงินเข้า-ออก"
              hint="หน้านี้คือสมุดเงินสด/ธนาคารของกิจการ — เงินเข้าออกจริงอยู่ตรงนี้"
              steps={[
                "ลูกค้าโอนเงินมา → อัปรูปสลิป ระบบจับคู่กับใบแจ้งหนี้ให้เอง",
                "หรือโหลด statement จากแอปธนาคาร แล้วนำเข้าทีเดียวทั้งเดือน",
                "ทุกรายการที่จับคู่แล้ว ระบบตัดยอดค้างและลงบัญชีให้อัตโนมัติ",
              ]}
              action={{ href: "/dashboard/sales?t=unpaid", label: "ดูใบแจ้งหนี้ค้างรับ" }} />
          ) : (
            <Table>
              <thead><tr><Th>วันที่</Th><Th>ทิศทาง</Th><Th className="text-right">ยอด</Th><Th>ช่องทาง</Th><Th>เอกสาร</Th><Th>สลิป</Th></tr></thead>
              <tbody>
                {rows.map((p) => {
                  const url = p.slip_storage_path ? urlMap.get(p.slip_storage_path) : undefined;
                  const docHref = p.fin_docs
                    ? (p.fin_docs.doc_type === "expense" ? `/dashboard/expenses/${p.doc_id}` : `/dashboard/sales/${p.doc_id}`)
                    : null;
                  // แถวที่ผูกกับเอกสารกดได้ทั้งแถว · แถวที่ไม่ผูกเอกสารไม่มีปลายทางให้ไป จึงไม่ทำให้ดูกดได้
                  const cells = (
                    <>
                      <Td className="text-neutral-400">{dateTH(p.paid_at)}</Td>
                      <Td label="ทิศทาง">{p.direction === "in" ? <Badge tone="green">เงินเข้า</Badge> : <Badge tone="red">เงินออก</Badge>}</Td>
                      <Td label="ยอด" className={cn("text-right font-medium", p.direction === "in" ? "text-emerald-700" : "text-red-600")}>
                        {p.direction === "in" ? "+" : "-"}{baht(p.amount)}
                      </Td>
                      <Td label="ช่องทาง" className="text-neutral-500">{PAY_METHOD_TH[p.method] ?? p.method}</Td>
                      <Td label="เอกสาร">
                        {p.fin_docs ? (
                          <Link href={p.fin_docs.doc_type === "expense" ? `/dashboard/expenses/${p.doc_id}` : `/dashboard/sales/${p.doc_id}`}
                            className="text-emerald-700 hover:underline">{p.fin_docs.doc_number}</Link>
                        ) : <span className="text-neutral-300">ไม่ผูกเอกสาร</span>}
                        {p.fin_docs?.contact_name && <span className="ml-1 text-xs text-neutral-400">{p.fin_docs.contact_name}</span>}
                      </Td>
                      <Td label="สลิป">
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 hover:underline">
                            {p.verify_status === "verified" ? "ตรวจแล้ว" : p.verify_status === "failed" ? "มีปัญหา" : "ดูสลิป"}
                          </a>
                        ) : null}
                      </Td>
                    </>
                  );
                  return docHref
                    ? <RowLink key={p.id} href={docHref}>{cells}</RowLink>
                    : <tr key={p.id}>{cells}</tr>;
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
