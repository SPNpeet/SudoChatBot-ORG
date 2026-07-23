"use client";
// ปุ่มจัดการเอกสาร: รับ/จ่ายเงิน · แปลงเอกสาร · พิมพ์ · ลิงก์ลูกค้า · ยกเลิก
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer, Link2, ArrowRightLeft, Banknote, Ban, X, Check } from "lucide-react";
import { Button, Input, Label, Select } from "@/components/ui";
import { baht } from "@/lib/utils";
import { recordPayment, convertDoc, voidDoc, uploadFinFile } from "./actions";
import type { DocStatus, DocType } from "@/lib/types/finance";

export interface DocActionsProps {
  doc: {
    id: string; shopId: string; docType: DocType; docNumber: string;
    status: DocStatus; outstanding: number; shareKey: string | null; whtAmount: number;
  };
}

export default function DocActions({ doc }: DocActionsProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [payOpen, setPayOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState(String(doc.outstanding || ""));
  const [method, setMethod] = useState("transfer");
  const [payDate, setPayDate] = useState(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10));
  const [voidReason, setVoidReason] = useState("");
  const slipRef = useRef<HTMLInputElement>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);

  const isExpense = doc.docType === "expense";
  const active = doc.status !== "void" && doc.status !== "draft";
  const payable = active && (doc.status === "awaiting" || doc.status === "partial") && (doc.docType === "invoice" || isExpense);
  const convertible = active && (doc.docType === "quotation" || (doc.docType === "invoice" && doc.status === "paid"));

  function submitPayment() {
    setError(null);
    start(async () => {
      let slipPath: string | null = null;
      if (slipFile) {
        const fd = new FormData();
        fd.append("file", slipFile);
        const up = await uploadFinFile(doc.shopId, fd);
        if (!up.ok) { setError(up.error); return; }
        slipPath = up.path;
      }
      const r = await recordPayment(doc.shopId, {
        doc_id: doc.id, direction: isExpense ? "out" : "in", method,
        amount: Number(amount), paid_at: payDate, slip_path: slipPath,
      });
      if (r.ok) { setPayOpen(false); router.refresh(); }
      else setError(r.error);
    });
  }

  function submitConvert() {
    setError(null);
    start(async () => {
      const r = await convertDoc(doc.shopId, doc.id);
      if (r.ok) router.push(`/dashboard/sales/${r.docId}`);
      else setError(r.error);
    });
  }

  function submitVoid() {
    start(async () => {
      const r = await voidDoc(doc.shopId, doc.id, voidReason);
      if (r.ok) { setVoidOpen(false); router.refresh(); }
      else setError(r.error);
    });
  }

  async function copyShareLink() {
    if (!doc.shareKey) return;
    await navigator.clipboard.writeText(`${window.location.origin}/doc/${doc.shareKey}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {payable && (
        <Button size="sm" onClick={() => setPayOpen(true)}>
          <Banknote className="h-4 w-4" /> {isExpense ? "บันทึกจ่ายเงิน" : "บันทึกรับเงิน"}
        </Button>
      )}
      {convertible && (
        <Button size="sm" variant="outline" onClick={submitConvert} disabled={pending}>
          <ArrowRightLeft className="h-4 w-4" /> {doc.docType === "quotation" ? "แปลงเป็นใบแจ้งหนี้" : "ออกใบเสร็จ"}
        </Button>
      )}
      {doc.status !== "void" && (
        <a href={`/dashboard/print/${doc.id}`} target="_blank">
          <Button size="sm" variant="outline"><Printer className="h-4 w-4" /> พิมพ์/PDF</Button>
        </a>
      )}
      {!isExpense && doc.shareKey && doc.status !== "void" && doc.status !== "draft" && (
        <Button size="sm" variant="outline" onClick={copyShareLink}>
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4" />} {copied ? "คัดลอกแล้ว" : "ลิงก์ส่งลูกค้า"}
        </Button>
      )}
      {doc.status !== "void" && (
        <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => setVoidOpen(true)}>
          <Ban className="h-4 w-4" /> ยกเลิก
        </Button>
      )}
      {error && !payOpen && !voidOpen && <p className="w-full text-sm text-red-600">{error}</p>}

      {/* modal บันทึกเงิน */}
      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setPayOpen(false)}>
          <div className="w-full rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{isExpense ? "บันทึกจ่ายเงิน" : "บันทึกรับเงิน"} {doc.docNumber}</h2>
              <button onClick={() => setPayOpen(false)} className="rounded-lg p-1 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-neutral-500">ยอดค้าง{isExpense ? "จ่าย" : "รับ"} <span className="font-semibold text-amber-600">{baht(doc.outstanding)}</span>
                {doc.whtAmount > 0 && <span className="ml-1 text-xs text-neutral-400">(หัก ณ ที่จ่าย {baht(doc.whtAmount)} ระบบลงบัญชีให้ตอนชำระครั้งแรก)</span>}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>จำนวนเงิน (บาท)</Label>
                  <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div>
                  <Label>วันที่</Label>
                  <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>ช่องทาง</Label>
                <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="transfer">โอนเงิน</option>
                  <option value="promptpay">พร้อมเพย์</option>
                  <option value="cash">เงินสด</option>
                  <option value="card">บัตร</option>
                  <option value="other">อื่น ๆ</option>
                </Select>
              </div>
              {!isExpense && (
                <div>
                  <Label>แนบสลิป (ระบบตรวจสลิปจริง/สลิปซ้ำให้ ถ้าตั้ง EasySlip ไว้)</Label>
                  <input ref={slipRef} type="file" accept="image/*" className="block w-full text-sm text-neutral-500 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-xs file:text-white"
                    onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)} />
                </div>
              )}
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <Button className="w-full" disabled={pending || !(Number(amount) > 0)} onClick={submitPayment}>
                {pending ? "กำลังบันทึก..." : "ยืนยันบันทึก"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* modal ยกเลิก */}
      {voidOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setVoidOpen(false)}>
          <div className="w-full rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold">ยกเลิก {doc.docNumber}?</h2>
            <p className="mt-1 text-sm text-neutral-500">ระบบจะกลับรายการบัญชี (เดบิต/เครดิต) และคืนสต๊อกให้อัตโนมัติ — เอกสารยังอยู่ให้ตรวจย้อนหลัง</p>
            <Input className="mt-3" placeholder="เหตุผล (ไม่บังคับ)" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
            {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="mt-3 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setVoidOpen(false)}>ไม่ยกเลิก</Button>
              <Button variant="danger" className="flex-1" disabled={pending} onClick={submitVoid}>{pending ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
