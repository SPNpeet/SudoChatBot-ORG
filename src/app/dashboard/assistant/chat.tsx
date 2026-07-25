"use client";
import { compressImage } from "@/lib/compress-image";
// แชทผู้ช่วยบัญชี AI — สั่งงานบัญชีทั้งระบบ + แนบรูปบิลให้บันทึกเองได้จากแชท
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Calculator, Sparkles, Paperclip, X } from "lucide-react";
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

interface Msg extends AssistantTurn {
  toolCalls?: { name: string; label: string }[];
  artifacts?: { label: string; href: string }[];
  choices?: { label: string; reply: string }[];   // ปุ่มตอบ AI — กดแล้วส่งคำตอบให้เลย ไม่ต้องพิมพ์
}

export default function AssistantChat({ shopId }: { shopId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);   // แนบค้างไว้หลายใบได้ พิมพ์สั่งกำกับก่อนส่ง
  const [readProgress, setReadProgress] = useState("");
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
        setMsgs([...next, { role: "assistant", content: r.text, toolCalls: r.toolCalls, artifacts: r.artifacts, choices: r.choices }]);
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

  /** อ่านบิลที่แนบไว้ทุกใบ (ทีละใบเพื่อไม่ให้ AI สับสน) + คำสั่งที่ผู้ใช้พิมพ์กำกับ */
  async function sendWithFiles(files: File[], note: string) {
    if (busy || reading) return;
    setError(null);
    setReading(true); // spinner หมุนตั้งแต่เริ่มบีบอัด — กันกดซ้ำ/คิดว่าเว็บค้าง
    try {
      const parts: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setReadProgress(files.length > 1 ? `กำลังอ่านบิลใบที่ ${i + 1}/${files.length}...` : "");
        const f = await compressImage(files[i]);
        const fd = new FormData();
        fd.append("shop_id", shopId);
        fd.append("file", f);
        const res = await fetch("/api/finance/extract", { method: "POST", body: fd });
        const j = await res.json();
        if (!j.ok) { setError(j.error ?? `อ่านไฟล์ ${f.name} ไม่สำเร็จ`); return; }
        parts.push(`[ไฟล์แนบ${files.length > 1 ? ` ${i + 1}/${files.length}` : ""}: ${f.name}${j.file_path ? ` · file_path: ${j.file_path}` : ""}]
ข้อมูลที่ระบบอ่านได้: ${JSON.stringify(j.data)}`);
      }
      setPendingFiles([]);
      setInput("");
      const order = note.trim()
        ? `คำสั่งจากเจ้าของ (ยึดตามนี้ก่อนข้อมูลที่ OCR อ่านได้เสมอ): ${note.trim()}`
        : files.length > 1
          ? "ช่วยตรวจและบันทึกให้ทีละใบ ถ้าใบไหนไม่ชัดหรือไม่รู้ว่าเป็นค่าใช้จ่ายแบบไหน ให้ถามก่อน อย่าเดา"
          : "ช่วยตรวจและบันทึกเข้าระบบให้หน่อย ถ้าตัวเลขไม่ชัดหรือไม่รู้ว่าเอกสารนี้คืออะไร ให้ถามก่อน อย่าเดา";
      await send([...parts, order].join("\n\n"));
    } catch {
      setError("อ่านไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setReading(false);
      setReadProgress("");
    }
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (pendingFiles.length) sendWithFiles(pendingFiles, input);
    else send(input);
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
              <Sparkles className="h-3 w-3 shrink-0" /> แนบรูปบิลได้ทีละหลายใบ พิมพ์สั่งกำกับได้เลย เช่น &ldquo;ค่าเช่า ยังไม่จ่าย&rdquo; · ตัวเลขไม่ชัดระบบจะถามก่อนบันทึกเสมอ
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
              {/* ปุ่มตอบ AI — โชว์เฉพาะข้อความล่าสุด กันกดย้อนอดีตแล้วสับสน */}
              {m.choices && m.choices.length > 0 && i === msgs.length - 1 && !busy && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {m.choices.map((c, j) => (
                    <button key={j} type="button" onClick={() => send(c.reply)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-left text-[13px] font-medium text-emerald-800 transition hover:bg-emerald-50 active:scale-[0.99]">
                      <span className="min-w-0">{c.label}</span>
                      <span className="shrink-0 text-emerald-400">›</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {reading && <p className="text-xs text-neutral-400">{readProgress || "กำลังอ่านไฟล์ด้วย AI..."}</p>}
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
        {pendingFiles.length > 0 && (
          <div className="mb-2 space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-emerald-800">แนบไว้ {pendingFiles.length} ใบ — พิมพ์สั่งกำกับได้ เช่น &ldquo;ทั้งหมดยังไม่จ่าย&rdquo;</p>
              <button type="button" onClick={() => setPendingFiles([])} className="shrink-0 text-[11px] text-emerald-700 underline">เอาออกทั้งหมด</button>
            </div>
            {pendingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1 truncate text-xs text-emerald-800">{f.name}</span>
                <button type="button" aria-label="เอาไฟล์นี้ออก"
                  onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="shrink-0 rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}
        <form className="flex gap-2" onSubmit={submitForm}>
          <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden"
            onChange={(e) => { const fs = [...(e.target.files ?? [])]; if (fs.length) { setPendingFiles((prev) => [...prev, ...fs].slice(0, 8)); setError(null); } e.target.value = ""; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || reading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-300 text-neutral-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40"
            title="แนบรูปบิล/เอกสาร เลือกได้หลายใบพร้อมกัน">
            <Paperclip className="h-4 w-4" />
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={pendingFiles.length ? "สั่งกำกับบิล (ไม่พิมพ์ก็ได้) เช่น ค่าเช่า ยังไม่จ่าย" : "สั่งงานบัญชี เช่น ออกใบแจ้งหนี้ 5,000 ให้คุณสมชาย..."}
            className="h-10 flex-1 rounded-xl border border-neutral-300 px-3 text-base outline-none focus:border-emerald-500 sm:text-sm" />
          <button disabled={busy || reading || (!input.trim() && !pendingFiles.length)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-40">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
