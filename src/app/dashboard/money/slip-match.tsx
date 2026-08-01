"use client";
import { compressImage } from "@/lib/compress-image";
// ============================================================
//  อัปสลิป -> ตรวจ -> จับคู่ใบแจ้งหนี้ -> ยืนยันบันทึกรับเงิน
//
//  ลำดับการอ่านยอด 3 ชั้น (เจตนา):
//  1. EasySlip/SlipOK — ตรวจว่าสลิป "จริง" ด้วย (กันสลิปปลอม) แม่นสุด
//  2. ไม่มี provider / ตรวจไม่ผ่าน -> AI อ่านรูป (ยอด + วันที่โอน) — อ่านได้แต่ยืนยันความจริงไม่ได้
//  3. AI ก็อ่านไม่ได้ -> ช่องกรอกเอง
//
//  ⚠️ ก่อน 1 ส.ค. 2569 ไม่มีชั้น 2-3 เลย: ไม่มี provider = ปุ่มยืนยันตาย
//  ("ไม่ทราบยอดเงิน — สลิปตรวจไม่ผ่าน") เจ้าของเจอกับลูกค้าจริง — ฟีเจอร์ทั้งการ์ดใช้ไม่ได้
//  ยอด/วันที่จาก AI หรือกรอกเอง "แก้ได้เสมอ" เพราะไม่มีใครการันตีความถูกต้องแทนคนกดยืนยัน
// ============================================================
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Check, CheckCircle2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitleIcon, Input, Label, Select } from "@/components/ui";
import { baht } from "@/lib/utils";
import DateField from "@/components/date-field";
import { uploadAndMatchSlip, recordPayment, type SlipMatchResult } from "../finance/actions";

const bkkToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export default function SlipMatch({ shopId }: { shopId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Extract<SlipMatchResult, { ok: true }> | null>(null);
  const [chosenDoc, setChosenDoc] = useState("");
  // ยอด/วันที่เป็น state ที่แก้ได้เสมอ — provider เติมให้ก็แก้ทับได้ AI เติมให้ก็แก้ทับได้
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState(bkkToday());
  const [amountFrom, setAmountFrom] = useState<"provider" | "ai" | "manual">("manual");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFile(fRaw: File) {
    setError(null); setResult(null); setDone(null); setBusy(true); // spinner หมุนตั้งแต่เริ่มบีบอัด
    setAmount(""); setPaidDate(bkkToday()); setAmountFrom("manual");
    try {
      const f = await compressImage(fRaw);
      const fd = new FormData();
      fd.append("file", f);
      const r = await uploadAndMatchSlip(shopId, fd);
      if (!r.ok) { setError(r.error); return; }

      let filled = r;
      if (r.verify?.verified && r.amount != null) {
        setAmount(String(r.amount));
        setAmountFrom("provider");
      } else {
        // ชั้น 2: ไม่มี provider หรือตรวจไม่ผ่าน — ให้ AI อ่านยอด+วันที่จากรูปเดิม
        // ใช้ endpoint อ่านบิลที่มีอยู่แล้ว (รองรับ doc_kind: slip อยู่แล้ว) ไม่สร้างระบบใหม่
        try {
          const fd2 = new FormData();
          fd2.append("file", f);
          fd2.append("shop_id", shopId);
          fd2.append("no_store", "1");   // ไฟล์ถูกเก็บแล้วโดย uploadAndMatchSlip — ห้ามเก็บซ้ำ
          const res = await fetch("/api/finance/extract", { method: "POST", body: fd2 });
          const j = await res.json();
          const d = j?.ok ? (j.data as { total?: number; date?: string }) : null;
          if (d?.total && d.total > 0) {
            setAmount(String(d.total));
            setAmountFrom("ai");
            // จับคู่ใบแจ้งหนี้ด้วยยอดที่ AI อ่านได้ — ฝั่ง server จับให้เฉพาะยอดจาก provider
            const hit = r.candidates.filter((c) => Math.abs(c.outstanding - d.total!) <= 0.01);
            if (hit.length === 1) filled = { ...r, matched: hit[0] };
          }
          // วันที่โอนในสลิปสำคัญเท่ายอด — ลงผิดวันกระทบงวดภาษี (บทเรียนเดียวกับฝั่งแชท AI)
          if (d?.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) setPaidDate(d.date);
        } catch { /* AI ล่มก็ยังกรอกเองได้ — ห้ามทำทั้งการ์ดพัง */ }
      }
      setResult(filled);
      setChosenDoc(filled.matched?.docId ?? "");
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!result) return;
    const docId = chosenDoc || null;
    const cand = result.candidates.find((c) => c.docId === docId);
    const amt = Number(amount);
    if (!(amt > 0)) { setError("ใส่ยอดเงินตามสลิปก่อน — อ่านจากรูปไม่ได้ ให้ดูตัวเลขในสลิปแล้วพิมพ์ลงช่องยอดเงิน"); return; }
    setError(null);
    start(async () => {
      const r = await recordPayment(shopId, {
        doc_id: docId, direction: "in", method: "promptpay",
        amount: amt, paid_at: paidDate || undefined, slip_path: result.slipPath,
      });
      if (r.ok) {
        setDone(docId ? `บันทึกรับเงิน ${baht(amt)} เข้า ${cand?.docNumber ?? ""} แล้ว` : `บันทึกเงินเข้า ${baht(amt)} แล้ว (ยังไม่ผูกเอกสาร)`);
        setResult(null);
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitleIcon icon={ScanLine} desc="ลูกค้าโอนแล้วส่งสลิปมา — อัปโหลดที่นี่ ระบบอ่านยอด ตรวจว่าสลิปจริง แล้วตัดยอดค้างให้">
          อัปสลิป แล้วจับคู่ใบแจ้งหนี้อัตโนมัติ
        </CardTitleIcon>
      </CardHeader>
      <CardContent className="space-y-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        <Button variant="outline" className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
          <ScanLine className="h-4 w-4" /> {busy ? "กำลังอ่านสลิป..." : "เลือกรูปสลิปโอนเงิน"}
        </Button>
        <p className="text-xs text-neutral-400">
          มี EasySlip/SlipOK = ตรวจว่าสลิปจริงด้วย · ไม่มีระบบก็อ่านยอดกับวันที่จากรูปให้ แล้วแก้/กรอกเองได้เสมอ
        </p>

        {result && (
          <div className="space-y-2.5 rounded-xl bg-neutral-50 p-3 text-sm">
            {result.verify?.verified ? (
              <p className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />สลิปจริง ยอด <b>{baht(result.amount ?? 0)}</b>{result.verify.senderName ? ` จาก ${result.verify.senderName}` : ""}
              </p>
            ) : amountFrom === "ai" ? (
              <p className="text-neutral-600">
                อ่านจากรูปได้ยอด <b>{baht(Number(amount) || 0)}</b> — ตรวจกับสลิปจริงอีกครั้งก่อนกดยืนยัน
                <span className="text-neutral-400"> (ยังไม่ได้ยืนยันว่าเป็นสลิปจริง เพราะไม่ได้ตั้ง provider)</span>
              </p>
            ) : (
              <p className="text-amber-600">อ่านยอดจากรูปไม่ได้ — ดูตัวเลขในสลิปแล้วกรอกเองด้านล่างได้เลย</p>
            )}

            {/* ยอด + วันที่โอน แก้ได้ทุกกรณี — คนกดยืนยันคือคนรับผิดชอบตัวเลข ระบบต้องไม่ขวาง */}
            <div className="grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-2">
              <div>
                <Label>ยอดเงินตามสลิป (บาท)</Label>
                <Input inputMode="decimal" value={amount} placeholder="0.00"
                  onChange={(e) => { setAmount(e.target.value); setAmountFrom("manual"); }} />
              </div>
              <DateField label="วันที่โอนตามสลิป" value={paidDate} onChange={setPaidDate} />
            </div>

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
