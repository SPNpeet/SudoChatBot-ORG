"use client";
// ============================================================
//  AI Sandbox หน้าแรก — ผู้เยี่ยมชมพิมพ์คุยกับผู้ช่วยบัญชี AI ได้จริง ฟรี 3 ครั้ง ไม่ต้องสมัคร
//  จำกัดความยาว 150 ตัวอักษร (กันยัดหลายคำสั่งในพรอมต์เดียว) + ตัวนับโควตาที่เหลือ
//  ไม่มี tool/ข้อมูลจริงใดๆ ฝั่งเซิร์ฟเวอร์ — ปลอดภัยเต็มที่ ดู /api/public/guest-assistant
// ============================================================
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Sparkles, Loader2, ArrowRight } from "lucide-react";

const MAX_LEN = 150;
const STARTERS = ["ระบบนี้ทำอะไรได้บ้าง", "ช่วยเรื่องภาษียังไง", "เหมาะกับสำนักงานบัญชีไหม"];

interface Msg { role: "user" | "ai"; text: string }

export default function LandingSandboxChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [triesLeft, setTriesLeft] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function send(raw: string) {
    const text = raw.trim().slice(0, MAX_LEN);
    if (!text || busy || locked) return;
    setError(null);
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/public/guest-assistant", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }),
      });
      const j = await res.json();
      if (j.ok) {
        setMsgs((m) => [...m, { role: "ai", text: j.text }]);
        const left = typeof j.triesLeft === "number" ? j.triesLeft : null;
        setTriesLeft(left);
        if (left !== null && left <= 0) setLocked(true);
      } else {
        if (j.quotaExceeded) setLocked(true);
        setError(j.error ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
      }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-sm rounded-3xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 border-b border-neutral-200 pb-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><Sparkles className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">ลองคุยกับผู้ช่วยบัญชี AI ได้เลย</p>
          <p className="text-[10px] text-neutral-400">ไม่ต้องสมัคร · ฟรี 3 ครั้ง{triesLeft != null && !locked ? ` · เหลือ ${triesLeft} ครั้ง` : ""}</p>
        </div>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-1.5 pb-1">
            {STARTERS.map((s) => (
              <button key={s} onClick={() => send(s)}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] text-neutral-600 hover:border-emerald-300 hover:text-emerald-700">
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <p className={
              m.role === "user"
                ? "max-w-[80%] rounded-2xl rounded-br-md bg-emerald-600 px-3 py-2 text-[12px] leading-relaxed text-white"
                : "max-w-[85%] rounded-2xl rounded-bl-md border border-neutral-200 bg-white px-3 py-2 text-[12px] leading-relaxed text-neutral-700"
            }>{m.text}</p>
          </div>
        ))}
        {busy && <p className="text-[11px] text-neutral-400"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> กำลังตอบ...</p>}
        <div ref={bottomRef} />
      </div>

      {locked ? (
        <Link href="/login" className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
          สมัครใช้ฟรี เพื่อคุยต่อไม่จำกัด <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <input value={input} maxLength={MAX_LEN} onChange={(e) => setInput(e.target.value)}
              placeholder="พิมพ์คำถามสั้นๆ..." disabled={busy}
              className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 pr-11 text-base outline-none focus:border-emerald-500 sm:text-sm" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-300">{input.length}/{MAX_LEN}</span>
          </div>
          <button disabled={busy || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
