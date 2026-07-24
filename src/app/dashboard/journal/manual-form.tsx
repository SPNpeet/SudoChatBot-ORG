"use client";
// บันทึกรายวันเอง (JV ปรับปรุง) — บังคับเดบิต = เครดิตก่อนบันทึก
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { bahtDoc } from "@/lib/utils";
import { addManualJournal } from "../finance/actions";
import type { Account } from "@/lib/types/finance";

interface Line { code: string; debit: string; credit: string; memo: string }
const emptyLine = (): Line => ({ code: "", debit: "", credit: "", memo: "" });

export default function ManualJournalForm({ shopId, accounts }: { shopId: string; accounts: Account[] }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const sums = useMemo(() => ({
    dr: lines.reduce((a, l) => a + (Number(l.debit) || 0), 0),
    cr: lines.reduce((a, l) => a + (Number(l.credit) || 0), 0),
  }), [lines]);
  const balanced = Math.abs(sums.dr - sums.cr) < 0.01 && sums.dr > 0;

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function submit() {
    setError(null);
    start(async () => {
      const r = await addManualJournal(shopId, date, memo, lines
        .filter((l) => l.code && ((Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0))
        .map((l) => ({ code: l.code, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, memo: l.memo || undefined })));
      if (r.ok) { setOpen(false); setLines([emptyLine(), emptyLine()]); setMemo(""); router.refresh(); }
      else setError(r.error);
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> บันทึกรายวันเอง</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 pb-10 pt-14 sm:items-center" onClick={() => setOpen(false)}>
          <div className="w-full rounded-2xl bg-white p-5 sm:max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">บันทึกรายวันทั่วไป (JV)</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>วันที่</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <Label>คำอธิบาย</Label>
                  <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="เช่น ปรับปรุงค่าเสื่อม" />
                </div>
              </div>
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_5.5rem_5.5rem_2rem] items-center gap-2">
                    <select value={l.code} onChange={(e) => setLine(i, { code: e.target.value })}
                      className="h-10 rounded-xl border border-neutral-300 bg-white px-2 text-sm outline-none focus:border-emerald-500">
                      <option value="">— เลือกบัญชี —</option>
                      {accounts.map((a) => <option key={a.id} value={a.code}>{a.code} {a.name}</option>)}
                    </select>
                    <Input inputMode="decimal" placeholder="เดบิต" value={l.debit}
                      onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} />
                    <Input inputMode="decimal" placeholder="เครดิต" value={l.credit}
                      onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} />
                    <button type="button" onClick={() => setLines((ls) => ls.length > 2 ? ls.filter((_, j) => j !== i) : ls)}
                      className="text-neutral-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setLines((ls) => [...ls, emptyLine()])}
                  className="inline-flex items-center gap-1 text-sm text-emerald-700"><Plus className="h-4 w-4" /> เพิ่มบรรทัด</button>
                <p className={`text-sm ${balanced ? "text-emerald-600" : "text-red-500"}`}>
                  เดบิต {bahtDoc(sums.dr)} · เครดิต {bahtDoc(sums.cr)} {balanced ? "✓ สมดุล" : "(ต้องเท่ากัน)"}
                </p>
              </div>
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <Button className="w-full" disabled={pending || !balanced} onClick={submit}>
                {pending ? "กำลังบันทึก..." : "บันทึกรายการ"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
