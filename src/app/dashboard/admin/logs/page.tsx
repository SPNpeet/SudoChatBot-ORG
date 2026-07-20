import { requireUser } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, Table, Th, Td, Input, Button, Badge } from "@/components/ui";
import { dateTH } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function AdminLogsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { supabase } = await requireUser();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect("/dashboard");

  const { q, page: pageStr } = await searchParams;
  const page = Math.max(1, Number(pageStr) || 1);
  const search = (q ?? "").trim();

  const svc = createServiceClient();
  let query = svc.from("audit_logs").select("id,action,actor_type,actor_id,resource_type,resource_id,details,created_at,shops(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (search) query = query.ilike("action", `%${search}%`);
  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as {
    id: string; action: string; actor_type: string; actor_id: string | null; resource_type: string | null;
    resource_id: string | null; details: Record<string, unknown>; created_at: string; shops: { name: string } | null;
  }[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">ประวัติการทำรายการ (Audit Log)</h1>
        <p className="text-sm text-neutral-400">ทั้งหมด {total} รายการ — เหตุการณ์สำคัญของทั้งระบบ</p>
      </div>

      <form className="flex gap-2" action="/dashboard/admin/logs">
        <Input name="q" defaultValue={search} placeholder="ค้นหา action เช่น topup_confirmed..." className="max-w-xs" />
        <Button type="submit" variant="outline">ค้นหา</Button>
      </form>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">โหลดไม่สำเร็จ: {error.message}</p>}

      <Card>
        <CardContent className="px-0 pb-0 pt-0">
          {rows.length === 0 ? (
            <p className="py-14 text-center text-sm text-neutral-400">ไม่พบรายการ</p>
          ) : (
            <Table>
              <thead><tr><Th>เหตุการณ์</Th><Th>ร้าน</Th><Th>ผู้กระทำ</Th><Th>รายละเอียด</Th><Th>เมื่อ</Th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-medium">{r.action}</Td>
                    <Td className="text-neutral-500">{r.shops?.name ?? "-"}</Td>
                    <Td><Badge tone={r.actor_type === "system" ? "neutral" : "blue"}>{r.actor_type}</Badge></Td>
                    <Td className="max-w-72 truncate text-neutral-400" title={JSON.stringify(r.details)}>
                      {r.resource_type ? `${r.resource_type}${r.resource_id ? `:${r.resource_id.slice(0, 8)}` : ""}` : "-"}
                      {Object.keys(r.details ?? {}).length > 0 && ` · ${JSON.stringify(r.details).slice(0, 60)}`}
                    </Td>
                    <Td className="text-neutral-400">{dateTH(r.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <a className="text-emerald-600 hover:underline" href={`/dashboard/admin/logs?q=${encodeURIComponent(search)}&page=${page - 1}`}>&larr; ก่อนหน้า</a>}
          <span className="text-neutral-400">หน้า {page}/{totalPages}</span>
          {page < totalPages && <a className="text-emerald-600 hover:underline" href={`/dashboard/admin/logs?q=${encodeURIComponent(search)}&page=${page + 1}`}>ถัดไป &rarr;</a>}
        </div>
      )}
    </div>
  );
}
