// ============================================================
//  ผู้ติดต่อ — ลูกค้า/ผู้ขายในที่เดียว ใช้ออกเอกสารและดูยอดค้างรายคน
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent, EmptyState, Badge, PageHeader } from "@/components/ui";
import { baht } from "@/lib/utils";
import { docOutstanding } from "@/lib/finance";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Users } from "lucide-react";
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
  const arTotal = [...owed.values()].reduce((a, v) => a + v.ar, 0);
  const apTotal = [...owed.values()].reduce((a, v) => a + v.ap, 0);

  return (
    <div className="space-y-5">
      {/* ⚠️ คำโปรยต้องบอก "ของจริงที่เพิ่งเปลี่ยน" ไม่ใช่ทวนชื่อหน้า (8 ส.ค. 2569)
          เดิมเขียนว่า "ลูกค้าและผู้ขายทั้งหมดของ <ชื่อร้าน>" ซึ่งไม่ได้อะไรเพิ่มจากคำว่า
          "ผู้ติดต่อ" ที่อยู่ข้างบนเลย — เจ้าของบอกว่าอ่านแล้วเหมือนเขียนส่ง ๆ
          บรรทัดนี้คนกวาดตาผ่านทุกครั้งที่เข้าหน้า ต้องคุ้มค่าที่กวาด */}
      <PageHeader icon={Users} tone="violet"
        title="ผู้ติดต่อ"
        lead={<>
          {rows.length} รายชื่อ
          {arTotal > 0 && <> · ค้างรับรวม <b className="text-amber-600">{baht(arTotal)}</b></>}
          {apTotal > 0 && <> · ค้างจ่ายรวม <b className="text-red-600">{baht(apTotal)}</b></>}
        </>}
        help="เก็บชื่อ เลขผู้เสียภาษี และที่อยู่ของคู่ค้าไว้ครั้งเดียว — ครั้งต่อไปออกเอกสารแค่เลือกชื่อ ระบบเติมให้ครบเอง ออกใบกำกับภาษีเต็มรูปได้ทันที และเห็นด้วยว่าใครค้างเราอยู่เท่าไหร่"
        action={canEdit && <ContactForm shopId={shop.id} />}
      />

      {/* แถบตัวกรองต้องเป็นแถวเดียวที่เลื่อนได้ ห้ามตกบรรทัด (แก้ 28 ส.ค. 2569)
          บนจอ 390px ตัวกรองหลายอันตกลงมา 2-3 แถว กินหน้าจอแรกก่อนที่ผู้ใช้จะเห็นรายการจริง
          เหตุผลและ CSS เดียวกับหน้ารายงาน ดู .tabstrip ใน globals.css */}
      <div className="tabstrip">
        {FILTERS.map((t) => (
          <Link key={t.id} href={t.id === "all" ? "/dashboard/contacts" : `/dashboard/contacts?f=${t.id}`}
            className={cn(
              "inline-flex min-h-[44px] items-center rounded-full px-4 py-1.5 text-sm font-medium",
              f === t.id ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
            )}>
            {t.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card><CardContent className="pt-5">
          <EmptyState icon={Users} title="ยังไม่มีผู้ติดต่อ"
            hint="เก็บลูกค้าและผู้ขายไว้ที่นี่ ออกเอกสารครั้งต่อไปไม่ต้องพิมพ์ที่อยู่ใหม่"
            steps={[
              "ใส่ชื่อ + เลขผู้เสียภาษี 13 หลัก (ถ้ามี) แค่นี้ออกใบกำกับภาษีเต็มรูปได้",
              "ตอนออกเอกสารแค่พิมพ์ชื่อ ระบบเติมที่อยู่/เลขภาษีให้เอง",
              "การ์ดของแต่ละคนจะโชว์ว่าค้างเราอยู่เท่าไร หรือเราค้างเขาเท่าไร",
            ]}
            action={{ href: "/dashboard/assistant", label: "ให้ผู้ช่วย AI เพิ่มให้" }} />
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => {
            const o = owed.get(c.id);
            return (
              <Card key={c.id}>
                <CardContent className="space-y-1.5 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    {/* กดชื่อ = เข้าหน้ารายคน (ประวัติ + ออกเอกสารต่อได้เลย) — object-centric ตามผลตรวจ 28 ส.ค. 2569 */}
                    {/* aria-label ต้องบอกว่าเปิด "ของใคร" — ผู้ติดต่อชื่อซ้ำกันมีจริง (ด่าน check:dupbuttons)
                        เขียนยาวโดยตั้งใจ: ป้ายที่สั้นและซ้ำกันหลายใบในจอเดียวคือสิ่งที่ด่านห้าม */}
                    <Link href={`/dashboard/contacts/${c.id}`}
                      aria-label={`เปิดประวัติ ยอดค้าง และออกเอกสารให้ผู้ติดต่อ ${c.name}`}
                      className="font-semibold text-neutral-900 hover:text-emerald-700 hover:underline">{c.name}</Link>
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
                  <Link href={`/dashboard/contacts/${c.id}`}
                    aria-label={`ดูประวัติเอกสารและออกเอกสารใหม่ให้ผู้ติดต่อ ${c.name}`}
                    className="inline-block pt-1 text-xs font-medium text-emerald-700 hover:underline">
                    ประวัติ + ออกเอกสารให้รายนี้ →
                  </Link>
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
