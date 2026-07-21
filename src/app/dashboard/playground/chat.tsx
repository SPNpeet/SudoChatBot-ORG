"use client";
import { useEffect, useRef, useState } from "react";
import { playgroundReply, type PlaygroundTurn } from "./actions";
import { Send, RotateCcw, Sparkles, Search, Package, BookOpen, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

const STARTERS = [
  "สวัสดีครับ มีสินค้าอะไรขายบ้าง",
  "อันไหนขายดีสุด ราคาเท่าไหร่",
  "ค่าส่งเท่าไหร่ กี่วันได้ของ",
  "ขอสั่งซื้อ 1 ชิ้นครับ",
];

const TOOL_ICON: Record<string, React.ReactNode> = {
  search_products: <Search className="h-3 w-3" />,
  get_product: <Package className="h-3 w-3" />,
  search_knowledge: <BookOpen className="h-3 w-3" />,
  simulate_order: <Calculator className="h-3 w-3" />,
};

interface Msg extends PlaygroundTurn {
  toolCalls?: { name: string; label: string }[];
}

export default function PlaygroundChat({ shopId, botName }: { shopId: string; botName: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
      const r = await playgroundReply(shopId, next.map(({ role, content }) => ({ role, content })));
      if (r.ok && r.text) {
        setMsgs([...next, { role: "assistant", content: r.text, toolCalls: r.toolCalls }]);
      } else {
        setError(r.error ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
        setMsgs(msgs); // ย้อนกลับ ไม่ทิ้งข้อความที่ตอบไม่สำเร็จไว้
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
    <div className="flex h-[calc(100svh-220px)] min-h-[420px] flex-col rounded-2xl border border-neutral-200 bg-white">
      {/* header */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
            <Sparkles className="h-4 w-4 text-emerald-600" />
          </span>
          <div>
            <p className="text-sm font-semibold">{botName}</p>
            <p className="text-[11px] text-emerald-600">โหมดทดลอง — ไม่หักเครดิต ไม่สร้างออเดอร์จริง</p>
          </div>
        </div>
        {msgs.length > 0 && (
          <button onClick={() => { setMsgs([]); setError(null); }}
            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600">
            <RotateCcw className="h-3.5 w-3.5" /> เริ่มใหม่
          </button>
        )}
      </div>

      {/* messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm text-neutral-500">
              ทักบอทของคุณเหมือนเป็นลูกค้าคนแรก — บอทใช้สินค้าและข้อมูลร้านจริงของคุณตอบ
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={busy}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
            {m.toolCalls && m.toolCalls.length > 0 && (
              <div className="mb-1 flex flex-wrap gap-1.5">
                {m.toolCalls.map((t, j) => (
                  <span key={j} className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
                    {TOOL_ICON[t.name]} {t.label}
                  </span>
                ))}
              </div>
            )}
            <div className={cn(
              "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
              m.role === "user" ? "rounded-br-md bg-emerald-600 text-white" : "rounded-bl-md bg-neutral-100 text-neutral-800",
            )}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-start">
            <div className="rounded-2xl rounded-bl-md bg-neutral-100 px-3.5 py-2.5">
              <span className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">{error}</p>}

      {/* input */}
      <form onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2 border-t border-neutral-100 p-3">
        <input
          value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
          placeholder="พิมพ์เหมือนลูกค้าทักร้าน…" maxLength={500}
          className="h-10 flex-1 rounded-xl border border-neutral-300 px-3.5 text-base outline-none focus:border-emerald-500 disabled:bg-neutral-50 sm:text-sm"
        />
        <button type="submit" disabled={busy || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
