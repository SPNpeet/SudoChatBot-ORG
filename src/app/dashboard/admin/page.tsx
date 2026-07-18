import { requireUser } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { PROVIDERS, TIERS } from "@/lib/ai-catalog";
import SubmitButton from "@/components/submit-button";
import { claimAdmin } from "./actions";
import AdminAiCenter from "./ai-center";
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

  // โหลดสถานะ key + routing
  const svc = createServiceClient();
  const [{ data: keys }, { data: settings }] = await Promise.all([
    svc.from("ai_provider_keys").select("provider,key_last4,test_status,test_message,tested_at,updated_at"),
    svc.from("ai_settings").select("*"),
  ]);

  return (
    <AdminAiCenter
      keys={keys ?? []}
      settings={settings ?? []}
      providers={PROVIDERS}
      tiers={TIERS}
      userEmail={user.email ?? ""}
    />
  );
}
