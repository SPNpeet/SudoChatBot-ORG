"use client";
// ลูกค้าอัปสลิปเอง — ระบบตรวจสลิปจริง/ยอดตรง แล้วตัดยอดให้ร้านทันที
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function PublicSlipUpload({ docKey, autoVerify }: { docKey: string; autoVerify: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFile(f: File) {
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("key", docKey);
      fd.append("file", f);
      const res = await fetch("/api/public/doc/slip", { method: "POST", body: fd });
      const j = await res.json();
      setMsg({ ok: !!j.ok, text: j.message ?? j.error ?? "เกิดข้อผิดพลาด" });
      if (j.ok && j.paid) router.refresh();
    } catch {
      setMsg({ ok: false, text: "ส่งสลิปไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setBusy(false);
    }
  }

  if (!autoVerify) {
    return <p className="text-xs text-neutral-400">โอนแล้วแจ้งสลิปกับทางร้านได้เลย</p>;
  }

  return (
    <div>
      <p className="text-sm font-semibold">② โอนแล้วอัปโหลดสลิปตรงนี้</p>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <button onClick={() => fileRef.current?.click()} disabled={busy}
        className="mt-2 w-full rounded-xl bg-neutral-900 py-3 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
        {busy ? "กำลังตรวจสลิป..." : "อัปโหลดสลิป"}
      </button>
      <p className="mt-1.5 text-[11px] text-neutral-400">ระบบตรวจสลิปอัตโนมัติ — ผ่านแล้วสถานะเปลี่ยนเป็นชำระแล้วทันที</p>
      {msg && (
        <p className={`mt-2 rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
