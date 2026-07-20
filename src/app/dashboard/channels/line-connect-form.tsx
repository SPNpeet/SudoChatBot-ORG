"use client";
import { useRef, useState, useTransition } from "react";
import { Button, Input, Label } from "@/components/ui";
import { connectLine } from "../actions";

export default function LineConnectForm({ shopId }: { shopId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      const r = await connectLine(shopId, fd);
      if (!r.ok) { setError(r.error); return; }
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-3">
      <input type="hidden" name="shop_id" value={shopId} />
      <div><Label>ชื่อ OA</Label><Input name="line_name" placeholder="ร้านของฉัน" /></div>
      <div><Label>Channel ID (ขั้น 3)</Label><Input name="line_channel_id" required placeholder="เลข 10 หลัก เช่น 1657xxxxxx" /></div>
      <div><Label>Channel Secret (ขั้น 3)</Label><Input name="line_channel_secret" required type="password" /></div>
      <div><Label>Channel Access Token (ขั้น 4)</Label><Input name="line_access_token" required type="password" /></div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      <Button size="sm" disabled={pending}>{pending ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อ LINE"}</Button>
      <p className="text-[11px] text-neutral-400">เชื่อมแล้วจะมีขั้นสุดท้าย: นำ Webhook URL ที่ระบบสร้างให้ ไปวางใน LINE Developers (มีบอกด้านล่างหลังกดเชื่อม)</p>
    </form>
  );
}
