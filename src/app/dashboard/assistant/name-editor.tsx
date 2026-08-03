"use client";
// ============================================================
//  ตั้งชื่อผู้ช่วย AI — คำขอเจ้าของ 4 ส.ค. 2569:
//  "อยากให้น้องมันมีชื่อระบุได้ตามชื่อที่ลูกค้าตั้ง เหมือนเป็นเพื่อนหรือเลขาที่มีชื่อ"
//
//  เก็บใน shops.settings (ผ่าน saveAssistantName) ไม่ใช่ localStorage
//  เพราะทั้งทีมต้องเห็นชื่อเดียวกัน และ AI ต้องรู้จักชื่อตัวเองใน system prompt
// ============================================================
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine, Check, X } from "lucide-react";
import { saveAssistantName } from "../actions";
import { useToast } from "@/components/toast";

export default function AssistantNameEditor({ shopId, current }: { shopId: string; current: string | null }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(current ?? "");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function save() {
    start(async () => {
      const r = await saveAssistantName(shopId, val);
      if (!r.ok) { toast({ text: r.error, tone: "error" }); return; }
      toast({ text: r.name ? `ตั้งชื่อ "${r.name}" ให้ผู้ช่วยแล้ว` : "กลับไปใช้ชื่อมาตรฐานแล้ว", tone: "success" });
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => { setVal(current ?? ""); setEditing(true); }}
        aria-label="ตั้งชื่อผู้ช่วย AI"
        className="inline-flex min-h-11 shrink-0 items-center gap-1 px-1.5 text-xs text-neutral-400 transition-colors hover:text-emerald-700">
        <PenLine className="h-3.5 w-3.5" /> ตั้งชื่อ
      </button>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <input value={val} onChange={(e) => setVal(e.target.value)} maxLength={30} autoFocus
        placeholder="เช่น น้องบัญชี, มะลิ"
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        className="h-11 w-40 rounded-xl border border-neutral-300 px-2.5 text-sm outline-none focus:border-emerald-500" />
      <button type="button" disabled={pending} onClick={save} aria-label="บันทึกชื่อ"
        className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50">
        <Check className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => setEditing(false)} aria-label="ยกเลิก"
        className="grid h-11 w-11 place-items-center rounded-xl text-neutral-400 hover:text-neutral-600">
        <X className="h-4 w-4" />
      </button>
    </span>
  );
}
