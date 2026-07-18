// ============================================================
//  คลังสลิป — รวมสลิปโอนเงินที่ลูกค้าส่งเข้าแชททุกออเดอร์ของร้าน
//  ดูย้อนหลัง/ตรวจสอบได้ในที่เดียว รูปอยู่ bucket ส่วนตัว เปิดผ่าน signed URL
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge, Card, CardContent, EmptyState } from "@/components/ui";
import { baht, dateTH } from "@/lib/utils";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "all", label: "ทั้งหมด" },
  { id: "waiting", label: "รอตรวจ" },
  { id: "verified", label: "ผ่านแล้ว" },
  { id: "rejected", label: "ถูกปฏิเสธ" },
] as const;

interface SlipRow {
  id: string;
  amount: number;
  status: string;
  slip_storage_path: string | null;
  slip_trans_ref: string | null;
  verified_by: string | null;
  verified_at: string | null;
  error: string | null;
  created_at: string;
  orders: { order_number: string; total: number; status: string } | null;
}

export default async function SlipsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { shop } = await getCurrentShop(); // ยืนยันสมาชิกก่อนใช้ service client
  const { f = "all" } = await searchParams;
  const svc = createServiceClient();

  let q = svc.from("payments")
    .select("id,amount,status,slip_storage_path,slip_trans_ref,verified_by,verified_at,error,created_at,orders(order_number,total,status)")
    .eq("shop_id", shop.id)
    .not("slip_storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(120);
  if (f === "waiting") q = q.in("status", ["pending", "verifying"]);
  else if (f === "verified") q = q.eq("status", "verified");
  else if (f === "rejected") q = q.eq("status", "rejected");

  const { data } = await q;
  const rows = (data ?? []) as unknown as SlipRow[];

  // นับสรุปทุกสถานะ (ไม่ขึ้นกับ filter)
  const { data: allRows } = await svc.from("payments").select("status")
    .eq("shop_id", shop.id).not("slip_storage_path", "is", null);
  const counts = { all: allRows?.length ?? 0, waiting: 0, verified: 0, rejected: 0 };
  for (const r of allRows ?? []) {
    if (r.status === "verified") counts.verified++;
    else if (r.status === "rejected") counts.rejected++;
    else counts.waiting++;
  }

  // signed URL รูปสลิป (1 ชั่วโมง) — bucket slips เป็น private
  const paths = rows.map((r) => r.slip_storage_path!).filter(Boolean);
  const urlMap = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await svc.storage.from("slips").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl);
    }
  }

  const tone = (s: string) => s === "verified" ? "green" : s === "rejected" ? "red" : "amber";
  const statusTH: Record<string, string> = { pending: "รอตรวจ", verifying: "กำลังตรวจ", verified: "ผ่านแล้ว", rejected: "ถูกปฏิเสธ" };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">คลังสลิป</h1>
        <p className="text-sm text-neutral-400">
          สลิปโอนเงินทั้งหมดที่ลูกค้าส่งเข้าแชทตอนบอทปิดการขาย — ดูย้อนหลังและตรวจสอบได้ที่นี่
        </p>
      </div>

      {/* filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((t) => (
          <Link key={t.id} href={t.id === "all" ? "/dashboard/slips" : `/dashboard/slips?f=${t.id}`}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium",
              f === t.id ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50",
            )}>
            {t.label} ({counts[t.id as keyof typeof counts]})
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card><CardContent className="pt-5">
          <EmptyState title="ยังไม่มีสลิปในหมวดนี้"
            hint="เมื่อลูกค้าส่งสลิปเข้าแชทตอนชำระเงิน ระบบจะเก็บและแสดงที่นี่อัตโนมัติ" />
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((r) => {
            const url = r.slip_storage_path ? urlMap.get(r.slip_storage_path) : undefined;
            return (
              <Card key={r.id} className="overflow-hidden">
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="block bg-neutral-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`สลิป ${r.orders?.order_number ?? ""}`}
                      className="h-48 w-full object-contain transition-transform hover:scale-[1.02]" />
                  </a>
                ) : (
                  <div className="flex h-48 items-center justify-center bg-neutral-50 text-xs text-neutral-400">ไม่พบรูป</div>
                )}
                <CardContent className="space-y-1.5 pt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{r.orders?.order_number ?? "-"}</p>
                    <Badge tone={tone(r.status)}>{statusTH[r.status] ?? r.status}</Badge>
                  </div>
                  <p className="text-lg font-bold tracking-tight">{baht(r.amount)}</p>
                  <p className="text-[11px] text-neutral-400">
                    {dateTH(r.created_at)}
                    {r.verified_by && ` · ตรวจโดย${r.verified_by === "auto" ? "ระบบ" : r.verified_by === "omise" ? " Omise" : "แอดมิน"}`}
                  </p>
                  {r.slip_trans_ref && <p className="truncate text-[11px] text-neutral-400">อ้างอิง: {r.slip_trans_ref}</p>}
                  {r.status === "rejected" && r.error && (
                    <p className="rounded-lg bg-red-50 px-2 py-1 text-[11px] text-red-600">{r.error}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-neutral-400">
        สลิปถูกเก็บใน storage ส่วนตัวของระบบ (ลิงก์รูปหมดอายุใน 1 ชั่วโมง เปิดหน้านี้ใหม่เพื่อขอลิงก์ใหม่) ·
        สลิปที่ผ่านการตรวจแล้วระบบตัดสต๊อกและอัปเดตออเดอร์ให้อัตโนมัติ
      </p>
    </div>
  );
}
