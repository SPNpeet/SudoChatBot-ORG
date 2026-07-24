"use client";
// ตั้งค่าแจ้งเตือน LINE ของกิจการ — ใช้ LINE Messaging API (LINE Notify ปิดบริการแล้ว)
import { useState, useTransition } from "react";
import { Button, Input, Label } from "@/components/ui";
import { saveNotifySettings, testLineNotify } from "../actions";

interface Props {
  shopId: string;
  hasToken: boolean;          // มี token เก็บไว้แล้วไหม (ไม่ส่งค่าจริงลง client)
  toId: string | null;
  notifyApproval: boolean;
}

export default function NotifySettingsForm({ shopId, hasToken, toId, notifyApproval }: Props) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function submit(fd: FormData) {
    setResult(null);
    start(async () => {
      const r = await saveNotifySettings(shopId, fd);
      setResult(r.ok ? { ok: true, msg: "บันทึกแล้ว" } : { ok: false, msg: r.error });
    });
  }

  function test() {
    setResult(null);
    start(async () => {
      const r = await testLineNotify(shopId);
      setResult(r.ok ? { ok: true, msg: "✅ ส่งข้อความทดสอบแล้ว — เช็คใน LINE ได้เลย" } : { ok: false, msg: r.error });
    });
  }

  return (
    <form action={submit} className="space-y-3">
      <div>
        <Label>Channel access token (จาก LINE Developers Console)</Label>
        <Input name="line_channel_token" type="password" autoComplete="off"
          placeholder={hasToken ? "•••••••• ตั้งค่าไว้แล้ว — เว้นว่าง = ใช้ค่าเดิม" : "วาง token ของ LINE Official Account"} />
      </div>
      <div>
        <Label>ส่งเข้า (User ID หรือ Group ID)</Label>
        <Input name="line_to_id" defaultValue={toId ?? ""} placeholder="เช่น U1234... หรือ C1234... (กลุ่ม)" />
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-600">
        <input type="checkbox" name="notify_approval" defaultChecked={notifyApproval} className="h-4 w-4 accent-emerald-600" />
        แจ้งเตือนเมื่อมีค่าใช้จ่ายรออนุมัติ
      </label>
      <p className="text-[11px] leading-relaxed text-neutral-400">
        วิธีตั้ง: สร้าง LINE Official Account ฟรีที่ developers.line.biz → เปิด Messaging API → คัดลอก Channel access token
        แล้วเพิ่มบอทเป็นเพื่อน/ดึงเข้ากลุ่มที่ต้องการรับแจ้งเตือน (LINE Notify แบบเดิมปิดบริการแล้ว)
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={test}>ส่งข้อความทดสอบ</Button>
      </div>
      {result && <p className={`text-xs ${result.ok ? "text-emerald-600" : "text-red-600"}`}>{result.msg}</p>}
    </form>
  );
}
