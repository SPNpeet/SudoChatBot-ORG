"use client";
import { useState, useTransition } from "react";
import TopupRow from "./topup-row";
import { listPendingTopups, type PendingTopup } from "./actions";

export default function PendingTopupsList({ initial, initialHasMore }: { initial: PendingTopup[]; initialHasMore: boolean }) {
  const [rows, setRows] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function loadMore() {
    setErr(null);
    start(async () => {
      const r = await listPendingTopups(rows.length);
      if (!r.ok) { setErr(r.error); return; }
      setRows((prev) => [...prev, ...r.rows]);
      setHasMore(r.hasMore);
    });
  }

  if (rows.length === 0) return <p className="py-4 text-center text-sm text-neutral-400">ไม่มีรายการรอยืนยัน</p>;

  return (
    <div className="space-y-2">
      {rows.map((t) => (
        <TopupRow key={t.id} id={t.id} shopName={t.shopName} amount={t.amount} status={t.status} createdAt={t.createdAt} slipUrl={t.slipUrl} />
      ))}
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
      {hasMore && (
        <button disabled={pending} onClick={loadMore}
          className="w-full rounded-xl border border-neutral-200 py-2 text-xs text-neutral-500 hover:bg-neutral-50 disabled:opacity-50">
          {pending ? "กำลังโหลด..." : "แสดงเพิ่ม"}
        </button>
      )}
    </div>
  );
}
