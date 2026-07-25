// ============================================================
//  ตั้งค่า — เดิมยัด 4 การ์ดใหญ่ซ้อนกันในหน้าเดียว เลื่อนยาวมากและหาไม่เจอ
//  เปลี่ยนเป็นแท็บผ่าน URL (?s=...) : เห็นทีละเรื่อง ไม่ต้องเลื่อน แชร์ลิงก์ตรงจุดได้
//  ใช้ลิงก์ล้วน ไม่มี JS จึงเร็วและพังไม่ได้
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitleIcon, PageHeader } from "@/components/ui";
import { Building2, Wallet, Bell, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import PaymentSettingsForm from "./payment-settings-form";
import TaxInfoForm from "./tax-info-form";
import TeamForm from "./team-form";
import NotifySettingsForm from "./notify-settings-form";
import PushToggle from "./push-toggle";
import type { ShopPaymentSettings } from "@/lib/types/db";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "business", label: "ข้อมูลกิจการ", icon: Building2, desc: "ชื่อ ที่อยู่ เลขผู้เสียภาษี — ขึ้นบนหัวเอกสารทุกใบ" },
  { id: "payment", label: "การรับเงิน", icon: Wallet, desc: "พร้อมเพย์สำหรับ QR บนใบแจ้งหนี้ + ตรวจสลิปอัตโนมัติ" },
  { id: "notify", label: "การแจ้งเตือน", icon: Bell, desc: "ให้ระบบเตือนคุณทาง LINE และบนเครื่องนี้" },
  { id: "team", label: "ทีมงาน", icon: UsersRound, desc: "เชิญพนักงานหรือสำนักงานบัญชีเข้ามาช่วย" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ line?: string; s?: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const { line: lineStatus, s } = await searchParams;
  const canEdit = role === "owner" || role === "admin";
  // เชื่อม LINE เสร็จแล้วเด้งกลับมา ต้องเปิดแท็บแจ้งเตือนให้เห็นผลทันที
  const tab: TabId = (TABS.some((t) => t.id === s) ? s : lineStatus ? "notify" : "business") as TabId;

  const svc = createServiceClient();
  const [{ data: pay }, { data: members }, { data: taxInfo }, { data: notify }, { data: platform }] = await Promise.all([
    supabase.from("shop_payment_settings").select("*").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("shop_members").select("id, role, profiles(display_name, email)").eq("shop_id", shop.id),
    supabase.from("shops").select("billing_name,billing_address,tax_id").eq("id", shop.id).maybeSingle(),
    // token อยู่หลัง RLS (service เท่านั้น) — ส่งลง client แค่ "มี/ไม่มี" ไม่ส่งค่าจริง
    svc.from("shop_notify_settings").select("line_channel_token,line_to_id,notify_approval,link_source,line_display_name").eq("shop_id", shop.id).maybeSingle(),
    svc.from("platform_billing_settings").select("line_login_channel_id,line_oa_token,line_oa_basic_id").eq("id", true).maybeSingle(),
  ]);
  const p = (pay ?? {}) as Partial<ShopPaymentSettings>;
  const memberRows = (members ?? []).map((m) => {
    const prof = m.profiles as unknown as { display_name: string | null; email: string | null } | null;
    return { id: m.id, role: m.role, display_name: prof?.display_name ?? null, email: prof?.email ?? null };
  });

  // ป้ายเตือนบนแท็บ: ยังไม่ได้ตั้งอะไรที่จำเป็น
  const todo: Record<TabId, boolean> = {
    business: !taxInfo?.tax_id || !taxInfo?.billing_name,
    payment: !p.promptpay_id,
    notify: !notify?.line_to_id,
    team: false,
  };

  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        title="ตั้งค่า"
        lead={<>ตั้งครั้งเดียวใช้ได้ตลอดสำหรับ {shop.name}</>}
      />

      {!canEdit && (
        <p className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">
          เฉพาะเจ้าของ/ผู้ดูแลตั้งค่าได้ — ติดต่อเจ้าของกิจการหากต้องการเปลี่ยนการตั้งค่า
        </p>
      )}

      {/* แท็บ — มือถือเลื่อนแนวนอนได้ ไม่ตัดคำ */}
      <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="หมวดการตั้งค่า">
        <div className="flex w-max gap-2 sm:w-full">
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <Link key={t.id} href={`/dashboard/settings?s=${t.id}`} aria-current={on ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm font-medium transition-colors",
                  on ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                )}>
                <t.icon className="h-4 w-4" />
                {t.label}
                {todo[t.id] && !on && <span aria-label="ยังไม่ได้ตั้งค่า" className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
              </Link>
            );
          })}
        </div>
      </nav>

      <Card>
        <CardHeader className="pt-5">
          <CardTitleIcon icon={active.icon} desc={active.desc}>{active.label}</CardTitleIcon>
        </CardHeader>
        <CardContent className="space-y-4">
          {tab === "business" && (canEdit
            ? <TaxInfoForm shopId={shop.id} taxInfo={taxInfo} />
            : <Locked />)}

          {tab === "payment" && (canEdit
            ? <PaymentSettingsForm shopId={shop.id} p={p} />
            : <Locked />)}

          {tab === "notify" && (canEdit ? (
            <>
              <PushToggle shopId={shop.id} />
              <NotifySettingsForm shopId={shop.id}
                platformReady={!!platform?.line_login_channel_id && !!platform?.line_oa_token}
                oaBasicId={platform?.line_oa_basic_id ?? null}
                hasOwnToken={!!notify?.line_channel_token}
                status={lineStatus}
                linked={notify?.line_to_id ? {
                  source: (notify.link_source === "own" ? "own" : "platform") as "own" | "platform",
                  displayName: notify.line_display_name ?? null,
                  toId: notify.line_to_id,
                  notifyApproval: notify.notify_approval ?? true,
                } : null} />
            </>
          ) : <Locked />)}

          {tab === "team" && (
            <>
              <div className="grid gap-2 text-[12px] leading-relaxed text-neutral-500 sm:grid-cols-3">
                <p className="rounded-lg bg-neutral-50 px-3 py-2"><b className="text-neutral-700">เจ้าของ / ผู้ดูแล</b><br />ทำได้ทุกอย่าง รวมถึงตั้งค่าและอนุมัติ</p>
                <p className="rounded-lg bg-neutral-50 px-3 py-2"><b className="text-neutral-700">พนักงาน</b><br />ออกเอกสาร บันทึกเงิน ใช้ผู้ช่วย AI</p>
                <p className="rounded-lg bg-neutral-50 px-3 py-2"><b className="text-neutral-700">ผู้ชม</b><br />ดูรายงานอย่างเดียว แก้ไขไม่ได้</p>
              </div>
              <TeamForm shopId={shop.id} members={memberRows} canEdit={canEdit} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Locked() {
  return <p className="py-6 text-center text-sm text-neutral-400">คุณไม่มีสิทธิ์แก้ไขส่วนนี้</p>;
}
