"use client";
// แชทผู้ช่วยแอด AI — ข้อเสนอใช้เงินทุกอันเป็นการ์ดให้กดยืนยันเอง
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Megaphone, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { adsAgentReply, executeAdProposal, rejectAdProposal, type AdsTurn } from "./actions";

const STARTERS = [
  "ยิงแอดโพสต์ล่าสุด งบวันละ 100",
  "ดูผลแคมเปญที่รันอยู่หน่อย",
  "แอดตัวไหนไม่คุ้ม ปิดให้หน่อย",
  "แนะนำหน่อยว่าควรเริ่มยังไง",
];

interface Proposal { id: string; summary: string; type: string; state: "pending" | "executing" | "done" | "rejected" | "error"; error?: string }
interface Msg extends AdsTurn { toolCalls?: { name: string; label: string }[]; proposals?: Proposal[] }

export default function AdsChat({ shopId }: { shopId: string }) {
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
      const r = await adsAgentReply(shopId, next.map(({ role, content }) => ({ role, content })));
      if (r.ok && r.text) {
        setMsgs([...next, {
          role: "assistant", content: r.text, toolCalls: r.toolCalls,
          proposals: (r.proposals ?? []).map((p) => ({ ...p, state: "pending" as const })),
        }]);
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

  function setProposalState(msgIdx: number, propId: string, patch: Partial<Proposal>) {
    setMsgs((prev) => prev.map((m, i) => i !== msgIdx ? m : {
      ...m, proposals: m.proposals?.map((p) => p.id === propId ? { ...p, ...patch } : p),
    }));
  }

  async function confirm(msgIdx: number, propId: string) {
    setProposalState(msgIdx, propId, { state: "executing" });
    const r = await executeAdProposal(shopId, propId);
    if (r.ok) {
      setProposalState(msgIdx, propId, { state: "done" });
      router.refresh();
    } else {
      setProposalState(msgIdx, propId, { state: "error", error: r.error });
    }
  }

  async function reject(msgIdx: number, propId: string) {
    setProposalState(msgIdx, propId, { state: "rejected" });
    await rejectAdProposal(shopId, propId);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && (
          <div className="pt-6 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-2 text-sm text-neutral-500">บอกสิ่งที่อยากได้ เช่น &ldquo;ยิงแอดโพสต์ล่าสุด งบวันละ 100&rdquo;</p>
            <p className="mx-auto mt-1 flex max-w-xs items-center justify-center gap-1 text-[11px] text-neutral-400">
              <ShieldCheck className="h-3 w-3 shrink-0" /> ทุกการใช้เงินต้องกดยืนยันเอง — AI แค่เสนอ
            </p>
            <div className="mx-auto mt-4 flex max-w-sm flex-wrap justify-center gap-1.5">
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
            <div className="max-w-[85%] space-y-2">
              <div className={cn(
                "rounded-2xl px-3.5 py-2 text-sm",
                m.role === "user" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-800",
              )}>
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <p className="mt-1 text-[10px] text-neutral-400">{m.toolCalls.map((t) => t.label).join(" · ")}</p>
                )}
              </div>
              {m.proposals?.map((p) => (
                <div key={p.id} className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 px-3.5 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">ข้อเสนอ — ต้องยืนยันก่อนใช้เงิน</p>
                  <p className="mt-1 text-sm text-neutral-800">{p.summary}</p>
                  {p.state === "pending" && (
                    <div className="mt-2.5 flex gap-2">
                      <button onClick={() => confirm(i, p.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">
                        ยืนยัน
                      </button>
                      <button onClick={() => reject(i, p.id)}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:bg-white">
                        ไม่เอา
                      </button>
                    </div>
                  )}
                  {p.state === "executing" && <p className="mt-2 text-xs text-neutral-500">กำลังทำรายการกับ Meta...</p>}
                  {p.state === "done" && <p className="mt-2 text-xs font-medium text-emerald-700">✓ สำเร็จ — ดูในตารางแคมเปญด้านบน (แคมเปญใหม่เริ่มแบบหยุดไว้ เปิดเมื่อพร้อม)</p>}
                  {p.state === "rejected" && <p className="mt-2 text-xs text-neutral-400">ปัดตกแล้ว</p>}
                  {p.state === "error" && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-600">{p.error}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-neutral-400">ผู้ช่วยกำลังคิด...</p>}
        {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{error}</p>}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-neutral-100 p-3">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="พิมพ์สั่งผู้ช่วยแอด..."
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
