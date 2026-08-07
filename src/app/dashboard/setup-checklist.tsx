// ============================================================
//  Setup checklist — พาธุรกิจใหม่เดินครบ 5 ก้าวจนระบบบัญชีทำงานเต็มตัว
//  แสดงเฉพาะตอนยังทำไม่ครบ ครบแล้วหายไปเอง
// ============================================================
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import type { Shop } from "@/lib/types/db";
import { CheckCircle2, Circle, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function SetupChecklist({ shop }: { shop: Shop }) {
  // ผู้เรียก (dashboard layout) ยืนยันสมาชิกผ่าน getCurrentShop แล้ว
  const svc = createServiceClient();
  const [taxInfo, payment, contacts, docs, aiUse] = await Promise.all([
    svc.from("shops").select("billing_name,tax_id").eq("id", shop.id).maybeSingle(),
    svc.from("shop_payment_settings").select("promptpay_id").eq("shop_id", shop.id).maybeSingle(),
    svc.from("contacts").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    svc.from("fin_docs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    svc.from("ai_usage_logs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).in("purpose", ["assistant", "ocr"]),
  ]);

  const steps = [
    {
      title: "ใส่ข้อมูลกิจการ + เลขผู้เสียภาษี",
      hint: "ขึ้นบนหัวใบแจ้งหนี้/ใบกำกับภาษีทุกใบ",
      href: "/dashboard/settings",
      done: !!taxInfo.data?.billing_name || !!taxInfo.data?.tax_id,
    },
    {
      title: "ตั้งพร้อมเพย์รับเงิน",
      hint: "QR ขึ้นบนเอกสาร ลูกค้าสแกนจ่าย + อัปสลิป ระบบตรวจให้เอง",
      href: "/dashboard/settings",
      done: !!payment.data?.promptpay_id,
    },
    {
      title: "เพิ่มลูกค้า/ผู้ขายรายแรก",
      hint: "ออกเอกสารเต็มรูปได้ทันที เห็นยอดค้างรายคน",
      href: "/dashboard/contacts",
      done: (contacts.count ?? 0) > 0,
    },
    {
      title: "ออกเอกสารใบแรก หรือบันทึกค่าใช้จ่าย",
      hint: "ระบบลงบัญชีเดบิต/เครดิตให้เองทันที",
      href: "/dashboard/sales",
      done: (docs.count ?? 0) > 0,
    },
    {
      title: "ลองสั่งผู้ช่วยบัญชี AI",
      hint: "พิมพ์สั่งเป็นภาษาคน หรือถ่ายรูปบิลให้ลงบัญชีให้",
      href: "/dashboard/assistant",
      done: (aiUse.count ?? 0) > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    // หุบได้ — เจ้าของแจ้ง 4 ส.ค. 2569 ว่าการ์ดนี้กินที่ทั้งจอทั้งที่เหลือข้อเดียว
    // เปิดอัตโนมัติเฉพาะผู้ใช้ใหม่ที่ยังไม่ทำสักข้อ คนที่เดินมาไกลแล้วเห็นแถบสรุป+ตัวเลขพอ
    // ใช้ <details> ไม่ใช่ state ฝั่ง client: หน้านี้เป็น server component ไม่ต้องส่ง JS เพิ่มเลย
    <details open={doneCount === 0} className="group rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-emerald-900">เริ่มต้นให้ระบบบัญชีทำงานเต็มตัว</h2>
          <p className="mt-0.5 text-xs text-emerald-700">ทำครบ 5 ข้อ — เอกสาร บัญชี ภาษี พร้อมใช้จริงทั้งระบบ</p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">{doneCount}/{steps.length}</span>
          {/* สลับไอคอนด้วย display ไม่ใช่หมุน — วัดแล้ว transform ไม่ทำงานกับไอคอนพวกนี้ ดู globals.css */}
          <ChevronDown className="chev-closed h-4 w-4 text-emerald-700" />
          <ChevronUp className="chev-open h-4 w-4 text-emerald-700" />
        </span>
      </summary>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <div className="mt-4 space-y-1.5">
        {steps.map((s) => (
          <Link key={s.title} href={s.href}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
              s.done ? "opacity-60" : "bg-white/70 hover:bg-white",
            )}>
            {s.done
              ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              : <Circle className="h-5 w-5 shrink-0 text-neutral-300" />}
            <span className="flex-1">
              <span className={cn("block text-sm font-medium", s.done ? "text-neutral-400 line-through" : "text-neutral-800")}>{s.title}</span>
              {!s.done && <span className="block text-xs text-neutral-400">{s.hint}</span>}
            </span>
            {!s.done && <ArrowRight className="h-4 w-4 text-neutral-300 group-hover:text-emerald-500" />}
          </Link>
        ))}
      </div>
    </details>
  );
}
