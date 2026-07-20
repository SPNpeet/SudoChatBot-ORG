"use client";
// แถวยืนยัน/ปฏิเสธการเติมเงิน — เดิมเป็น form เปล่าไม่มี feedback ถ้า error จะเงียบ
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { baht, dateTH } from "@/lib/utils";
import { confirmTopup } from "./actions";

export default function TopupRow({ id, shopName, amount, status, createdAt, slipUrl }: {
  id: string; shopName: string; amount: number; status: string; createdAt: string; slipUrl: string | null;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function act(approve: boolean) {
    setErr(null);
    start(async () => {
      const r = await confirmTopup(id, approve);
      if (!r.ok) setErr(r.error);
    });
  }

  return (
    <div className="rounded-xl border border-neutral-100 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{shopName} · {baht(amount)}</p>
          <p className="text-[11px] text-neutral-400">{dateTH(createdAt)} · <Badge tone={status === "verifying" ? "amber" : "neutral"}>{status === "verifying" ? "อัปโหลดสลิปแล้ว" : "รอชำระ"}</Badge>
            {slipUrl && <> · <a href={slipUrl} target="_blank" rel="noreferrer" className="text-sky-600">ดูสลิป</a></>}</p>
        </div>
        <div className="flex gap-1.5">
          <button disabled={pending} onClick={() => act(true)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            {pending ? "กำลังทำรายการ..." : "ยืนยัน + เครดิต"}
          </button>
          <button disabled={pending} onClick={() => act(false)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
            ปฏิเสธ
          </button>
        </div>
      </div>
      {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}
