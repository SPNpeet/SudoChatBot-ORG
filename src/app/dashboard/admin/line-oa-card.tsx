"use client";
// ตั้งค่า LINE OA กลางของแพลตฟอร์ม — ตั้งครั้งเดียว ทุกกิจการได้ปุ่ม "เชื่อมต่อ LINE" คลิกเดียวทันที
import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from "@/components/ui";
import { MessageCircle, CheckCircle2 } from "lucide-react";
import { savePlatformLine } from "./actions";

export default function LineOaCard({ configured, basicId }: { configured: boolean; basicId: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(fd: FormData) {
    setMsg(null);
    start(async () => {
      const r = await savePlatformLine(fd);
      setMsg(r.ok ? { ok: true, text: "บันทึกแล้ว — ทุกกิจการเห็นปุ่มเชื่อมต่อ LINE ทันที" } : { ok: false, text: r.error });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[#06C755]" /> บัญชี LINE กลางของแพลตฟอร์ม
          {configured && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700"><CheckCircle2 className="h-3 w-3" /> ตั้งค่าแล้ว</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs leading-relaxed text-neutral-500">
          ตั้งครั้งเดียว → ลูกค้าทุกกิจการกดปุ่มเดียวเชื่อม LINE ได้เลย ไม่ต้องสร้าง OA เอง<br />
          วิธีเอาค่า: developers.line.biz → สร้าง <b>Provider</b> 1 อัน → ในนั้นสร้าง 2 channel:
          <b> Messaging API</b> (ได้ Channel access token + @basic id) และ <b>LINE Login</b> (ได้ Channel ID + Secret) —
          ต้องอยู่ Provider เดียวกันเท่านั้น ระบบถึงจะส่งข้อความหาคนที่ล็อกอินได้ ·
          ตั้ง Callback URL ของ LINE Login เป็น <code className="rounded bg-neutral-100 px-1">https://sudochatbot.online/api/line/callback</code> ·
          และผูก OA เข้ากับ LINE Login channel (Linked OA) เพื่อให้ชวนเพิ่มเพื่อนอัตโนมัติ
        </p>
        <form action={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>LINE Login — Channel ID</Label>
              <Input name="login_channel_id" placeholder={configured ? "ตั้งค่าไว้แล้ว — เว้นว่าง = ใช้ค่าเดิม" : "เช่น 2001234567"} />
            </div>
            <div>
              <Label>LINE Login — Channel secret</Label>
              <Input name="login_channel_secret" type="password" autoComplete="off" placeholder={configured ? "••••••••" : "วาง secret"} />
            </div>
          </div>
          <div>
            <Label>Messaging API — Channel access token (long-lived)</Label>
            <Input name="oa_token" type="password" autoComplete="off" placeholder={configured ? "••••••••" : "วาง token ของ OA กลาง"} />
          </div>
          <div>
            <Label>Basic ID ของ OA (ไว้โชว์ให้ผู้ใช้เพิ่มเพื่อน)</Label>
            <Input name="oa_basic_id" defaultValue={basicId ?? ""} placeholder="@sudochatbot" />
          </div>
          <Button disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
        </form>
        {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
      </CardContent>
    </Card>
  );
}
