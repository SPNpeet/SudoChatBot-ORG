import { getCurrentShop } from "@/lib/shop";
import { markNotificationRead } from "./actions";
import { cn } from "@/lib/utils";
import { X, ArrowRight } from "lucide-react";
import { ACTION_CHIP } from "@/components/ui";

/** แถบแจ้งเตือนของกิจการ (เครดิตใกล้หมด ฯลฯ) — แสดงเหนือเนื้อหาทุกหน้า dashboard */
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
          n.type === "bot_blocked" ? "border-red-200 bg-red-50 text-red-800"
            : n.type === "order_paid" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : n.type === "handoff" ? "border-blue-200 bg-blue-50 text-blue-800"
            : "border-amber-200 bg-amber-50 text-amber-800",
        )}>
          <div>
            <p className="font-medium">{n.title}</p>
            {n.body && <p className="mt-0.5 text-xs opacity-80">{n.body}</p>}
            {/* ปุ่มจริง ไม่ใช่ข้อความขีดเส้นใต้ — เห็นขอบเขตกดชัดและกดแม่นบนมือถือ (ดู ACTION_CHIP) */}
            <a
              href={n.type === "order_paid" ? "/dashboard/money" : "/dashboard/billing"}
              className={cn(ACTION_CHIP, "mt-2 border-current/25")}
            >
              {n.type === "order_paid" ? "ไปหน้าการเงิน" : "ไปหน้าเติมเงิน"}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <form action={dismiss}>
            <input type="hidden" name="id" value={n.id} />
            <input type="hidden" name="shop_id" value={shop.id} />
            <button className="-m-2 shrink-0 rounded-lg p-2 opacity-60 transition-opacity hover:opacity-100" aria-label="ปิดการแจ้งเตือน"><X className="h-3.5 w-3.5" /></button>
          </form>
        </div>
      ))}
    </div>
  );
}
