import { getCurrentShop } from "@/lib/shop";
import { Badge, Card, EmptyState } from "@/components/ui";
import { cn, timeAgo, dateTH } from "@/lib/utils";
import Link from "next/link";
import { toggleConversationMode, sendManualReply } from "../actions";
import ChatLive from "./chat-live";
import type { Conversation, Message } from "@/lib/types/db";
import { Bot, User } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { supabase, shop } = await getCurrentShop();
  const { c: selectedId } = await searchParams;

  const { data: conversations } = await supabase
    .from("conversations")
    .select("*, customers(display_name, avatar_url, platform_user_id), channels(platform, page_name)")
    .eq("shop_id", shop.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const convs = (conversations ?? []) as Conversation[];
  const selected = convs.find((x) => x.id === selectedId) ?? convs[0];

  let messages: Message[] = [];
  if (selected) {
    const { data } = await supabase.from("messages")
      .select("*").eq("conversation_id", selected.id)
      .order("created_at", { ascending: true }).limit(200);
    messages = (data ?? []) as Message[];
  }

  const platformIcon: Record<string, string> = { facebook: "FB", instagram: "IG", line: "LINE", tiktok: "TT" };

  async function reply(formData: FormData) {
    "use server";
    const text = String(formData.get("text") ?? "");
    const convId = String(formData.get("conversation_id") ?? "");
    const shopId = String(formData.get("shop_id") ?? "");
    if (text && convId) await sendManualReply(shopId, convId, text);
  }

  async function setMode(formData: FormData) {
    "use server";
    await toggleConversationMode(
      String(formData.get("conversation_id")),
      String(formData.get("shop_id")),
      formData.get("mode") === "human" ? "human" : "bot",
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] gap-4">
      {/* รายการสนทนา */}
      <Card className="w-80 shrink-0 overflow-y-auto">
        <div className="border-b border-neutral-100 px-4 py-3">
          <h1 className="text-sm font-bold">แชททั้งหมด</h1>
        </div>
        {convs.length === 0 && <EmptyState title="ยังไม่มีบทสนทนา" hint="เมื่อลูกค้าทักเพจ แชทจะแสดงที่นี่" />}
        {convs.map((cv) => (
          <Link
            key={cv.id}
            href={`/dashboard/chats?c=${cv.id}`}
            className={cn(
              "flex items-center gap-3 border-b border-neutral-50 px-4 py-3 hover:bg-neutral-50",
              selected?.id === cv.id && "bg-emerald-50/50",
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-500">
              {platformIcon[cv.channels?.platform ?? ""] ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{cv.customers?.display_name ?? "ลูกค้า"}</p>
              <p className="text-[11px] text-neutral-400">{timeAgo(cv.last_message_at)}</p>
            </div>
            <Badge tone={cv.status === "bot" ? "green" : cv.status === "human" ? "amber" : "neutral"}>
              {cv.status === "bot" ? "บอท" : cv.status === "human" ? "คน" : "ปิด"}
            </Badge>
          </Link>
        ))}
      </Card>

      {/* หน้าต่างแชท */}
      <Card className="flex flex-1 flex-col overflow-hidden">
        {!selected ? (
          <EmptyState title="เลือกบทสนทนาจากด้านซ้าย" />
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
              <div>
                <p className="text-sm font-semibold">{selected.customers?.display_name ?? "ลูกค้า"}</p>
                <p className="text-[11px] text-neutral-400">
                  {selected.channels?.page_name} · {selected.channels?.platform}
                </p>
              </div>
              <form action={setMode}>
                <input type="hidden" name="conversation_id" value={selected.id} />
                <input type="hidden" name="shop_id" value={shop.id} />
                <input type="hidden" name="mode" value={selected.status === "bot" ? "human" : "bot"} />
                <button className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium",
                  selected.status === "bot"
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100",
                )}>
                  {selected.status === "bot" ? (<><Bot className="h-3.5 w-3.5" /> บอทกำลังตอบ — คลิกเพื่อรับช่วง</>) : (<><User className="h-3.5 w-3.5" /> คุณกำลังตอบเอง — คลิกให้บอทตอบต่อ</>)}
                </button>
              </form>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[70%] rounded-2xl px-3.5 py-2 text-sm",
                    m.direction === "outbound"
                      ? m.sender_type === "bot" ? "bg-emerald-600 text-white" : "bg-neutral-800 text-white"
                      : "bg-neutral-100 text-neutral-800",
                  )}>
                    {m.content_type === "image" && m.content?.startsWith("http")
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img src={m.content} alt="รูปภาพ" className="max-h-56 rounded-lg" />
                      : <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                    <p className={cn("mt-1 text-[10px]", m.direction === "outbound" ? "text-white/60" : "text-neutral-400")}>
                      {m.sender_type === "bot" ? "🤖 " : m.sender_type === "agent" ? "👤 " : ""}{dateTH(m.created_at)}
                      {m.status === "failed" && " · ⚠️ ส่งไม่สำเร็จ"}
                    </p>
                  </div>
                </div>
              ))}
              <ChatLive conversationId={selected.id} />
            </div>

            <form action={reply} className="flex gap-2 border-t border-neutral-100 p-3">
              <input type="hidden" name="conversation_id" value={selected.id} />
              <input type="hidden" name="shop_id" value={shop.id} />
              <input
                name="text" autoComplete="off" placeholder="พิมพ์ตอบลูกค้าในนามร้าน..."
                className="h-10 flex-1 rounded-xl border border-neutral-300 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <button className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-700">ส่ง</button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
