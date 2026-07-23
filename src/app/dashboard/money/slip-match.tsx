"use client";
// อัปสลิป -> ระบบตรวจ (EasySlip/SlipOK) + หาใบแจ้งหนี้ที่ยอดตรง -> ยืนยันบันทึกรับเงิน
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Check } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui";
import { baht } from "@/lib/utils";
import { uploadAndMatchSlip, recordPayment, type SlipMatchResult } from "../finance/actions";

export default function SlipMatch({ shopId }: { shopId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Extract<SlipMatchResult, { ok: true }> | null>(null);
  const [chosenDoc, setChosenDoc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFile(f: File) {
    setError(null); setResult(null); setDone(null); setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await uploadAndMatchSlip(shopId, fd);
      if (!r.ok) { setError(r.error); return; }
      setResult(r);
      setChosenDoc(r.matched?.docId ?? "");
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!result) return;
    const docId = chosenDoc || null;
    const cand = result.candidates.find((c) => c.docId === docId);
    const amount = result.amount ?? cand?.outstanding;
    if (!amount) { setError("ไม่ทราบยอดเงิน — สลิปตรวจไม่ผ่าน ให้บันทึกจากหน้าเอกสารแทน"); return; }
    start(async () => {
      const r = await recordPayment(shopId, {
        doc_id: docId, direction: "in", method: "promptpay",
        amount, slip_path: result.slipPath,
      });
      if (r.ok) {
        setDone(docId ? `บันทึกรับเงิน ${baht(amount)} เข้า ${cand?.docNumber ?? ""} แล้ว` : `บันทึกเงินเข้า ${baht(amount)} แล้ว (ยังไม่ผูกเอกสาร)`);
        setResult(null);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>📥 อัปสลิป — ตรวจ + จับคู่ใบแจ้งหนี้อัตโนมัติ</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        <Button variant="outline" className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
          <ScanLine className="h-4 w-4" /> {busy ? "กำลังตรวจสลิป..." : "เลือกรูปสลิปโอนเงิน"}
        </Button>
        <p className="text-xs text-neutral-400">
          ระบบตรวจว่าเป็นสลิปจริง กันสลิปซ้ำ อ่านยอดเงิน แล้วหาใบแจ้งหนี้ค้างรับที่ยอดตรงให้เอง (ตั้งค่า EasySlip ที่หน้า ตั้งค่า)
        </p>

        {result && (
          <div className="space-y-2 rounded-xl bg-neutral-50 p-3 text-sm">
            {result.verify?.verified ? (
              <p className="text-emerald-700">✓ สลิปจริง ยอด <b>{baht(result.amount ?? 0)}</b>{result.verify.senderName ? ` จาก ${result.verify.senderName}` : ""}</p>
            ) : (
              <p className="text-amber-600">ตรวจอัตโนมัติไม่ได้ ({result.verify?.error ?? "ไม่ได้ตั้ง provider"}) — เลือกเอกสารเองได้</p>
            )}
            {result.matched && <p className="text-emerald-700">จับคู่เจอพอดี: <b>{result.matched.docNumber}</b> {result.matched.contact ?? ""} ค้างรับ {baht(result.matched.outstanding)}</p>}
            <Select value={chosenDoc} onChange={(e) => setChosenDoc(e.target.value)}>
              <option value="">— ไม่ผูกเอกสาร (เงินเข้าอื่น ๆ) —</option>
              {result.candidates.map((c) => (
                <option key={c.docId} value={c.docId}>{c.docNumber} · {c.contact ?? "ไม่ระบุ"} · ค้าง {baht(c.outstanding)}</option>
              ))}
            </Select>
            <Button className="w-full" disabled={pending} onClick={confirm}>
              {pending ? "กำลังบันทึก..." : "ยืนยันบันทึกรับเงิน"}
            </Button>
          </div>
        )}
        {done && <p className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><Check className="h-4 w-4" /> {done}</p>}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
