// ============================================================
//  ค่าใช้จ่าย/รายจ่าย (AP) — ตั้งหนี้ · ทำจ่าย · แนบบิล · AI อ่านบิลให้
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Badge, Button, Card, CardContent, EmptyState, Table, Th, Td } from "@/components/ui";
import { baht, dateOnlyTH, cn } from "@/lib/utils";
import { DOC_STATUS_TH, docStatusTone, docOutstanding } from "@/lib/finance";
import type { DocStatus, FinDoc } from "@/lib/types/finance";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "all", label: "ทั้งหมด" },
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
  if (t === "unpaid") q = q.in("status", ["awaiting", "partial"]);
  if (t === "paid") q = q.eq("status", "paid");
  const { data } = await q;
  const rows = (data ?? []) as (FinDoc & { expense_categories: { name: string } | null })[];

  const unpaidTotal = rows.filter((d) => ["awaiting", "partial"].includes(d.status)).reduce((a, d) => a + docOutstanding(d), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">ค่าใช้จ่าย</h1>
          <p className="text-sm text-neutral-400">
            ถ่ายรูปบิลให้ AI ลงบัญชีให้ หรือคีย์เอง · ค้างจ่ายตอนนี้ <span className="font-semibold text-red-600">{baht(unpaidTotal)}</span>
          </p>
        </div>
        {canEdit && (
          <Link href="/dashboard/expenses/new">
            <Button><Plus className="h-4 w-4" /> บันทึกค่าใช้จ่าย <Sparkles className="h-3.5 w-3.5 opacity-70" /></Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((x) => (
          <Link key={x.id} href={x.id === "all" ? "/dashboard/expenses" : `/dashboard/expenses?t=${x.id}`}
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
            <EmptyState icon="📸" title="ยังไม่มีค่าใช้จ่ายในหมวดนี้"
              hint="ถ่ายรูปบิลแล้วให้ AI อ่าน-ลงบัญชีให้ทั้งใบ หรือคีย์เองก็ได้ ระบบแยก VAT/หัก ณ ที่จ่ายให้ครบ"
              action={{ href: "/dashboard/expenses/new", label: "+ บันทึกค่าใช้จ่ายใบแรก" }} />
          ) : (
            <Table>
              <thead><tr><Th>เลขที่</Th><Th>ผู้ขาย</Th><Th>หมวด</Th><Th>วันที่</Th><Th className="text-right">ยอด</Th><Th className="text-right">ค้างจ่าย</Th><Th>สถานะ</Th></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className={cn("hover:bg-neutral-50", d.status === "void" && "opacity-50")}>
                    <Td><Link className={cn("font-medium text-emerald-700 hover:underline", d.status === "void" && "text-neutral-400 line-through")} href={`/dashboard/expenses/${d.id}`}>{d.doc_number}</Link></Td>
                    <Td>{d.contact_name ?? "-"}</Td>
                    <Td className="text-neutral-500">{d.expense_categories?.name ?? "-"}</Td>
                    <Td className="text-neutral-400">{dateOnlyTH(d.issue_date)}</Td>
                    <Td className="text-right">{baht(d.total)}</Td>
                    <Td className="text-right">{["awaiting", "partial"].includes(d.status) ? <span className="font-medium text-red-600">{baht(docOutstanding(d))}</span> : "-"}</Td>
                    <Td><Badge tone={docStatusTone(d.status as DocStatus)}>{DOC_STATUS_TH[d.status as DocStatus]}</Badge></Td>
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
