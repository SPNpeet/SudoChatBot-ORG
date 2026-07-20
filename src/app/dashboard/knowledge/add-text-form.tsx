"use client";
import { useRef, useState, useTransition } from "react";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { addKnowledgeText } from "../actions";

export default function AddTextForm({ shopId }: { shopId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      const r = await addKnowledgeText(shopId, fd);
      if (!r.ok) { setError(r.error); return; }
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-3">
      <input type="hidden" name="shop_id" value={shopId} />
      <div><Label>หัวข้อ</Label><Input name="title" required placeholder="เช่น เวลาทำการและที่อยู่ร้าน" /></div>
      <div><Label>เนื้อหา</Label><Textarea name="text" required placeholder={"ถาม: ร้านเปิดกี่โมง\nตอบ: ทุกวัน 9:00-20:00 น."} /></div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      <Button size="sm" disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึกเข้าคลังความรู้"}</Button>
    </form>
  );
}
