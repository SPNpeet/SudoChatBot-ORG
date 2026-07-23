// ============================================================
//  ผู้ติดต่อ — ลูกค้า/ผู้ขายในที่เดียว ใช้ออกเอกสารและดูยอดค้างรายคน
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent, EmptyState, Badge } from "@/components/ui";
import { baht } from "@/lib/utils";
import { docOutstanding } from "@/lib/finance";
import { cn } from "@/lib/utils";
import Link from "next/link";
import ContactForm from "./contact-form";
import type { Contact } from "@/lib/types/finance";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "all", label: "ทั้งหมด" },
  { id: "customer", label: "ลูกค้า" },
  { id: "vendor", label: "ผู้ขาย/ซัพพลายเออร์" },
] as const;

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const { f = "all" } = await searchParams;
  const canEdit = ["owner", "admin", "agent"].includes(role);

  let q = supabase.from("contacts").select("*").eq("shop_id", shop.id).eq("status", "active").order("name");
  if (f === "customer") q = q.in("kind", ["customer", "both"]);
  if (f === "vendor") q = q.in("kind", ["vendor", "both"]);
  const [{ data: contacts }, { data: openDocs }] = await Promise.all([
    q,
    supabase.from("fin_docs").select("contact_id,doc_type,total,wht_amount,paid_amount")
      .eq("shop_id", shop.id).in("status", ["awaiting", "partial"]).not("contact_id", "is", null),
  ]);

  // ยอดค้างรับ (invoice) / ค้างจ่าย (expense) ต่อผู้ติดต่อ
  const owed = new Map<string, { ar: number; ap: number }>();
  for (const d of openDocs ?? []) {
    const cur = owed.get(d.contact_id) ?? { ar: 0, ap: 0 };
    const out = docOutstanding(d);
    if (d.doc_type === "invoice") cur.ar += out;
    if (d.doc_type === "expense") cur.ap += out;
    owed.set(d.contact_id, cur);
  }

  const rows = (contacts ?? []) as Contact[];
  const kindTH: Record<string, string> = { customer: "ลูกค้า", vendor: "ผู้ขาย", both: "ลูกค้า+ผู้ขาย" };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">ผู้ติดต่อ</h1>
          <p className="text-sm text-neutral-400">ลูกค้าและผู้ขายของ {shop.name} — เห็นยอดค้างรับ/ค้างจ่ายรายคน</p>
        </div>
        {canEdit && <ContactForm shopId={shop.id} />}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((t) => (
          <Link key={t.id} href={t.id === "all" ? "/dashboard/contacts" : `/dashboard/contacts?f=${t.id}`}
            className={cn(
              "inline-flex min-h-[36px] items-center rounded-full px-4 py-1.5 text-sm font-medium",
              f === t.id ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
            )}>
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card><CardContent className="pt-5">
          <EmptyState title="ยังไม่มีผู้ติดต่อ" hint="เพิ่มลูกค้า/ผู้ขายเพื่อออกเอกสารได้เร็วขึ้น หรือให้ผู้ช่วย AI เพิ่มให้จากไฟล์" />
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => {
            const o = owed.get(c.id);
            return (
              <Card key={c.id}>
                <CardContent className="space-y-1.5 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{c.name}</p>
                    <Badge tone={c.kind === "vendor" ? "blue" : c.kind === "both" ? "amber" : "green"}>{kindTH[c.kind]}</Badge>
                  </div>
                  {c.tax_id && <p className="text-xs text-neutral-400">เลขผู้เสียภาษี {c.tax_id}{c.branch ? ` · ${c.branch}` : ""}</p>}
                  {c.phone && <p className="text-xs text-neutral-400">โทร {c.phone}</p>}
                  {(o?.ar || o?.ap) ? (
                    <div className="flex gap-3 pt-1 text-xs">
                      {o.ar > 0 && <span className="font-medium text-amber-600">ค้างรับ {baht(o.ar)}</span>}
                      {o.ap > 0 && <span className="font-medium text-red-600">ค้างจ่าย {baht(o.ap)}</span>}
                    </div>
                  ) : <p className="pt-1 text-xs text-neutral-300">ไม่มียอดค้าง</p>}
                  {canEdit && (
                    <div className="pt-1.5">
                      <ContactForm shopId={shop.id} contact={c} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
