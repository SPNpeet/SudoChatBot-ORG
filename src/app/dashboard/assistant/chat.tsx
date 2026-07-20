"use client";
// แชทผู้จัดการร้าน AI — สั่งงานทุกระบบของร้านจากที่เดียว
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, BrainCircuit, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { assistantReply, type AssistantTurn } from "./actions";

const STARTERS = [
  "วันนี้ขายได้เท่าไหร่ มีอะไรค้างบ้าง",
  "มีแชทไหนรอแอดมินตอบไหม",
  "ออเดอร์ไหนจ่ายแล้วยังไม่ได้ส่งบ้าง",
  "ปรับคำทักทายบอทให้น่ารักกว่านี้หน่อย",
  "สินค้าตัวไหนใกล้หมดสต๊อก",
  "สรุปยอดขาย 7 วันล่าสุดให้หน่อย",
];

interface Msg extends AssistantTurn { toolCalls?: { name: string; label: string }[] }

export default function AssistantChat({ shopId }: { shopId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setError(null);
    const next: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const r = await assistantReply(shopId, next.map(({ role, content }) => ({ role, content })));
      if (r.ok && r.text) {
        setMsgs([...next, { role: "assistant", content: r.text, toolCalls: r.toolCalls }]);
        // ถ้ามีการแก้ไขข้อมูล ให้หน้าอื่นเห็นค่าล่าสุดตอนสลับไป
        if (r.toolCalls?.some((c) => !c.name.startsWith("get_") && !c.name.startsWith("search_") && !c.name.startsWith("list_"))) {
          router.refresh();
        }
      } else {
        setError(r.error ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
        setMsgs(msgs);
        setInput(t);
      }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
      setMsgs(msgs);
      setInput(t);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && (
          <div className="pt-6 text-center">
            <BrainCircuit className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-2 text-sm text-neutral-500">
              สั่งได้ทุกเรื่องของร้าน — ออเดอร์ จัดส่ง สินค้า ตอบลูกค้า ปรับบอท ดูยอดขาย
            </p>
            <p className="mx-auto mt-1 flex max-w-sm items-center justify-center gap-1 text-[11px] text-neutral-400">
              <Sparkles className="h-3 w-3 shrink-0" /> ทุกการแก้ไขบันทึกประวัติไว้ ตรวจย้อนหลังได้เสมอ
            </p>
            <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-1.5">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:border-emerald-300 hover:text-emerald-700">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
              m.role === "user" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-800",
            )}>
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
              {m.toolCalls && m.toolCalls.length > 0 && (
                <p className="mt-1 text-[10px] text-neutral-400">{m.toolCalls.map((t) => t.label).join(" · ")}</p>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-neutral-400">ผู้จัดการร้านกำลังจัดการให้...</p>}
        {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{error}</p>}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-neutral-100 p-3">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="สั่งงานผู้จัดการร้าน เช่น ใส่เลขพัสดุออเดอร์ SD-0012..."
            className="h-10 flex-1 rounded-xl border border-neutral-300 px-3 text-base outline-none focus:border-emerald-500 sm:text-sm" />
          <button disabled={busy || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
