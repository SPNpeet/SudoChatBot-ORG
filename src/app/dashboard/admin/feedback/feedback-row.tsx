"use client";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { dateTH } from "@/lib/utils";
import { markFeedback } from "./actions";

const STATUS_TH: Record<string, string> = { open: "ยังไม่ได้ดู", resolved: "จัดการแล้ว", dismissed: "ข้ามไป" };
const STATUS_TONE: Record<string, "amber" | "green" | "neutral"> = { open: "amber", resolved: "green", dismissed: "neutral" };

export default function FeedbackRow({ id, message, page, shopName, createdAt, status }: {
  id: string; message: string; page: string | null; shopName: string; createdAt: string; status: string;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(status);

  function act(next: "resolved" | "dismissed" | "open") {
    setErr(null);
    start(async () => {
      const r = await markFeedback(id, next);
      if (!r.ok) setErr(r.error);
      else setLocalStatus(next);
    });
  }

  return (
    <div className="rounded-xl border border-neutral-100 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm">{message}</p>
          <p className="mt-1 text-[11px] text-neutral-400">
            {shopName} · {page ?? "-"} · {dateTH(createdAt)} · <Badge tone={STATUS_TONE[localStatus] ?? "neutral"}>{STATUS_TH[localStatus] ?? localStatus}</Badge>
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {localStatus !== "resolved" && (
            <button disabled={pending} onClick={() => act("resolved")}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
              จัดการแล้ว
            </button>
          )}
          {localStatus !== "dismissed" && (
            <button disabled={pending} onClick={() => act("dismissed")}
              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
              ข้าม
            </button>
          )}
        </div>
      </div>
      {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}
