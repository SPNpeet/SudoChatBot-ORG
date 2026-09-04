"use client";
import { ThaiDateInline } from "@/components/date-field";
// ============================================================
//  ตรวจนับทรัพย์สิน — ยืนยันว่า "ของอยู่ที่นั่นจริง" ณ วันที่ระบุ (คำขอเจ้าของ 4 ส.ค. 2569)
//
//  ทำไมจำเป็นทางบัญชี: ทะเบียนที่ไม่เคยตรวจนับ = ตัวเลขในงบไม่มีหลักฐานรองรับ
//  ผู้สอบบัญชีขอดูหลักฐานการตรวจนับทุกปี · และช่วยจับของที่หายไปแล้วแต่ยังคิดค่าเสื่อมอยู่
//  ซึ่งทำให้ค่าใช้จ่ายเกินจริงและเสียภาษีผิด
// ============================================================
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Check, X } from "lucide-react";
import { verifyAsset } from "./actions";
import { useToast } from "@/components/toast";
import { dateOnlyTH } from "@/lib/utils";

const bkkToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export default function VerifyAsset({
  shopId, assetId, verifiedOn, verifiedNote,
}: { shopId: string; assetId: string; verifiedOn: string | null; verifiedNote: string | null }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(bkkToday());
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function save() {
    start(async () => {
      const r = await verifyAsset(shopId, assetId, date, note);
      if (!r.ok) { toast({ text: r.error, tone: "error" }); return; }
      toast({ text: r.message ?? "บันทึกแล้ว", tone: "success" });
      setOpen(false); setNote("");
      router.refresh();
    });
  }

  if (open) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <ThaiDateInline value={date} max={bkkToday()} onChange={setDate} ariaLabel="วันที่ตรวจนับ"
          className="h-11 w-[8.5rem] min-w-0 rounded-xl border border-neutral-300 px-2 text-sm outline-none focus:border-emerald-500" />
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
          placeholder="ที่ตั้งจริง / สภาพ (ไม่บังคับ)" aria-label="บันทึกการตรวจนับ"
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setOpen(false); }}
          className="h-11 min-w-0 flex-1 basis-32 rounded-xl border border-neutral-300 px-2.5 text-sm outline-none focus:border-emerald-500" />
        <button type="button" disabled={pending} onClick={save} aria-label="บันทึกการตรวจนับ"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50">
          <Check className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label="ยกเลิก"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-neutral-400 hover:text-neutral-600">
          <X className="h-4 w-4" />
        </button>
      </span>
    );
  }

  return (
    <button type="button" onClick={() => { setDate(bkkToday()); setOpen(true); }}
      title={verifiedNote ?? undefined}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs transition-colors hover:bg-emerald-50 hover:text-emerald-700">
      <ClipboardCheck className={`h-3.5 w-3.5 shrink-0 ${verifiedOn ? "text-emerald-600" : "text-neutral-300"}`} />
      {verifiedOn
        ? <span className="text-neutral-600">ตรวจนับ {dateOnlyTH(verifiedOn)}</span>
        : <span className="text-neutral-400">ยังไม่ตรวจนับ</span>}
    </button>
  );
}
