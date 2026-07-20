import { getCurrentShop } from "@/lib/shop";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import BotSettingsForm from "./bot-settings-form";
import CommentSettingsForm from "./comment-settings-form";
import PaymentSettingsForm from "./payment-settings-form";
import TaxInfoForm from "./tax-info-form";
import TeamForm from "./team-form";
import type { BotSettings, ShopPaymentSettings } from "@/lib/types/db";

export const dynamic = "force-dynamic";
// กล่องทดลองตอบคอมเมนต์เรียก AI + tool — กัน Vercel ตัด server action กลางคัน
export const maxDuration = 60;

export default async function SettingsPage() {
  const { supabase, shop, role } = await getCurrentShop();
  const canEdit = role === "owner" || role === "admin";
  const [{ data: bot }, { data: pay }, { data: members }, { data: taxInfo }, { data: commentLog }] = await Promise.all([
    supabase.from("bot_settings").select("*").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("shop_payment_settings").select("*").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("shop_members").select("id, role, profiles(display_name, email)").eq("shop_id", shop.id),
    supabase.from("shops").select("billing_name,billing_address,tax_id").eq("id", shop.id).maybeSingle(),
    supabase.from("comment_replies").select("comment_id,comment_text,dm_text,status,dm_sent,error,created_at")
      .eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const b = (bot ?? {}) as Partial<BotSettings>;
  const p = (pay ?? {}) as Partial<ShopPaymentSettings>;
  const memberRows = (members ?? []).map((m) => {
    const prof = m.profiles as unknown as { display_name: string | null; email: string | null } | null;
    return { id: m.id, role: m.role, display_name: prof?.display_name ?? null, email: prof?.email ?? null };
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">ตั้งค่า</h1>
        <p className="text-sm text-neutral-400">บุคลิกบอท การรับเงิน และทีมของร้าน {shop.name}</p>
      </div>

      {!canEdit && (
        <p className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">
          เฉพาะเจ้าของ/ผู้ดูแลร้านตั้งค่าได้ — ติดต่อเจ้าของร้านหากต้องการเปลี่ยนการตั้งค่า
        </p>
      )}

      {canEdit && (
        <>
          <Card>
            <CardHeader><CardTitle>🤖 พนักงานขาย AI</CardTitle></CardHeader>
            <CardContent><BotSettingsForm shopId={shop.id} b={b} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>💬 บอทตอบคอมเมนต์ → ทัก inbox</CardTitle></CardHeader>
            <CardContent>
              <CommentSettingsForm
                shopId={shop.id}
                enabled={b.comment_reply_enabled ?? false}
                publicReply={b.comment_public_reply ?? "ตอบใน DM แล้วนะคะ ❤️"}
                keywords={b.comment_keywords ?? []}
              />
              {(commentLog ?? []).length > 0 && (
                <div className="mt-4 border-t border-neutral-100 pt-4">
                  <p className="mb-2 text-xs font-medium text-neutral-500">คอมเมนต์ล่าสุดที่บอทจัดการ</p>
                  <div className="space-y-1.5">
                    {(commentLog ?? []).map((c) => (
                      <div key={c.comment_id} className="rounded-lg bg-neutral-50 px-3 py-2 text-xs">
                        <p className="text-neutral-600">💬 {c.comment_text?.slice(0, 120) ?? "-"}</p>
                        <p className="mt-0.5 text-neutral-400">
                          {c.status === "replied" ? `✓ ทัก inbox แล้ว: ${c.dm_text?.slice(0, 100) ?? ""}`
                            : c.status === "skipped" ? `ข้าม (${c.error ?? "-"})`
                            : c.status === "failed" ? `⚠️ ไม่สำเร็จ: ${c.error ?? "-"}`
                            : "กำลังประมวลผล..."}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>💸 การรับเงินและค่าจัดส่ง</CardTitle></CardHeader>
            <CardContent><PaymentSettingsForm shopId={shop.id} p={p} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>🧾 ข้อมูลใบกำกับภาษี</CardTitle></CardHeader>
            <CardContent><TaxInfoForm shopId={shop.id} taxInfo={taxInfo} /></CardContent>
          </Card>
        </>
      )}

      {/* ===== ทีม — สมาชิกดูรายชื่อได้ทุก role ===== */}
      <Card>
        <CardHeader><CardTitle>👥 ทีมของร้าน</CardTitle></CardHeader>
        <CardContent>
          <TeamForm shopId={shop.id} members={memberRows} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
