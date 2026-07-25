"use client";
// ประกาศปัญหา/สถานะระบบถึงลูกค้าทุกคน — ยิงเข้า LINE + แจ้งเตือนบนเครื่อง พร้อมขึ้นแบนเนอร์ในแอป
import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Textarea } from "@/components/ui";
import { Megaphone, X } from "lucide-react";
import { broadcastSystemAlert, closeSystemAlert } from "./actions";

export interface AlertRow { id: string; level: string; title: string; body: string | null; created_at: string }

const LEVELS = [
  { v: "info", label: "📢 แจ้งให้ทราบ", hint: "ฟีเจอร์ใหม่ / ข่าวสาร" },
  { v: "warning", label: "⚠️ เตือน", hint: "ระบบช้า / ปิดปรับปรุงตามแผน" },
  { v: "critical", label: "🚨 ขัดข้องหนัก", hint: "ใช้งานไม่ได้ / ข้อมูลมีปัญหา" },
];

export default function SystemAlertCard({ active }: { active: AlertRow[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(fd: FormData) {
    setMsg(null);
    start(async () => {
      const r = await broadcastSystemAlert(fd);
      setMsg(r.ok
        ? { ok: true, text: `ส่งแล้ว — แจ้งเตือนบนเครื่อง ${r.push} เครื่อง · LINE ${r.line} กิจการ` }
        : { ok: false, text: r.error });
    });
  }

  function close(id: string) {
    start(async () => { await closeSystemAlert(id); });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-amber-600" /> ประกาศสถานะระบบถึงลูกค้าทุกคน</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {active.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-neutral-500">ประกาศที่กำลังแสดงอยู่</p>
            {active.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  {a.body && <p className="truncate text-xs text-neutral-500">{a.body}</p>}
                </div>
                <button onClick={() => close(a.id)} disabled={pending}
                  className="shrink-0 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-red-600" title="ปิดประกาศ">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form action={submit} className="space-y-3">
          <div>
            <Label>ระดับความรุนแรง</Label>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {LEVELS.map((l, i) => (
                <label key={l.v} className="flex cursor-pointer items-start gap-2 rounded-xl border border-neutral-200 p-2.5 hover:bg-neutral-50">
                  <input type="radio" name="level" value={l.v} defaultChecked={i === 0} className="mt-0.5 accent-emerald-600" />
                  <span>
                    <span className="block text-xs font-medium">{l.label}</span>
                    <span className="block text-[10px] text-neutral-400">{l.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>หัวข้อ</Label>
            <Input name="title" maxLength={120} placeholder="เช่น ระบบอ่านบิล AI ขัดข้องชั่วคราว" />
          </div>
          <div>
            <Label>รายละเอียด (ไม่บังคับ)</Label>
            <Textarea name="body" rows={3} maxLength={500} placeholder="เช่น กำลังแก้ไข คาดว่าใช้งานได้ปกติภายใน 1 ชม. งานคีย์เอกสารเองยังใช้ได้ตามปกติ" />
          </div>
          <p className="text-[11px] text-neutral-400">
            ส่งแล้วลูกค้าจะเห็นแบนเนอร์ในแอปทันที + ได้รับแจ้งเตือนทาง LINE และบนเครื่อง (เฉพาะคนที่เปิดไว้)
          </p>
          <Button disabled={pending}>{pending ? "กำลังส่ง..." : "ส่งประกาศถึงลูกค้าทุกคน"}</Button>
        </form>
        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
      </CardContent>
    </Card>
  );
}
