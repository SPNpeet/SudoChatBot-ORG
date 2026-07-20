"use client";
import { useRef, useState, useTransition } from "react";
import { Button, Input, Label } from "@/components/ui";
import { connectTikTok } from "../actions";

export default function TikTokConnectForm({ shopId }: { shopId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      const r = await connectTikTok(shopId, fd);
      if (!r.ok) { setError(r.error); return; }
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={submit} className="space-y-3">
      <input type="hidden" name="shop_id" value={shopId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>ชื่อบัญชี</Label><Input name="tiktok_name" placeholder="@ร้านของฉัน" /></div>
        <div><Label>Business ID</Label><Input name="tiktok_business_id" required placeholder="จาก TikTok for Business" /></div>
        <div><Label>Client Secret (ตรวจลายเซ็น webhook)</Label><Input name="tiktok_client_secret" required type="password" /></div>
        <div><Label>Access Token</Label><Input name="tiktok_access_token" required type="password" /></div>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      <Button size="sm" disabled={pending}>{pending ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อ TikTok"}</Button>
    </form>
  );
}
