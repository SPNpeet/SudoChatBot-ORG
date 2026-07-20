"use client";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { uploadKnowledgeFile } from "../actions";

export default function UploadForm({ shopId }: { shopId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      const r = await uploadKnowledgeFile(shopId, fd);
      if (!r.ok) { setError(r.error); return; }
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-3">
      <input type="hidden" name="shop_id" value={shopId} />
      <input
        type="file" name="file" required accept="application/pdf,image/*"
        className="block w-full rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
      />
      <p className="text-[11px] text-neutral-400">เช่น โปรไฟล์บริษัท, นโยบายคืนสินค้า, เมนู/แคตตาล็อก (สูงสุด 20MB) — OCR อ่านไทย/อังกฤษ</p>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      <Button size="sm" disabled={pending}>{pending ? "กำลังอัปโหลด..." : "อัปโหลดและสอนบอท"}</Button>
    </form>
  );
}
