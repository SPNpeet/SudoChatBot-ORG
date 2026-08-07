"use client";
// ลูกค้าอัปสลิปเอง — ระบบตรวจสลิปจริง/ยอดตรง แล้วตัดยอดให้ร้านทันที
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/compress-image";

export default function PublicSlipUpload({ docKey, autoVerify }: { docKey: string; autoVerify: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFile(fRaw: File) {
    setBusy(true); setMsg(null);
    try {
      const f = await compressImage(fRaw);
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

  // ⚠️ ห้ามซ่อนช่องอัปโหลดเมื่อร้านไม่ได้เปิดตรวจอัตโนมัติ (แก้ 6 ส.ค. 2569)
  // เดิมคืนข้อความ "แจ้งสลิปกับทางร้านได้เลย" แล้วจบ ซึ่งเป็นทางตัน:
  // หน้านี้ไม่มีเบอร์ ไม่มีไลน์ของร้าน ลูกค้าจึงไม่มีทางแจ้งได้จริง
  // และตราบใดที่แพลตฟอร์มยังไม่ได้ตั้งคีย์ตรวจสลิป = ลูกค้าของทุกร้านส่งสลิปไม่ได้เลย
  // ตอนนี้ส่งได้ทั้งสองโหมด ต่างกันแค่ "ตรวจอัตโนมัติ" กับ "ร้านตรวจเอง"
  // ⚠️ ข้อความต้องบอกตรง ๆ ว่าโหมดไหน ห้ามทำให้เข้าใจว่าจ่ายเสร็จสมบูรณ์แล้ว
  return (
    <div>
      <p className="text-sm font-semibold">
        {autoVerify ? "② โอนแล้วอัปโหลดสลิปตรงนี้" : "② โอนแล้วส่งสลิปให้ร้านตรงนี้"}
      </p>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <button onClick={() => fileRef.current?.click()} disabled={busy}
        className="mt-2 w-full rounded-xl bg-neutral-900 py-3 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
        {busy ? (autoVerify ? "กำลังตรวจสลิป..." : "กำลังส่งสลิป...") : autoVerify ? "อัปโหลดสลิป" : "ส่งสลิปให้ร้าน"}
      </button>
      <p className="mt-1.5 text-xs text-neutral-400">
        {autoVerify
          ? "ระบบตรวจสลิปอัตโนมัติ — ผ่านแล้วสถานะเปลี่ยนเป็นชำระแล้วทันที"
          : "ร้านจะได้รับแจ้งเตือนและตรวจสลิปเอง สถานะจะเปลี่ยนเมื่อร้านยืนยันเรียบร้อย"}
      </p>
      {msg && (
        <p className={`mt-2 rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
