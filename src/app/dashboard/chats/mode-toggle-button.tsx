"use client";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { toggleConversationMode } from "../actions";
import { Bot, User } from "lucide-react";

export default function ModeToggleButton({ shopId, conversationId, status }: { shopId: string; conversationId: string; status: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isBot = status === "bot";

  function toggle() {
    setError(null);
    start(async () => {
      const r = await toggleConversationMode(conversationId, shopId, isBot ? "human" : "bot");
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div>
      <button onClick={toggle} disabled={pending} className={cn(
        "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium disabled:opacity-50",
        isBot ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-amber-50 text-amber-700 hover:bg-amber-100",
      )}>
        {isBot ? (<><Bot className="h-3.5 w-3.5" /> บอทกำลังตอบ — คลิกเพื่อรับช่วง</>) : (<><User className="h-3.5 w-3.5" /> คุณกำลังตอบเอง — คลิกให้บอทตอบต่อ</>)}
      </button>
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
