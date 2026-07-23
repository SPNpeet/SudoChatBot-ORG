// ============================================================
//  สมุดรายวัน (GL) — ทุกธุรกรรมของระบบลงเดบิต/เครดิตอัตโนมัติ
//  นักบัญชีเข้ามารีวิว/เพิ่มรายการปรับปรุง (JV) ได้ ไม่ต้องคีย์ซ้ำ
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Badge, Card, CardContent, EmptyState } from "@/components/ui";
import { bahtDoc, dateOnlyTH } from "@/lib/utils";
import type { Account, JournalEntry } from "@/lib/types/finance";
import ManualJournalForm from "./manual-form";

export const dynamic = "force-dynamic";

const SOURCE_TH: Record<string, string> = {
  sale: "ขาย", receipt: "รับเงิน", expense: "ค่าใช้จ่าย", payment: "จ่ายเงิน",
  stock: "สต๊อก/ต้นทุน", manual: "บันทึกเอง", reversal: "กลับรายการ",
};

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const canEdit = ["owner", "admin", "agent"].includes(role);
  const { m } = await searchParams;
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  const monthStart = `${month}-01`;
  const nextMonth = new Date(new Date(monthStart).getTime() + 40 * 864e5).toISOString().slice(0, 7) + "-01";

  const [{ data: entries }, { data: accounts }] = await Promise.all([
    supabase.from("journal_entries")
      .select("*, journal_lines(*, chart_of_accounts(code,name))")
      .eq("shop_id", shop.id).gte("entry_date", monthStart).lt("entry_date", nextMonth)
      .order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(300),
    supabase.from("chart_of_accounts").select("*").eq("shop_id", shop.id).eq("status", "active").order("code"),
  ]);

  const rows = (entries ?? []) as unknown as JournalEntry[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">สมุดรายวัน</h1>
          <p className="text-sm text-neutral-400">
            ระบบลงเดบิต/เครดิตให้อัตโนมัติทุกธุรกรรม — นักบัญชีรีวิวได้เลย ไม่ต้องคีย์ซ้ำ · งบทดลองดูที่หน้ารายงาน
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form method="get" className="flex items-center gap-2">
            <input type="month" name="m" defaultValue={month}
              className="h-9 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-emerald-500" />
            <button className="h-9 rounded-xl bg-neutral-900 px-3 text-sm text-white">ดู</button>
          </form>
          {canEdit && <ManualJournalForm shopId={shop.id} accounts={(accounts ?? []) as Account[]} />}
        </div>
      </div>

      {rows.length === 0 ? (
        <Card><CardContent className="pt-5">
          <EmptyState title="เดือนนี้ยังไม่มีรายการ" hint="เมื่อออกเอกสารขาย/บันทึกค่าใช้จ่าย/รับ-จ่ายเงิน รายการจะลงสมุดรายวันที่นี่อัตโนมัติ" />
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((e) => {
            const lines = [...(e.journal_lines ?? [])].sort((a, b) => a.sort - b.sort);
            const total = lines.reduce((a, l) => a + Number(l.debit), 0);
            return (
              <Card key={e.id}>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{e.entry_number}</p>
                      <Badge tone={e.source_type === "manual" ? "blue" : e.source_type === "reversal" ? "red" : "neutral"}>
                        {SOURCE_TH[e.source_type] ?? e.source_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-400">{dateOnlyTH(e.entry_date)} · รวม {bahtDoc(total)}</p>
                  </div>
                  {e.memo && <p className="mt-0.5 text-sm text-neutral-500">{e.memo}</p>}
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-neutral-400">
                        <th className="py-1 text-left">บัญชี</th>
                        <th className="py-1 text-right">เดบิต</th>
                        <th className="py-1 text-right">เครดิต</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.id} className="border-t border-neutral-50">
                          <td className={`py-1 ${Number(l.credit) > 0 ? "pl-6 text-neutral-500" : ""}`}>
                            <span className="mr-1.5 text-[11px] text-neutral-300">{l.chart_of_accounts?.code}</span>
                            {l.chart_of_accounts?.name}
                          </td>
                          <td className="py-1 text-right">{Number(l.debit) > 0 ? bahtDoc(l.debit) : ""}</td>
                          <td className="py-1 text-right">{Number(l.credit) > 0 ? bahtDoc(l.credit) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
