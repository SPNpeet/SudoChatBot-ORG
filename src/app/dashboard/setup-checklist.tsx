// ============================================================
//  Setup checklist — พาเจ้าของร้านใหม่เดินครบ 5 ก้าวจนบอทขายได้จริง
//  แสดงเฉพาะตอนยังทำไม่ครบ ครบแล้วหายไปเอง
// ============================================================
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import type { Shop } from "@/lib/types/db";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function SetupChecklist({ shop }: { shop: Shop }) {
  // ผู้เรียก (dashboard layout) ยืนยันสมาชิกผ่าน getCurrentShop แล้ว
  const svc = createServiceClient();
  const [products, knowledge, payment, playgroundUse, channels] = await Promise.all([
    svc.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "active"),
    svc.from("knowledge_documents").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    svc.from("shop_payment_settings").select("promptpay_id").eq("shop_id", shop.id).maybeSingle(),
    svc.from("ai_usage_logs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).is("conversation_id", null),
    svc.from("channels").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "active"),
  ]);

  const steps = [
    {
      title: "เพิ่มสินค้าชิ้นแรก",
      hint: "บอทขายได้เฉพาะสินค้าที่อยู่ในระบบ",
      href: "/dashboard/products",
      done: (products.count ?? 0) > 0,
    },
    {
      title: "สอนบอทให้รู้จักร้าน",
      hint: "อัปโหลด PDF หรือพิมพ์ นโยบายร้าน วิธีส่ง การรับประกัน",
      href: "/dashboard/knowledge",
      done: (knowledge.count ?? 0) > 0,
    },
    {
      title: "ตั้งพร้อมเพย์รับเงิน",
      hint: "ให้บอทส่ง QR เก็บเงินปิดการขายได้เอง",
      href: "/dashboard/settings",
      done: !!payment.data?.promptpay_id,
    },
    {
      title: "ทดลองคุยกับบอท",
      hint: "เช็คว่าบอทตอบถูกใจ ก่อนปล่อยเจอลูกค้าจริง",
      href: "/dashboard/playground",
      done: (playgroundUse.count ?? 0) > 0,
    },
    {
      title: "เชื่อมช่องทางแรก",
      hint: "Facebook / IG / LINE — บอทเริ่มตอบลูกค้าจริงทันที",
      href: "/dashboard/channels",
      done: (channels.count ?? 0) > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-emerald-900">เริ่มต้นให้บอทขายได้จริง</h2>
          <p className="mt-0.5 text-xs text-emerald-700">ทำครบ 5 ข้อ บอทก็พร้อมปิดการขายแทนคุณ</p>
        </div>
        <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">{doneCount}/{steps.length}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <div className="mt-4 space-y-1.5">
        {steps.map((s) => (
          <Link key={s.href} href={s.href}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
              s.done ? "opacity-60" : "bg-white/70 hover:bg-white",
            )}>
            {s.done
              ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              : <Circle className="h-5 w-5 shrink-0 text-neutral-300" />}
            <span className="flex-1">
              <span className={cn("block text-sm font-medium", s.done ? "text-neutral-400 line-through" : "text-neutral-800")}>{s.title}</span>
              {!s.done && <span className="block text-[11px] text-neutral-400">{s.hint}</span>}
            </span>
            {!s.done && <ArrowRight className="h-4 w-4 text-neutral-300 group-hover:text-emerald-500" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
