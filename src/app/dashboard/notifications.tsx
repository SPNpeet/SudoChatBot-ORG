import { getCurrentShop } from "@/lib/shop";
import { markNotificationRead } from "./actions";
import { cn } from "@/lib/utils";

/** แถบแจ้งเตือนของร้าน (เครดิตใกล้หมด/บอทหยุด) — แสดงเหนือเนื้อหาทุกหน้า dashboard */
export default async function Notifications() {
  const { supabase, shop } = await getCurrentShop();
  const { data } = await supabase.from("notifications")
    .select("id,type,title,body,created_at")
    .eq("shop_id", shop.id).eq("read", false)
    .order("created_at", { ascending: false }).limit(3);
  const items = data ?? [];
  if (items.length === 0) return null;

  async function dismiss(fd: FormData) {
    "use server";
    await markNotificationRead(String(fd.get("id")), String(fd.get("shop_id")));
  }

  return (
    <div className="mb-5 space-y-2">
      {items.map((n) => (
        <div key={n.id} className={cn(
          "flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
          n.type === "bot_blocked" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800",
        )}>
          <div>
            <p className="font-medium">{n.type === "bot_blocked" ? "🛑" : "⚠️"} {n.title}</p>
            {n.body && <p className="mt-0.5 text-xs opacity-80">{n.body}</p>}
            <a href="/dashboard/billing" className="mt-1 inline-block text-xs font-medium underline">ไปหน้าเติมเงิน →</a>
          </div>
          <form action={dismiss}>
            <input type="hidden" name="id" value={n.id} />
            <input type="hidden" name="shop_id" value={shop.id} />
            <button className="text-xs opacity-60 hover:opacity-100" aria-label="ปิดการแจ้งเตือน">✕</button>
          </form>
        </div>
      ))}
    </div>
  );
}
