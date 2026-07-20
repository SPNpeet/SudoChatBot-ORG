import { requireUser } from "@/lib/shop";
import { redirect } from "next/navigation";
import { Card, CardContent, Table, Th, Input, Button } from "@/components/ui";
import ShopRow from "./shop-row";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 30;

export default async function AdminShopsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { supabase } = await requireUser();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect("/dashboard");

  const { q, page: pageStr } = await searchParams;
  const page = Math.max(1, Number(pageStr) || 1);
  const search = (q ?? "").trim();

  const { data, error } = await supabase.rpc("admin_list_shops", {
    p_search: search || null,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  const result = data as { total: number; rows: { id: string; name: string; plan: string; status: string; created_at: string; owner_email: string | null }[] } | null;
  const rows = result?.rows ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">จัดการร้านค้า</h1>
        <p className="text-sm text-neutral-400">ทั้งหมด {total} ร้าน — ระงับ/ปิดร้าน หรือเปลี่ยนแพ็กแบบ manual ได้ที่นี่</p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">โหลดรายชื่อร้านไม่สำเร็จ: {error.message}</p>}

      <form className="flex gap-2" action="/dashboard/admin/shops">
        <Input name="q" defaultValue={search} placeholder="ค้นหาชื่อร้าน..." className="max-w-xs" />
        <Button type="submit" variant="outline">ค้นหา</Button>
      </form>

      <Card>
        <CardContent className="px-0 pb-0 pt-0">
          {rows.length === 0 ? (
            <p className="py-14 text-center text-sm text-neutral-400">ไม่พบร้านค้า</p>
          ) : (
            <Table>
              <thead><tr><Th>ร้าน</Th><Th>เจ้าของ</Th><Th>แพ็ก</Th><Th>สถานะ</Th><Th>สมัครเมื่อ</Th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <ShopRow key={r.id} id={r.id} name={r.name} ownerEmail={r.owner_email} plan={r.plan} status={r.status} createdAt={r.created_at} />
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <a className="text-emerald-600 hover:underline" href={`/dashboard/admin/shops?q=${encodeURIComponent(search)}&page=${page - 1}`}>&larr; ก่อนหน้า</a>}
          <span className="text-neutral-400">หน้า {page}/{totalPages}</span>
          {page < totalPages && <a className="text-emerald-600 hover:underline" href={`/dashboard/admin/shops?q=${encodeURIComponent(search)}&page=${page + 1}`}>ถัดไป &rarr;</a>}
        </div>
      )}
    </div>
  );
}
