import { requireUser } from "@/lib/shop";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";
import FeedbackRow from "./feedback-row";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "open", label: "ยังไม่ได้ดู" },
  { key: "resolved", label: "จัดการแล้ว" },
  { key: "dismissed", label: "ข้ามไป" },
  { key: "all", label: "ทั้งหมด" },
];

export default async function AdminFeedbackPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { supabase } = await requireUser();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect("/dashboard");

  const { tab: tabParam } = await searchParams;
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam! : "open";

  let query = supabase.from("feedback").select("id,message,page,status,created_at,shops(name)").order("created_at", { ascending: false }).limit(100);
  if (tab !== "all") query = query.eq("status", tab);
  const { data, error } = await query;
  const rows = (data ?? []) as unknown as { id: string; message: string; page: string | null; status: string; created_at: string; shops: { name: string } | null }[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">ความเห็นจากผู้ใช้</h1>
        <p className="text-sm text-neutral-400">ปุ่มแนะนำ/ติชมในแอปของทุกร้าน — ไล่ปิดงานได้ที่นี่</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <Link key={t.key} href={`/dashboard/admin/feedback?tab=${t.key}`}
            className={cn("shrink-0 rounded-xl px-3.5 py-1.5 text-sm", tab === t.key ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200")}>
            {t.label}
          </Link>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">โหลดไม่สำเร็จ: {error.message}</p>}

      <Card>
        <CardContent className="space-y-2 pt-5">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">ไม่มีความเห็นในหมวดนี้</p>
          ) : (
            rows.map((f) => (
              <FeedbackRow key={f.id} id={f.id} message={f.message} page={f.page} shopName={f.shops?.name ?? "-"} createdAt={f.created_at} status={f.status} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
