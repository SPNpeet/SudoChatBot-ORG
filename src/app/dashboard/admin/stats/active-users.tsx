// ============================================================
//  "ใครใช้งานอยู่ตอนนี้ / ใครเล่นวันนี้บ้าง" — คำขอเจ้าของ 4 ส.ค. 2569
//
//  เดิมการ์ด "ใช้งานจริง (24 ชม.)" บอกแค่ตัวเลขรวม เจ้าของตอบไม่ได้ว่าใครคือคนเหล่านั้น
//  จึงตามผู้ใช้จริงไม่ได้เลย (โทรถามคนที่เพิ่งสมัครแล้วเงียบไม่ได้ เพราะไม่รู้ว่าใคร)
//
//  ⚠️ เลือก <details> ในหน้าเดิม ไม่ใช่ popup หรือหน้าใหม่ — เจ้าของถามว่าอันไหนดีกว่า
//   · popup ต้องมี JS + จัดการ focus/ปิดด้วย Esc + บนมือถือมักหลุดขอบจอ (เคยเกิดจริงกับกระดิ่ง)
//   · หน้าใหม่ = โหลดใหม่ 1 รอบเพื่อดูข้อมูลไม่กี่แถว และหลุดบริบทจากตัวเลขสรุป
//   · <details> กางในที่ ไม่ต้องมี JS เลย (server component ล้วน) มือถือใช้ได้ทันที
//
//  ⚠️ PDPA: อีเมลมาจาก RPC ที่เช็ค is_platform_admin ฝั่ง DB — ไม่ใช่เช็คแค่ฝั่งหน้าจอ
//  และห้ามเขียนอีเมลจริงลงไฟล์ใด ๆ ใน repo (public)
// ============================================================
import { createClient } from "@/lib/supabase/server";
import { Activity } from "lucide-react";

interface ActiveUser {
  user_id: string;
  email: string | null;
  shop_name: string | null;
  actions: number;
  last_action_at: string;
  minutes_ago: number;
  is_online: boolean;
}

/** เวลาที่อ่านแล้วรู้ทันทีว่าเพิ่งใช้หรือนานแล้ว */
function ago(min: number): string {
  if (min < 1) return "เมื่อครู่นี้";
  if (min < 60) return `${Math.round(min)} นาทีที่แล้ว`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ชม.ที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

export default async function ActiveUsersPanel() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_active_users", { p_hours: 24 });
  const rows = (data ?? []) as ActiveUser[];
  const online = rows.filter((r) => r.is_online);

  return (
    <details className="group rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Activity className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="min-w-0">
            <span className="block text-sm font-bold">ใครใช้งานอยู่บ้าง (24 ชม.)</span>
            <span className="block text-xs text-neutral-500">
              {online.length > 0
                ? `ออนไลน์ตอนนี้ ${online.length} คน · ทั้งหมด ${rows.length} คน`
                : `ตอนนี้ไม่มีใครออนไลน์ · 24 ชม.ที่ผ่านมา ${rows.length} คน`}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-xs text-emerald-700 group-open:hidden">กดดูรายชื่อ</span>
      </summary>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
          โหลดรายชื่อไม่สำเร็จ: {error.message}
        </p>
      )}

      {!error && rows.length === 0 && (
        <p className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          ยังไม่มีใครลงมือทำอะไรใน 24 ชม.ที่ผ่านมา
        </p>
      )}

      {rows.length > 0 && (
        // มือถือ: การ์ดต่อแถว · จอกว้าง: ตาราง — ตารางบนจอ 375px บีบจนอ่านอีเมลไม่จบ
        <ul className="mt-3 divide-y divide-neutral-100">
          {rows.map((r) => (
            <li key={r.user_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                r.is_online ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${r.is_online ? "bg-emerald-500" : "bg-neutral-300"}`} />
                {r.is_online ? "ออนไลน์" : ago(r.minutes_ago)}
              </span>
              <span className="min-w-0 flex-1 basis-40">
                <span className="block truncate text-sm font-medium text-neutral-800">{r.email ?? "(ไม่มีอีเมล)"}</span>
                <span className="block truncate text-xs text-neutral-400">
                  {r.shop_name ?? "ยังไม่มีกิจการ"} · ลงมือทำ {r.actions} ครั้ง
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
