"use client";
import { useState, useTransition } from "react";
import { markShipped, verifyPaymentManual, refundOrder } from "../actions";

export function VerifyButtons({ paymentId, shopId }: { paymentId: string; shopId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(approve: boolean) {
    setError(null);
    start(async () => {
      const r = await verifyPaymentManual(paymentId, shopId, approve);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        <button disabled={pending} onClick={() => act(true)} className="min-h-[38px] flex-1 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 sm:flex-none">ยืนยันชำระ</button>
        <button disabled={pending} onClick={() => act(false)} className="min-h-[38px] flex-1 whitespace-nowrap rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 sm:flex-none">ปฏิเสธ</button>
      </div>
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

export function ShipForm({ orderId, shopId }: { orderId: string; shopId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState("");

  function submit() {
    setError(null);
    start(async () => {
      const r = await markShipped(orderId, shopId, tracking);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="เลขพัสดุ"
          className="h-[38px] flex-1 rounded-lg border border-neutral-300 px-2.5 text-base outline-none focus:border-emerald-500 sm:w-28 sm:flex-none sm:text-xs" />
        <button onClick={submit} disabled={pending} className="min-h-[38px] shrink-0 whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
          {pending ? "..." : "จัดส่ง"}
        </button>
      </div>
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

export function RefundForm({ orderId, shopId, isRefund }: { orderId: string; shopId: string; isRefund: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function submit() {
    setError(null);
    start(async () => {
      const r = await refundOrder(orderId, shopId, reason);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เหตุผล (ไม่บังคับ)"
          className="h-[38px] flex-1 rounded-lg border border-neutral-300 px-2.5 text-base outline-none focus:border-rose-400 sm:w-28 sm:flex-none sm:text-xs" />
        <button onClick={submit} disabled={pending} className="min-h-[38px] shrink-0 whitespace-nowrap rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
          {pending ? "..." : isRefund ? "คืนเงิน/ยกเลิก" : "ยกเลิก"}
        </button>
      </div>
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
