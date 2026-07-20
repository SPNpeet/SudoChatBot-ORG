import { getCurrentShop } from "@/lib/shop";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { friendlyChannelError } from "@/lib/channel-errors";
import LineConnectForm from "./line-connect-form";
import TikTokConnectForm from "./tiktok-connect-form";
import DisconnectButton from "./disconnect-button";
import type { Channel } from "@/lib/types/db";
import { Facebook, Instagram, MessageCircle, Music2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<{ pages?: string; error?: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const canEdit = role === "owner" || role === "admin";
  const sp = await searchParams;
  const { data } = await supabase.from("channels").select("*").eq("shop_id", shop.id).order("created_at");
  const channels = (data ?? []) as Channel[];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const lineChannels = channels.filter((c) => c.platform === "line" && c.status === "active");
  const tiktokChannels = channels.filter((c) => c.platform === "tiktok" && c.status === "active");

  const icon: Record<string, React.ReactNode> = {
    facebook: <Facebook className="h-4 w-4 text-[#1877F2]" />,
    instagram: <Instagram className="h-4 w-4 text-[#E4405F]" />,
    line: <MessageCircle className="h-4 w-4 text-[#06C755]" />,
    tiktok: <Music2 className="h-4 w-4" />,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">ช่องทางการขาย</h1>
        <p className="text-sm text-neutral-400">เชื่อมเพจ/บัญชีเพื่อให้บอทเริ่มตอบลูกค้า</p>
      </div>

      {sp.error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{friendlyChannelError(sp.error)}</p>}
      {!canEdit && (
        <p className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">
          คุณดูช่องทางที่เชื่อมต่อได้ แต่เชื่อม/ตัดการเชื่อมต่อได้เฉพาะเจ้าของ/ผู้ดูแลร้าน
        </p>
      )}

      {/* ช่องทางที่เชื่อมแล้ว */}
      <Card>
        <CardHeader><CardTitle>เชื่อมต่อแล้ว ({channels.filter((c) => c.status === "active").length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {channels.length === 0 && <p className="py-4 text-center text-sm text-neutral-400">ยังไม่ได้เชื่อมต่อช่องทางใด</p>}
          {channels.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-neutral-100 px-4 py-3">
              <div className="flex items-center gap-3">
                {icon[c.platform]}
                <div>
                  <p className="text-sm font-medium">{c.page_name ?? c.platform_page_id}</p>
                  <p className="text-[11px] text-neutral-400">{c.platform}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={c.status === "active" ? "green" : "neutral"}>{c.status === "active" ? "ใช้งาน" : "ตัดการเชื่อมต่อ"}</Badge>
                {c.status === "active" && canEdit && <DisconnectButton channelId={c.id} shopId={shop.id} />}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {canEdit && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Facebook / Instagram */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Facebook className="h-4 w-4 text-[#1877F2]" /> Facebook Page + Instagram</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-neutral-500">
                  กดปุ่มเดียว — เลือกเพจที่คุณดูแล ระบบเชื่อม Messenger และ Instagram DM ของเพจนั้นให้อัตโนมัติ
                </p>
                <a href={`/api/channels/meta/start?shop_id=${shop.id}`}>
                  <Button className="bg-[#1877F2] hover:bg-[#1666d8]">เชื่อมต่อ Facebook Page</Button>
                </a>
                <p className="text-[11px] text-neutral-400">ต้องเป็นแอดมินของเพจ และแอปต้องผ่าน App Review ของ Meta ก่อนใช้กับเพจทั่วไป (dev mode ทดสอบกับเพจตัวเองได้เลย)</p>
              </CardContent>
            </Card>

            {/* LINE */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-[#06C755]" /> LINE Official Account</CardTitle></CardHeader>
              <CardContent>
                {/* wizard ทีละขั้น — แม่ค้าส่วนใหญ่ไม่เคยเข้า LINE Developers มาก่อน */}
                <ol className="mb-4 space-y-2.5 text-sm text-neutral-600">
                  <li className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#06C755] text-[11px] font-bold text-white">1</span>
                    <span>มี LINE OA อยู่แล้วใช่ไหม? ถ้ายัง สมัครฟรีที่ <a href="https://manager.line.biz" target="_blank" rel="noreferrer" className="font-medium text-emerald-600 underline">manager.line.biz</a></span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#06C755] text-[11px] font-bold text-white">2</span>
                    <span>เข้า <a href="https://developers.line.biz/console/" target="_blank" rel="noreferrer" className="font-medium text-emerald-600 underline">developers.line.biz/console</a> → login ด้วย LINE เดียวกับที่เป็นแอดมิน OA → สร้าง/เลือก Provider → เลือก channel ประเภท <b>Messaging API</b> ของ OA คุณ</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#06C755] text-[11px] font-bold text-white">3</span>
                    <span>แท็บ <b>Basic settings</b>: คัดลอก <b>Channel ID</b> และ <b>Channel secret</b> มาวางด้านล่าง</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#06C755] text-[11px] font-bold text-white">4</span>
                    <span>แท็บ <b>Messaging API</b> (ล่างสุด): กด <b>Issue</b> ที่ Channel access token (long-lived) แล้วคัดลอกมาวาง</span>
                  </li>
                </ol>
                <LineConnectForm shopId={shop.id} />
                {lineChannels.length > 0 && (
                  <div className="mt-4 rounded-xl bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-800">นำ Webhook URL นี้ไปวางใน LINE Developers → Messaging API:</p>
                    {lineChannels.map((c) => (
                      <code key={c.id} className="mt-1 block break-all text-[11px] text-emerald-700">
                        {supabaseUrl}/functions/v1/webhook-line?channel={c.id}
                      </code>
                    ))}
                    <p className="mt-1 text-[11px] text-emerald-700">แล้วเปิด &quot;Use webhook&quot; + ปิด Auto-reply ของ LINE</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* TikTok */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Music2 className="h-4 w-4" /> TikTok Business Messaging</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-neutral-500">
                ต้องได้รับอนุมัติ Business Messaging API จาก TikTok ก่อน (สมัครที่ developers.tiktok.com) — เมื่อได้ Business ID + Access Token แล้วกรอกด้านล่าง
              </p>
              <TikTokConnectForm shopId={shop.id} />
              {tiktokChannels.length > 0 && (
                <div className="mt-4 rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs font-semibold text-emerald-800">นำ Webhook URL นี้ไปวางใน TikTok Developer Portal → Webhooks:</p>
                  {tiktokChannels.map((c) => (
                    <code key={c.id} className="mt-1 block break-all text-[11px] text-emerald-700">
                      {supabaseUrl}/functions/v1/webhook-tiktok?channel={c.id}
                    </code>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
