// ============================================================
//  ค่าใช้จ่าย/รายจ่าย (AP) — ตั้งหนี้ · ทำจ่าย · แนบบิล · AI อ่านบิลให้
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Badge, Button, Card, CardContent, EmptyState, Table, Th, Td, PageHeader } from "@/components/ui";
import { baht, dateOnlyTH, cn } from "@/lib/utils";
import { DOC_STATUS_TH, docStatusTone, docOutstanding } from "@/lib/finance";
import type { DocStatus, FinDoc } from "@/lib/types/finance";
import Link from "next/link";
import RowLink from "@/components/row-link";
import { Plus, Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "all", label: "ทั้งหมด" },
  { id: "pending", label: "รออนุมัติ" },
  { id: "unpaid", label: "ค้างจ่าย" },
  { id: "paid", label: "จ่ายแล้ว" },
] as const;

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const { t = "all" } = await searchParams;
  const canEdit = ["owner", "admin", "agent"].includes(role);

  let q = supabase.from("fin_docs").select("*, expense_categories(name)")
    .eq("shop_id", shop.id).eq("doc_type", "expense")
    .order("created_at", { ascending: false }).limit(200);
  if (t === "pending") q = q.eq("approval_status", "pending");
  if (t === "unpaid") q = q.in("status", ["awaiting", "partial"]);
  if (t === "paid") q = q.eq("status", "paid");
  // แท็บ "รออนุมัติ" มีความหมายเฉพาะกิจการที่มีพนักงาน (agent) เป็นคนคีย์แล้วรอเจ้าของอนุมัติ
  // กิจการทำคนเดียว (เกือบทุกกิจการตอนนี้) ไม่มีทางมีรายการรออนุมัติ — แท็บว่างตลอดกาล
  // เจ้าของเจอเอง 4 ส.ค. 2569: "ตรงรออนุมัติผมยังไม่เห็นอันไหนมีให้ใช้เลย" = ของรกที่ทำให้งง
  // จึงโชว์แท็บนี้เฉพาะเมื่อ (ก) มีพนักงานในทีม หรือ (ข) มีรายการค้างอนุมัติจริง
  const [{ data }, { count: agentCount }, { count: pendingCount }] = await Promise.all([
    q,
    supabase.from("shop_members").select("user_id", { count: "exact", head: true })
      .eq("shop_id", shop.id).eq("role", "agent"),
    supabase.from("fin_docs").select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id).eq("doc_type", "expense").eq("approval_status", "pending"),
  ]);
  const showPendingTab = (agentCount ?? 0) > 0 || (pendingCount ?? 0) > 0 || t === "pending";
  const tabs = TABS.filter((x) => x.id !== "pending" || showPendingTab);
  const rows = (data ?? []) as (FinDoc & { expense_categories: { name: string } | null })[];

  const unpaidTotal = rows.filter((d) => ["awaiting", "partial"].includes(d.status)).reduce((a, d) => a + docOutstanding(d), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="ค่าใช้จ่าย"
        lead={<>บิลที่เรายังไม่ได้จ่าย <b className="text-red-600">{baht(unpaidTotal)}</b></>}
        help="ทุกบาทที่จ่ายออกไปบันทึกที่นี่ — ถ่ายรูปบิลให้ AI อ่านให้ก็ได้ ไม่ต้องพิมพ์เอง · ระบบแยก VAT ภาษีซื้อ และหัก ณ ที่จ่ายให้อัตโนมัติ เอาไปใช้ลดภาษีตอนสิ้นเดือนได้เลย"
        /* ซ่อนบนมือถือ — ปุ่ม + ลอยมี "ถ่ายรูปบิล" ที่พาไปหน้าเดียวกันนี้อยู่แล้ว
           (เหตุผลเดียวกับหน้าเอกสารขาย ดูคอมเมนต์ที่นั่น) */
        action={canEdit && (
          <Link href="/dashboard/expenses/new" className="hidden sm:inline-flex">
            <Button><Plus className="h-4 w-4" /> บันทึกค่าใช้จ่าย</Button>
          </Link>
        )}
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((x) => (
          <Link key={x.id} href={x.id === "all" ? "/dashboard/expenses" : `/dashboard/expenses?t=${x.id}`}
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
            <EmptyState icon={Receipt} title="ยังไม่มีค่าใช้จ่ายในหมวดนี้"
              hint="ทุกบิลที่จ่ายออกไป บันทึกที่นี่แล้วเอาไปลดภาษีได้"
              steps={[
                "ถ่ายรูปบิล/ใบเสร็จ แล้วส่งให้ผู้ช่วย AI — อ่านตัวเลขให้เอง ไม่ต้องพิมพ์",
                "ตรวจยอดที่ AI อ่านมา ถ้าถูกกดยืนยัน (ผิดแก้ได้ก่อนบันทึก)",
                "ระบบแยก VAT ภาษีซื้อ กับหัก ณ ที่จ่ายให้เอง พร้อมใช้ตอนยื่นภาษี",
              ]}
              action={{ href: "/dashboard/expenses/new", label: "บันทึกค่าใช้จ่ายใบแรก" }}
              secondary={{ href: "/dashboard/assistant", label: "ให้ AI อ่านบิลให้" }} />
          ) : (
            <Table>
              <thead><tr><Th>เลขที่</Th><Th>ผู้ขาย</Th><Th>หมวด</Th><Th>วันที่</Th><Th className="text-right">ยอด</Th><Th className="text-right">ค้างจ่าย</Th><Th>สถานะ</Th></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <RowLink key={d.id} href={`/dashboard/expenses/${d.id}`} className={cn(d.status === "void" && "opacity-50")}>
                    {/* คง Link ไว้บนเลขที่เอกสาร — RowLink ทำให้กดได้ทั้งแถวก็จริง แต่คีย์บอร์ด/
                        โปรแกรมอ่านหน้าจอต้องมีของที่ focus ได้จริงอย่างน้อย 1 จุดต่อแถว */}
                    <Td><Link href={`/dashboard/expenses/${d.id}`}
                      className={cn("font-medium text-emerald-700 hover:underline", d.status === "void" && "text-neutral-400 line-through")}>
                      {d.doc_number}
                    </Link></Td>
                    <Td label="ผู้ขาย">{d.contact_name ?? "-"}</Td>
                    <Td label="หมวด" className="text-neutral-500">{d.expense_categories?.name ?? "-"}</Td>
                    <Td label="วันที่" className="text-neutral-400">{dateOnlyTH(d.issue_date)}</Td>
                    <Td label="ยอด" className="text-right">{baht(d.total)}</Td>
                    <Td label="ค้างจ่าย" className="text-right">{["awaiting", "partial"].includes(d.status) ? <span className="font-medium text-red-600">{baht(docOutstanding(d))}</span> : "-"}</Td>
                    <Td label="สถานะ">{d.approval_status === "pending"
                      ? <Badge tone="amber">รออนุมัติ</Badge>
                      : d.approval_status === "rejected"
                        ? <Badge tone="red">ถูกปฏิเสธ</Badge>
                        : <Badge tone={docStatusTone(d.status as DocStatus)}>{DOC_STATUS_TH[d.status as DocStatus]}</Badge>}</Td>
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
