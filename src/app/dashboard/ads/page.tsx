import { getCurrentShop } from "@/lib/shop";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, Th, Td } from "@/components/ui";
import { baht, dateTH } from "@/lib/utils";
import { Megaphone, ShieldCheck, Wallet, AlertTriangle } from "lucide-react";
import AdsChat from "./chat";
import { CapsForm, PauseButton, RefreshButton } from "./ads-controls";

export const dynamic = "force-dynamic";
// server action ของ agent วนลูป tool กับ Meta API สูงสุด 8 รอบ — กัน Vercel ตัดกลางคัน
export const maxDuration = 90;

const ADS_ERROR_TH: Record<string, string> = {
  missing_shop: "ไม่พบร้าน", forbidden: "เฉพาะเจ้าของ/ผู้ดูแลร้านเชื่อมบัญชีโฆษณาได้",
  META_APP_ID_not_set: "แพลตฟอร์มยังไม่ได้ตั้งค่า Meta App", no_code: "การเชื่อมต่อถูกยกเลิก",
  bad_state: "ข้อมูลเชื่อมต่อไม่ถูกต้อง ลองใหม่", csrf: "หมดเวลาเชื่อมต่อ ลองใหม่อีกครั้ง",
  token_exchange: "แลก token กับ Meta ไม่สำเร็จ ลองใหม่", list_ad_accounts: "ดึงรายชื่อบัญชีโฆษณาไม่สำเร็จ",
  no_ad_accounts: "บัญชี Facebook นี้ยังไม่มีบัญชีโฆษณา — สร้างที่ business.facebook.com ก่อน",
};

export default async function AdsPage({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string; warn?: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const canManage = role === "owner" || role === "admin";
  const sp = await searchParams;

  const [{ data: account }, { data: campaigns }] = await Promise.all([
    supabase.from("ad_accounts").select("*").eq("shop_id", shop.id).eq("status", "active")
      .order("connected_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("ad_campaigns").select("*").eq("shop_id", shop.id)
      .order("created_at", { ascending: false }).limit(30),
  ]);
  const camps = campaigns ?? [];
  const activeTotal = camps.filter((c) => c.status === "ACTIVE").reduce((s, c) => s + Number(c.daily_budget ?? 0), 0);
  const spendToday = camps.reduce((s, c) => s + Number(c.spend_today ?? 0), 0);

  if (!canManage) {
    return (
      <div className="max-w-xl">
        <h1 className="text-xl font-bold">ยิงแอด AI</h1>
        <p className="mt-3 rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">
          เฉพาะเจ้าของ/ผู้ดูแลร้านใช้ผู้ช่วยยิงแอดได้
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">ยิงแอด AI</h1>
        <p className="text-sm text-neutral-400">คุยกับผู้ช่วย ให้มันเสนอ/ปรับ/หยุดโฆษณา Facebook ให้ — ค่าแอดจ่ายตรงกับ Meta ผ่านบัญชีโฆษณาของร้านเอง</p>
      </div>

      {sp.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{ADS_ERROR_TH[sp.error] ?? sp.error}</p>}
      {sp.connected && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">✓ เชื่อมบัญชีโฆษณาแล้ว {sp.connected} บัญชี</p>}
      {sp.warn === "no_funding" && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ⚠️ บัญชีโฆษณายังไม่ผูกวิธีชำระเงินกับ Meta — แอดจะไม่รัน เข้า Meta Ads Manager &gt; Billing เพิ่มบัตรก่อน
        </p>
      )}

      {!account ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Megaphone className="mx-auto h-10 w-10 text-neutral-300" />
            <h2 className="mt-3 text-base font-bold">เชื่อมบัญชีโฆษณา Meta ของร้าน</h2>
            <div className="mx-auto mt-3 max-w-md space-y-1.5 text-left text-sm text-neutral-500">
              <p className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> ค่าแอดจ่ายตรงกับ Meta ผ่านบัตรของร้าน — ไม่ผ่านแพลตฟอร์มนี้เลย</p>
              <p className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> AI เสนอได้อย่างเดียว ทุกการใช้เงินต้องกดยืนยันเอง + มีเพดานงบที่คุณตั้ง</p>
              <p className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> สั่ง &ldquo;พอ/หยุด&rdquo; เมื่อไหร่ แอดหยุดทันที + ระบบเฝ้างบให้ทุก 30 นาที</p>
            </div>
            <a href={`/api/ads/meta/start?shop_id=${shop.id}`}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700">
              <Megaphone className="h-4 w-4" /> เชื่อมต่อบัญชีโฆษณา Meta
            </a>
            <p className="mt-3 text-[11px] text-neutral-400">ต้องมีบัญชีโฆษณาใน business.facebook.com และผูกบัตรกับ Meta แล้ว</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ===== สรุป + เพดาน ===== */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card><CardContent className="pt-5">
              <p className="flex items-center gap-1.5 text-xs text-neutral-400"><Wallet className="h-3.5 w-3.5" /> ใช้ไปวันนี้ (ทุกแคมเปญ)</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{baht(spendToday)}</p>
              <p className="text-[11px] text-neutral-400">เพดานรวม {baht(Number(account.daily_cap_total))}/วัน — เกินแล้วระบบหยุดแอดอัตโนมัติ</p>
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <p className="flex items-center gap-1.5 text-xs text-neutral-400"><Megaphone className="h-3.5 w-3.5" /> งบรวมแคมเปญที่รันอยู่</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{baht(activeTotal)}<span className="text-sm font-normal text-neutral-400">/วัน</span></p>
              <p className="text-[11px] text-neutral-400">{account.account_name} · {String(account.ad_account_id).replace("act_", "")}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-5">
              <p className="mb-1 flex items-center gap-1.5 text-xs text-neutral-400"><ShieldCheck className="h-3.5 w-3.5" /> เพดานงบ (คุณคุมเอง ไม่ใช่ AI)</p>
              <CapsForm shopId={shop.id} perCampaign={Number(account.daily_cap_per_campaign)} total={Number(account.daily_cap_total)} />
            </CardContent></Card>
          </div>

          {!account.page_id && (
            <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" /> ยังไม่ได้เชื่อมเพจ Facebook — แอดแบบทักแชทต้องมีเพจ ไปเชื่อมที่หน้า &ldquo;ช่องทาง&rdquo; ก่อน
            </p>
          )}

          {/* ===== ตารางแคมเปญ ===== */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>แคมเปญ ({camps.length})</CardTitle>
              <RefreshButton shopId={shop.id} />
            </CardHeader>
            <CardContent className="px-0 pb-0 pt-0">
              {camps.length === 0 ? (
                <p className="px-5 pb-8 pt-4 text-center text-sm text-neutral-400">ยังไม่มีแคมเปญ — เริ่มจากพิมพ์สั่งผู้ช่วยด้านล่างได้เลย</p>
              ) : (
                <Table>
                  <thead><tr><Th>แคมเปญ</Th><Th>สถานะ</Th><Th>งบ/วัน</Th><Th>ใช้วันนี้</Th><Th>อัปเดต</Th><Th /></tr></thead>
                  <tbody>
                    {camps.map((c) => (
                      <tr key={c.campaign_id}>
                        <Td className="font-medium">{c.name}</Td>
                        <Td><Badge tone={c.status === "ACTIVE" ? "green" : c.status === "PAUSED" ? "neutral" : "amber"}>
                          {c.status === "ACTIVE" ? "กำลังรัน" : c.status === "PAUSED" ? "หยุดอยู่" : c.status ?? "-"}
                        </Badge></Td>
                        <Td>{c.daily_budget != null ? baht(Number(c.daily_budget)) : "-"}</Td>
                        <Td className={Number(c.spend_today) > 0 ? "font-semibold" : "text-neutral-400"}>{baht(Number(c.spend_today ?? 0))}</Td>
                        <Td className="text-neutral-400">{dateTH(c.synced_at)}</Td>
                        <Td>{c.status === "ACTIVE" && <PauseButton shopId={shop.id} campaignId={c.campaign_id} />}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* ===== แชทผู้ช่วย ===== */}
          <Card className="flex h-[32rem] flex-col overflow-hidden">
            <CardHeader className="border-b border-neutral-100"><CardTitle>💬 ผู้ช่วยแอด AI</CardTitle></CardHeader>
            <div className="min-h-0 flex-1"><AdsChat shopId={shop.id} /></div>
          </Card>
        </>
      )}
    </div>
  );
}
