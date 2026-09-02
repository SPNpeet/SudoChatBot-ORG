"use client";
// รายการความจำ — เพิ่ม/แก้/ปิด/ลบ ในที่เดียว ทุกปุ่มมี catch (ตาข่าย FailureNet เป็นแค่สำรอง)
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus, Trash2, Pencil, Check, X, EyeOff, Eye, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { EmptyState, buttonClass } from "@/components/ui";
import { MEMORY_KIND_TH, MEMORY_MAX_LEN, type BusinessMemory, type MemoryKind } from "@/lib/business-memory";
import { createMemory, deleteMemory, updateMemory } from "./memory-actions";

export default function MemoryList({ shopId, items }: { shopId: string; items: BusinessMemory[] }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<MemoryKind>("fact");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) { toast({ text: okText, tone: "success" }); router.refresh(); }
        else toast({ text: r.error ?? "ไม่สำเร็จ", tone: "error" });
      } catch {
        toast({ text: "เชื่อมต่อไม่สำเร็จ — ลองอีกครั้ง", tone: "error" });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* เพิ่มเอง — ประโยคเดียวต่อรายการ */}
      <form onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; run(() => createMemory(shopId, text, kind), "จำแล้ว"); setText(""); }}
        className="rounded-2xl border border-neutral-200/80 bg-white p-3 shadow-sm sm:p-4">
        <label className="text-xs font-medium text-neutral-500" htmlFor="mem-new">เพิ่มสิ่งที่อยากให้ผู้ช่วยจำ</label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input id="mem-new" value={text} onChange={(e) => setText(e.target.value)} maxLength={MEMORY_MAX_LEN}
            placeholder="เช่น ลูกค้า ร้าน A ให้เครดิต 30 วัน · ค่าเช่าออฟฟิศ 15,000 จ่ายทุกวันที่ 1"
            className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-300 px-3 text-base outline-none focus:border-emerald-500 sm:text-sm" />
          <select value={kind} onChange={(e) => setKind(e.target.value as MemoryKind)} aria-label="ประเภทความจำ"
            className="h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-emerald-500">
            {(Object.keys(MEMORY_KIND_TH) as MemoryKind[]).map((k) => <option key={k} value={k}>{MEMORY_KIND_TH[k]}</option>)}
          </select>
          <button type="submit" disabled={pending || !text.trim()} className={buttonClass("brand", "md", "h-11")}>
            <Plus className="h-4 w-4" /> จำไว้
          </button>
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState icon={Brain} title="ยังไม่มีอะไรให้จำ"
          hint="พิมพ์ในแชทว่า “จำไว้ว่า...” หรือเพิ่มด้านบน — ครั้งต่อไปไม่ต้องบอกซ้ำ" />
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-clip rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
          {items.map((m) => {
            const isEdit = editing === m.id;
            return (
              <li key={m.id} className={cn("flex items-start gap-3 px-4 py-3", !m.active && "bg-neutral-50/70 opacity-70")}>
                <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                  m.source === "ai" ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-500")}
                  title={m.source === "ai" ? "ผู้ช่วยจำเอง" : "คุณเพิ่มเอง"}>
                  {m.source === "ai" ? <Bot className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  {isEdit ? (
                    <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MEMORY_MAX_LEN}
                      onKeyDown={(e) => { if (e.key === "Enter") { run(() => updateMemory(shopId, m.id, { content: draft }), "แก้แล้ว"); setEditing(null); } if (e.key === "Escape") setEditing(null); }}
                      className="h-10 w-full rounded-lg border border-emerald-400 px-2.5 text-sm outline-none" />
                  ) : (
                    <p className={cn("text-sm leading-relaxed text-neutral-800", !m.active && "line-through")}>{m.content}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-neutral-400">
                    {MEMORY_KIND_TH[m.kind]} · {m.source === "ai" ? "ผู้ช่วยจำเอง" : "เพิ่มเอง"}{!m.active && " · ปิดอยู่ (ผู้ช่วยไม่ใช้)"}
                  </p>
                </div>
                {/* ปุ่มทุกตัว 44px — ใช้บนมือถือด้วยนิ้ว */}
                <div className="flex shrink-0 items-center">
                  {isEdit ? (
                    <>
                      <button type="button" aria-label="บันทึก" onClick={() => { run(() => updateMemory(shopId, m.id, { content: draft }), "แก้แล้ว"); setEditing(null); }}
                        className="grid h-11 w-11 place-items-center rounded-lg text-emerald-600 hover:bg-emerald-50"><Check className="h-4 w-4" /></button>
                      <button type="button" aria-label="ยกเลิก" onClick={() => setEditing(null)}
                        className="grid h-11 w-11 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
                    </>
                  ) : (
                    <>
                      <button type="button" aria-label="แก้ไข" onClick={() => { setEditing(m.id); setDraft(m.content); }}
                        className="grid h-11 w-11 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><Pencil className="h-4 w-4" /></button>
                      <button type="button" aria-label={m.active ? "ปิดใช้" : "เปิดใช้"} title={m.active ? "ปิดไว้ก่อน ผู้ช่วยจะไม่ใช้" : "เปิดใช้อีกครั้ง"}
                        onClick={() => run(() => updateMemory(shopId, m.id, { active: !m.active }), m.active ? "ปิดแล้ว" : "เปิดแล้ว")}
                        className="grid h-11 w-11 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                        {m.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button type="button" aria-label="ลบ"
                        onClick={() => { if (window.confirm("ลบความจำนี้ถาวร?")) run(() => deleteMemory(shopId, m.id), "ลบแล้ว"); }}
                        className="grid h-11 w-11 place-items-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
