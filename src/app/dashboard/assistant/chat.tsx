"use client";
import { compressImage } from "@/lib/compress-image";
// แชทผู้ช่วยบัญชี AI — สั่งงานบัญชีทั้งระบบ + แนบรูปบิลให้บันทึกเองได้จากแชท
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Calculator, Sparkles, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { assistantReply, type AssistantTurn } from "./actions";

const STARTERS = [
  "เดือนนี้กำไรเท่าไหร่ มีอะไรค้างบ้าง",
  "ใครค้างจ่ายเราบ้าง ทวงใครก่อนดี",
  "ออกใบแจ้งหนี้ค่าบริการ 5,000 บาท ให้บริษัท ตัวอย่าง จำกัด บวก VAT หัก ณ ที่จ่าย 3%",
  "บันทึกค่าไฟเดือนนี้ 2,340 บาท จ่ายแล้ว",
  "สรุปภาษีที่ต้องยื่นเดือนนี้",
  "สินค้าตัวไหนใกล้หมดสต๊อก",
];

interface Msg extends AssistantTurn { toolCalls?: { name: string; label: string }[]; artifacts?: { label: string; href: string }[] }

export default function AssistantChat({ shopId }: { shopId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaWall, setQuotaWall] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy, reading]);

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
        setMsgs([...next, { role: "assistant", content: r.text, toolCalls: r.toolCalls, artifacts: r.artifacts }]);
        // ถ้ามีการแก้ไขข้อมูล ให้หน้าอื่นเห็นค่าล่าสุดตอนสลับไป
        if (r.toolCalls?.some((c) => !c.name.startsWith("get_") && !c.name.startsWith("search_") && !c.name.startsWith("list_"))) {
          router.refresh();
        }
      } else if (r.quotaExceeded) {
        setQuotaWall(r.error ?? "โควตางาน AI เต็มแล้ว");
        setMsgs(msgs);
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

  async function attachFile(fRaw: File) {
    if (busy || reading) return;
    setError(null);
    setReading(true); // spinner หมุนตั้งแต่เริ่มบีบอัด — กันกดซ้ำ/คิดว่าเว็บค้าง
    try {
      const f = await compressImage(fRaw);
      const fd = new FormData();
      fd.append("shop_id", shopId);
      fd.append("file", f);
      const res = await fetch("/api/finance/extract", { method: "POST", body: fd });
      const j = await res.json();
      if (!j.ok) { setError(j.error ?? "อ่านไฟล์ไม่สำเร็จ"); return; }
      const summary = `[ไฟล์แนบ: ${f.name}${j.file_path ? ` · file_path: ${j.file_path}` : ""}]\nข้อมูลที่ AI อ่านได้จากเอกสาร: ${JSON.stringify(j.data)}\nช่วยตรวจและบันทึกเข้าระบบให้หน่อย`;
      await send(summary);
    } catch {
      setError("อ่านไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && (
          <div className="pt-6 text-center">
            <Calculator className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-2 text-sm text-neutral-500">
              สั่งได้ทุกเรื่องบัญชี — ออกเอกสาร บันทึกรายจ่าย รับเงิน ดูยอดค้าง สรุปภาษี
            </p>
            <p className="mx-auto mt-1 flex max-w-sm items-center justify-center gap-1 text-[11px] text-neutral-400">
              <Sparkles className="h-3 w-3 shrink-0" /> แนบรูปบิลได้เลย เดี๋ยวอ่านและลงบัญชีให้ · ทุกรายการตรวจย้อนหลังได้ในสมุดรายวัน
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
              <p className="whitespace-pre-wrap break-words">{m.role === "user" && m.content.startsWith("[ไฟล์แนบ") ? m.content.split("\n")[0] : m.content}</p>
              {m.artifacts && m.artifacts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.artifacts.map((a, j) => (
                    <a key={j} href={a.href} target={a.href.startsWith("/doc/") || a.href.includes("/print/") ? "_blank" : undefined}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                      {a.label} →
                    </a>
                  ))}
                </div>
              )}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <p className="mt-1 text-[10px] text-neutral-400">{m.toolCalls.map((t) => t.label).join(" · ")}</p>
              )}
            </div>
          </div>
        ))}
        {reading && <p className="text-xs text-neutral-400">กำลังอ่านไฟล์ด้วย AI...</p>}
        {busy && <p className="text-xs text-neutral-400">ผู้ช่วยบัญชีกำลังจัดการให้...</p>}
        {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{error}</p>}
        {quotaWall && (
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 text-center">
            <p className="text-2xl">⚡</p>
            <p className="mt-1 text-sm font-semibold text-neutral-800">{quotaWall}</p>
            <p className="mt-1 text-xs text-neutral-400">งานเอกสาร/บัญชีคีย์เองได้ไม่จำกัดตามปกติ — โควตานี้เฉพาะงาน AI</p>
            <a href="/dashboard/billing"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
              อัปเกรด / ต่ออายุแพ็กเกจ →
            </a>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-neutral-100 p-3">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) attachFile(f); e.target.value = ""; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || reading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-300 text-neutral-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40"
            title="แนบรูปบิล/เอกสาร ให้ AI อ่านและบันทึก">
            <Paperclip className="h-4 w-4" />
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="สั่งงานบัญชี เช่น ออกใบแจ้งหนี้ 5,000 ให้คุณสมชาย..."
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
