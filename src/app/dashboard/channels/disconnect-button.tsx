"use client";
import { useState, useTransition } from "react";
import { disconnectChannel } from "../actions";

export default function DisconnectButton({ channelId, shopId }: { channelId: string; shopId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle() {
    setError(null);
    start(async () => {
      const r = await disconnectChannel(channelId, shopId);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="text-right">
      <button onClick={handle} disabled={pending} className="text-xs text-neutral-400 hover:text-red-600 disabled:opacity-50">
        {pending ? "กำลังตัด..." : "ตัดการเชื่อมต่อ"}
      </button>
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
