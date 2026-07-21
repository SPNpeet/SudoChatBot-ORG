import { getCurrentShop } from "@/lib/shop";
import { Badge, Card, EmptyState } from "@/components/ui";
import { cn, timeAgo, dateTH } from "@/lib/utils";
import Link from "next/link";
import ChatLive from "./chat-live";
import ReplyForm from "./reply-form";
import ModeToggleButton from "./mode-toggle-button";
import type { Conversation, Message } from "@/lib/types/db";

export const dynamic = "force-dynamic";

export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { supabase, shop, role } = await getCurrentShop();
  const canReply = role !== "viewer";
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

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] gap-4 md:h-[calc(100dvh-3.5rem)]">
      {/* รายการสนทนา */}
      <Card className={cn("w-full shrink-0 overflow-y-auto md:w-80", selected ? "hidden md:block" : "block")}>
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
      <Card className={cn("flex-1 flex-col overflow-hidden", selected ? "flex" : "hidden md:flex")}>
        {!selected ? (
          <EmptyState title="เลือกบทสนทนาจากด้านซ้าย" />
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2.5 sm:px-5 sm:py-3">
              <div className="flex min-w-0 items-center gap-1">
                <Link href="/dashboard/chats" aria-label="กลับ" className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl text-neutral-500 hover:bg-neutral-100 md:hidden">&larr;</Link>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{selected.customers?.display_name ?? "ลูกค้า"}</p>
                  <p className="truncate text-[11px] text-neutral-400">
                    {selected.channels?.page_name} · {selected.channels?.platform}
                  </p>
                </div>
              </div>
              {canReply && <div className="shrink-0"><ModeToggleButton shopId={shop.id} conversationId={selected.id} status={selected.status} /></div>}
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
                      ? <img src={m.content} alt="รูปภาพ" className="max-h-56 max-w-full rounded-lg object-contain" />
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

            {canReply && <ReplyForm shopId={shop.id} conversationId={selected.id} />}
          </>
        )}
      </Card>
    </div>
  );
}
