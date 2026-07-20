"use client";
import { useRef, useState, useTransition } from "react";
import { sendManualReply } from "../actions";

export default function ReplyForm({ shopId, conversationId }: { shopId: string; conversationId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(fd: FormData) {
    const text = String(fd.get("text") ?? "");
    if (!text.trim()) return;
    setError(null);
    start(async () => {
      const r = await sendManualReply(shopId, conversationId, text);
      if (!r.ok) { setError(r.error); return; }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="border-t border-neutral-100">
      <form action={submit} className="flex gap-2 p-3">
        <input
          ref={inputRef} name="text" autoComplete="off" placeholder="พิมพ์ตอบลูกค้าในนามร้าน..."
          className="h-10 flex-1 rounded-xl border border-neutral-300 px-3 text-base outline-none focus:border-emerald-500 sm:text-sm"
        />
        <button disabled={pending} className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
          {pending ? "กำลังส่ง..." : "ส่ง"}
        </button>
      </form>
      {error && <p className="px-3 pb-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
