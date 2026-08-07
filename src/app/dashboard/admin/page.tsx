import { requireUser } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { PROVIDERS } from "@/lib/ai-catalog";
import SubmitButton from "@/components/submit-button";
import { claimAdmin } from "./actions";
import AdminAiCenter from "./ai-center";
import AiGuardCard, { type AiGuardStatus } from "./ai-guard-card";
import LineOaCard from "./line-oa-card";
import SystemAlertCard, { type AlertRow } from "./system-alert-card";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase, user } = await requireUser();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");

  // ยังไม่มี platform admin เลย -> ให้คน login คนแรก claim
  if (!isAdmin) {
    const svc = createServiceClient();
    const { count } = await svc.from("platform_admins").select("user_id", { count: "exact", head: true });
    async function doClaim() { "use server"; await claimAdmin(); }
    return (
      <div className="mx-auto max-w-md pt-16">
        <Card>
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-amber-500" />
            <h1 className="mt-3 text-lg font-bold">หน้าผู้ดูแลแพลตฟอร์ม</h1>
            {count === 0 ? (
              <>
                <p className="mt-2 text-sm text-neutral-500">ยังไม่มีผู้ดูแลระบบ — คุณเป็นคนแรก กดรับสิทธิ์เพื่อจัดการ AI ของทั้งแพลตฟอร์ม</p>
                <form action={doClaim} className="mt-5"><SubmitButton className="w-full" pendingText="กำลังรับสิทธิ์...">รับสิทธิ์ผู้ดูแลแพลตฟอร์ม</SubmitButton></form>
              </>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">หน้านี้สำหรับผู้ดูแลแพลตฟอร์มเท่านั้น หากคุณควรมีสิทธิ์ ให้ผู้ดูแลปัจจุบันเพิ่มบัญชีของคุณ</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // โหลดสถานะการ์ดงาน + คีย์สำรอง + เกราะค่า AI
  const svc = createServiceClient();
  const [{ data: keys }, { data: purposeKeys }, { data: guard }, { data: pfLine }] = await Promise.all([
    svc.from("ai_provider_keys").select("provider,key_last4,test_status,test_message,tested_at,updated_at"),
    svc.from("ai_purpose_keys").select("purpose,provider,model,key_last4,updated_at"),
    supabase.rpc("platform_ai_guard_status"),
    svc.from("platform_billing_settings")
      .select("line_login_channel_id,line_login_channel_secret,line_oa_token,line_oa_channel_secret,line_oa_basic_id")
      .eq("id", true).maybeSingle(),
  ]);
  const { data: alerts } = await svc.from("system_alerts")
    .select("id,level,title,body,created_at").eq("active", true).order("created_at", { ascending: false }).limit(5);

  return (
    <div className="max-w-3xl space-y-6">
      <AdminAiCenter
        keys={keys ?? []}
        providers={PROVIDERS}
        userEmail={user.email ?? ""}
        purposeKeys={purposeKeys ?? []}
      />
      {guard && <AiGuardCard status={guard as unknown as AiGuardStatus} />}
      <SystemAlertCard active={(alerts ?? []) as AlertRow[]} />
      {/* ⚠️ ส่งสถานะ "มี/ไม่มี" รายช่อง ไม่ใช่ boolean ตัวเดียว
          เดิม configured = login_channel_id && oa_token เท่านั้น แต่การ์ดมี 4 ค่าความลับ
          ขาด login_channel_secret = ล็อกอิน LINE ไม่ได้ · ขาด oa_channel_secret = ตรวจลายเซ็น webhook ไม่ได้
          ทั้งสองกรณีป้าย "ตั้งค่าแล้ว" ยังขึ้นเขียวอยู่ ทำให้เข้าใจว่าครบทั้งที่ใช้งานจริงไม่ได้ */}
      <LineOaCard
        stored={{
          loginId: !!pfLine?.line_login_channel_id,
          loginSecret: !!pfLine?.line_login_channel_secret,
          oaToken: !!pfLine?.line_oa_token,
          oaSecret: !!pfLine?.line_oa_channel_secret,
        }}
        basicId={pfLine?.line_oa_basic_id ?? null}
      />
    </div>
  );
}
