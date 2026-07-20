"use client";
// เพดานงบ + ปุ่ม pause/refresh แคมเปญ (นอกแชท)
import { useState, useTransition } from "react";
import { RefreshCw, Pause } from "lucide-react";
import { saveAdCaps, pauseAdCampaign, refreshCampaigns } from "./actions";

export function CapsForm({ shopId, perCampaign, total }: { shopId: string; perCampaign: number; total: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cap1, setCap1] = useState(String(perCampaign));
  const [cap2, setCap2] = useState(String(total));

  function submit() {
    setMsg(null);
    start(async () => {
      const r = await saveAdCaps(shopId, Number(cap1), Number(cap2));
      setMsg(r.ok ? { ok: true, text: "บันทึกเพดานแล้ว" } : { ok: false, text: r.error });
      if (r.ok) setTimeout(() => setMsg(null), 3000);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2 text-sm">
      <div>
        <p className="mb-1 text-[11px] text-neutral-400">เพดาน/แคมเปญ (บาท/วัน)</p>
        <input value={cap1} onChange={(e) => setCap1(e.target.value)} inputMode="numeric"
          className="h-8 w-24 rounded-lg border border-neutral-300 px-2 text-sm outline-none focus:border-emerald-500" />
      </div>
      <div>
        <p className="mb-1 text-[11px] text-neutral-400">เพดานรวมทั้งบัญชี (บาท/วัน)</p>
        <input value={cap2} onChange={(e) => setCap2(e.target.value)} inputMode="numeric"
          className="h-8 w-24 rounded-lg border border-neutral-300 px-2 text-sm outline-none focus:border-emerald-500" />
      </div>
      <button onClick={submit} disabled={pending}
        className="h-8 rounded-lg bg-neutral-900 px-3 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
        {pending ? "..." : "บันทึก"}
      </button>
      {msg && <span className={msg.ok ? "text-xs text-emerald-600" : "text-xs text-red-600"}>{msg.text}</span>}
    </div>
  );
}

export function PauseButton({ shopId, campaignId }: { shopId: string; campaignId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button disabled={pending}
        onClick={() => { setErr(null); start(async () => { const r = await pauseAdCampaign(shopId, campaignId); if (!r.ok) setErr(r.error); }); }}
        className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
        <Pause className="h-3 w-3" /> {pending ? "..." : "หยุด"}
      </button>
      {err && <p className="mt-1 max-w-40 text-[10px] text-red-600">{err}</p>}
    </div>
  );
}

export function RefreshButton({ shopId }: { shopId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <button disabled={pending}
        onClick={() => { setErr(null); start(async () => { const r = await refreshCampaigns(shopId); if (!r.ok) setErr(r.error); }); }}
        className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
        <RefreshCw className={pending ? "h-3 w-3 animate-spin" : "h-3 w-3"} /> รีเฟรช
      </button>
      {err && <span className="text-[10px] text-red-600">{err}</span>}
    </div>
  );
}
