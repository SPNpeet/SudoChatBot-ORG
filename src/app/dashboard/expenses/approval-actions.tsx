"use client";
// ปุ่มอนุมัติ/ปฏิเสธค่าใช้จ่ายที่พนักงานส่งมา — เฉพาะ owner/admin
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { approveExpense, rejectExpense } from "../finance/actions";

export default function ApprovalActions({ shopId, docId }: { shopId: string; docId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function approve() {
    setError(null);
    start(async () => {
      const r = await approveExpense(shopId, docId);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  function reject() {
    setError(null);
    start(async () => {
      const r = await rejectExpense(shopId, docId, reason);
      if (r.ok) { setRejecting(false); router.refresh(); }
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-800">⏳ รายการนี้รอการอนุมัติ</p>
      <p className="mt-0.5 text-xs text-amber-700">พนักงานเป็นคนบันทึก — อนุมัติแล้วระบบจะตั้งหนี้ลงสมุดรายวันให้ทันที (ทำจ่ายทีหลังได้)</p>
      {!rejecting ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={approve} disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> {pending ? "กำลังอนุมัติ..." : "อนุมัติเบิกจ่าย"}
          </button>
          <button onClick={() => setRejecting(true)} disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
            <XCircle className="h-4 w-4" /> ปฏิเสธ
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300}
            placeholder="เหตุผลที่ปฏิเสธ (พนักงานจะเห็นข้อความนี้)"
            className="h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-red-400" />
          <div className="flex gap-2">
            <button onClick={reject} disabled={pending}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">
              {pending ? "กำลังบันทึก..." : "ยืนยันปฏิเสธ"}
            </button>
            <button onClick={() => setRejecting(false)} disabled={pending}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
              ยกเลิก
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
