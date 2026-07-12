"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ChatLive({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`msgs-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, router]);

  return <div ref={bottomRef} />;
}
