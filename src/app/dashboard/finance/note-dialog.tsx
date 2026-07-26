"use client";
// ============================================================
//  ออกใบลดหนี้ (ม.86/10) / ใบเพิ่มหนี้ (ม.86/9) จากใบกำกับภาษีเดิม
//
//  ทำไมต้องมีแยกจากปุ่ม "ยกเลิก":
//  ใบกำกับภาษีที่ส่งให้ลูกค้าและยื่น ภ.พ.30 ไปแล้ว ยกเลิกย้อนหลังไม่ได้ตามกฎหมาย
//  ถ้าลูกค้าคืนของหรือขอลดราคา ต้องออกใบลดหนี้ในเดือนที่เหตุเกิด
//  หน้าจอนี้จึงเป็น "ทางที่ถูก" คู่กับปุ่มยกเลิกที่ใช้ได้เฉพาะงวดที่ยังไม่ปิด
// ============================================================
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, FileMinus, FilePlus } from "lucide-react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { baht } from "@/lib/utils";
import { CREDIT_NOTE_REASONS, DEBIT_NOTE_REASONS, calcDocTotals } from "@/lib/finance";
import { issueCreditDebitNote } from "./actions";
import type { VatMode } from "@/lib/types/finance";

interface Line { name: string; qty: string; unit_price: string }

export default function NoteDialog({ shopId, originId, originNumber, originTotal, vatMode, onClose }: {
  shopId: string;
  originId: string;
  originNumber: string;
  originTotal: number;
  vatMode: VatMode;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"credit_note" | "debit_note">("credit_note");
  const [reason, setReason] = useState<string>(CREDIT_NOTE_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [settle, setSettle] = useState<"ar" | "cash" | "bank">("ar");
  const [lines, setLines] = useState<Line[]>([{ name: "", qty: "1", unit_price: "" }]);
  const [error, setError] = useState<string | null>(null);

  const reasons = kind === "credit_note" ? CREDIT_NOTE_REASONS : DEBIT_NOTE_REASONS;
  const finalReason = reason === "__custom" ? customReason.trim() : reason;

  const items = lines
    .filter((l) => l.name.trim() && Number(l.unit_price) > 0)
    .map((l) => ({ name: l.name.trim(), qty: Number(l.qty) || 1, unit_price: Number(l.unit_price) || 0 }));
  // พรีวิวเท่านั้น — เซิร์ฟเวอร์คำนวณซ้ำด้วยอัตรา VAT ของใบเดิมเสมอ ตัวเลขจริงยึดฝั่งนั้น
  const t = calcDocTotals(items, 0, vatMode, 0);
  const overRefund = kind === "credit_note" && t.total > originTotal + 0.004;

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function submit() {
    setError(null);
    start(async () => {
      const r = await issueCreditDebitNote(shopId, {
        origin_doc_id: originId, kind, reason: finalReason, items, settle,
      });
      if (r.ok) { onClose(); router.push(`/dashboard/sales/${r.docId}`); }
      else setError(r.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 pb-10 pt-10 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">ออกใบลดหนี้ / ใบเพิ่มหนี้</h2>
          <button onClick={onClose} aria-label="ปิด" className="rounded-lg p-1 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
        </div>

        <p className="mb-3 rounded-xl bg-neutral-50 px-3 py-2 text-[12px] leading-relaxed text-neutral-500">
          อ้างอิงใบกำกับภาษี <b className="text-neutral-700">{originNumber}</b> ยอด {baht(originTotal)} ·
          เอกสารนี้จะลงวันที่วันนี้ตามกฎหมาย (ออกในเดือนที่เหตุเกิด) จึงไม่ติดล็อกงวดที่ยื่นภาษีไปแล้ว
        </p>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>ประเภทเอกสาร</Label>
              <Select value={kind} onChange={(e) => {
                const k = e.target.value as "credit_note" | "debit_note";
                setKind(k);
                setReason((k === "credit_note" ? CREDIT_NOTE_REASONS : DEBIT_NOTE_REASONS)[0]);
              }}>
                <option value="credit_note">ใบลดหนี้ — ลดยอด (ม.86/10)</option>
                <option value="debit_note">ใบเพิ่มหนี้ — เพิ่มยอด (ม.86/9)</option>
              </Select>
            </div>
            <div>
              <Label>{kind === "credit_note" ? "คืนยอดให้ลูกค้าทางไหน" : "เก็บเพิ่มทางไหน"}</Label>
              <Select value={settle} onChange={(e) => setSettle(e.target.value as "ar" | "cash" | "bank")}>
                <option value="ar">ตัดกับยอดลูกหนี้ (ปกติ)</option>
                <option value="bank">{kind === "credit_note" ? "โอนคืนเข้าบัญชีลูกค้า" : "รับโอนเข้าบัญชี"}</option>
                <option value="cash">{kind === "credit_note" ? "คืนเป็นเงินสด" : "รับเป็นเงินสด"}</option>
              </Select>
            </div>
          </div>

          <div>
            <Label>เหตุผล (กฎหมายบังคับให้พิมพ์บนเอกสาร)</Label>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value="__custom">อื่น ๆ (พิมพ์เอง)</option>
            </Select>
            {reason === "__custom" && (
              <Textarea className="mt-2 min-h-16" value={customReason} onChange={(e) => setCustomReason(e.target.value)}
                placeholder="อธิบายเหตุผลให้ชัดเจน เช่น รับคืนสินค้า 2 ชิ้นเนื่องจากส่งผิดรุ่น" />
            )}
          </div>

          <div>
            <Label>รายการที่{kind === "credit_note" ? "ลด/คืน" : "เพิ่ม"}</Label>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-6" value={l.name} onChange={(e) => setLine(i, { name: e.target.value })}
                    placeholder="ชื่อรายการ" />
                  <Input className="col-span-2" inputMode="decimal" value={l.qty}
                    onChange={(e) => setLine(i, { qty: e.target.value })} placeholder="จำนวน" />
                  <Input className="col-span-3" inputMode="decimal" value={l.unit_price}
                    onChange={(e) => setLine(i, { unit_price: e.target.value })} placeholder="ราคา/หน่วย" />
                  <button type="button" aria-label="ลบบรรทัด" disabled={lines.length === 1}
                    onClick={() => setLines((p) => p.filter((_, j) => j !== i))}
                    className="col-span-1 rounded-lg text-neutral-400 hover:bg-neutral-100 disabled:opacity-30">
                    <X className="mx-auto h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" size="sm" variant="ghost" className="mt-1"
              onClick={() => setLines((p) => [...p, { name: "", qty: "1", unit_price: "" }])}>
              + เพิ่มบรรทัด
            </Button>
          </div>

          <div className="rounded-xl bg-neutral-50 px-3 py-2 text-sm">
            <div className="flex justify-between"><span className="text-neutral-500">มูลค่าก่อน VAT</span><span className="tabular-nums">{baht(t.exVat)}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">ภาษีมูลค่าเพิ่ม</span><span className="tabular-nums">{baht(t.vat)}</span></div>
            <div className="mt-1 flex justify-between border-t border-neutral-200 pt-1 font-bold">
              <span>ยอด{kind === "credit_note" ? "ที่ลด" : "ที่เพิ่ม"}</span><span className="tabular-nums">{baht(t.total)}</span>
            </div>
          </div>

          {overRefund && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-700">
              ยอดใบลดหนี้เกินยอดใบกำกับภาษีเดิม ({baht(originTotal)}) — ตรวจรายการอีกครั้ง
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button className="w-full" disabled={pending || !items.length || finalReason.trim().length < 5 || overRefund} onClick={submit}>
            {kind === "credit_note" ? <FileMinus className="h-4 w-4" /> : <FilePlus className="h-4 w-4" />}
            {pending ? "กำลังออกเอกสาร..." : `ออก${kind === "credit_note" ? "ใบลดหนี้" : "ใบเพิ่มหนี้"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
