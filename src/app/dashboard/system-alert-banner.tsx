import { createServiceClient } from "@/lib/supabase/server";
import { AlertTriangle, Megaphone, Siren } from "lucide-react";

// แบนเนอร์ประกาศจากผู้ดูแลระบบ — ลูกค้าเห็นทันทีว่าระบบมีปัญหาอะไรอยู่ ไม่ต้องเดา
export default async function SystemAlertBanner() {
  const svc = createServiceClient();
  const { data } = await svc.from("system_alerts")
    .select("id,level,title,body,ends_at")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(2);
  const rows = (data ?? []).filter((a) => !a.ends_at || new Date(a.ends_at) > new Date());
  if (!rows.length) return null;

  return (
    <div className="mb-4 space-y-2">
      {rows.map((a) => {
        const tone = a.level === "critical"
          ? "border-red-200 bg-red-50 text-red-800"
          : a.level === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-sky-200 bg-sky-50 text-sky-800";
        const Icon = a.level === "critical" ? Siren : a.level === "warning" ? AlertTriangle : Megaphone;
        return (
          <div key={a.id} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 ${tone}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{a.title}</p>
              {a.body && <p className="mt-0.5 text-xs leading-relaxed opacity-90">{a.body}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
