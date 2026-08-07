"use client";
// ตั้งค่า LINE OA กลางของแพลตฟอร์ม — ตั้งครั้งเดียว ทุกกิจการได้ปุ่ม "เชื่อมต่อ LINE" คลิกเดียวทันที
import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, InfoHint, Label } from "@/components/ui";
import { MessageCircle, CheckCircle2, LayoutGrid, AlertTriangle, CircleDashed } from "lucide-react";
import { savePlatformLine } from "./actions";

/** มี/ไม่มีค่ารายช่อง — การ์ดนี้มีความลับ 4 ตัวที่ขาดตัวใดตัวหนึ่งก็ใช้งานไม่ได้คนละแบบ */
export interface LineStored { loginId: boolean; loginSecret: boolean; oaToken: boolean; oaSecret: boolean }

function FieldStatus({ set }: { set: boolean }) {
  return set ? (
    <span className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> ตั้งค่าไว้แล้ว — เว้นว่างไว้ถ้าไม่เปลี่ยน
    </span>
  ) : (
    <span className="mt-1 flex items-center gap-1 text-xs text-neutral-400">
      <CircleDashed className="h-3.5 w-3.5 shrink-0" /> ยังไม่ได้ตั้ง
    </span>
  );
}

export default function LineOaCard({ stored, basicId }: { stored: LineStored; basicId: string | null }) {
  const configured = stored.loginId && stored.loginSecret && stored.oaToken && stored.oaSecret;
  // ครึ่ง ๆ กลาง ๆ อันตรายกว่าไม่ตั้งเลย เพราะปุ่มเชื่อม LINE จะโผล่ให้กดแล้วพังกลางทาง
  const missing = [
    !stored.loginId && "Channel ID",
    !stored.loginSecret && "Login channel secret (ล็อกอิน LINE ไม่ได้)",
    !stored.oaToken && "Channel access token (ส่งข้อความไม่ได้)",
    !stored.oaSecret && "Messaging channel secret (ตรวจลายเซ็น webhook ไม่ได้ — ระบบจะทิ้ง event ทุกตัว)",
  ].filter(Boolean) as string[];
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [menuMsg, setMenuMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [menuBusy, setMenuBusy] = useState(false);

  async function buildRichMenu() {
    setMenuBusy(true); setMenuMsg(null);
    try {
      const res = await fetch("/api/admin/line-richmenu", { method: "POST" });
      const j = await res.json();
      setMenuMsg(j.ok
        ? { ok: true, text: `สร้างเมนูแล้ว ${j.buttons} ปุ่ม — เปิดแชท OA ในมือถือดูได้เลย (อาจต้องปิด-เปิดแชทใหม่)` }
        : { ok: false, text: j.error ?? "สร้างไม่สำเร็จ" });
    } catch (e) {
      setMenuMsg({ ok: false, text: (e as Error).message });
    } finally { setMenuBusy(false); }
  }

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
          {configured && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"><CheckCircle2 className="h-3 w-3" /> ตั้งค่าแล้ว</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 flex items-center gap-1.5 text-xs leading-relaxed text-neutral-500">
          ตั้งครั้งเดียว → ลูกค้าทุกกิจการกดปุ่มเดียวเชื่อม LINE ได้เลย ไม่ต้องสร้าง OA เอง
          <InfoHint>
            วิธีเอาค่า: developers.line.biz → สร้าง Provider 1 อัน → ในนั้นสร้าง 2 channel:
            Messaging API (ได้ Channel access token + @basic id) และ LINE Login (ได้ Channel ID + Secret) —
            ต้องอยู่ Provider เดียวกันเท่านั้น ระบบถึงจะส่งข้อความหาคนที่ล็อกอินได้ ·
            ตั้ง Callback URL ของ LINE Login เป็น https://sudochatbot.online/api/line/callback ·
            และผูก OA เข้ากับ LINE Login channel (Linked OA) เพื่อให้ชวนเพิ่มเพื่อนอัตโนมัติ
          </InfoHint>
        </p>
        <form action={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>LINE Login — Channel ID</Label>
              <Input name="login_channel_id" placeholder={stored.loginId ? "เว้นว่าง = ใช้ค่าเดิม" : "เช่น 2001234567"} />
              <FieldStatus set={stored.loginId} />
            </div>
            <div>
              <Label>LINE Login — Channel secret</Label>
              <Input name="login_channel_secret" type="password" autoComplete="off" placeholder={stored.loginSecret ? "เว้นว่าง = ใช้ค่าเดิม" : "วาง secret"} />
              <FieldStatus set={stored.loginSecret} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Messaging API — Channel access token (long-lived)</Label>
              <Input name="oa_token" type="password" autoComplete="off" placeholder={stored.oaToken ? "เว้นว่าง = ใช้ค่าเดิม" : "วาง token ของ OA กลาง"} />
              <FieldStatus set={stored.oaToken} />
            </div>
            <div>
              <Label>Messaging API — Channel secret (ตรวจลายเซ็น webhook)</Label>
              <Input name="oa_channel_secret" type="password" autoComplete="off" placeholder={stored.oaSecret ? "เว้นว่าง = ใช้ค่าเดิม" : "วาง secret ของ Messaging channel"} />
              <FieldStatus set={stored.oaSecret} />
            </div>
          </div>
          {missing.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
              <span>ยังใช้งานไม่ได้ — ขาด {missing.join(" · ")}</span>
            </p>
          )}
          <div>
            <Label>Basic ID ของ OA (ไว้โชว์ให้ผู้ใช้เพิ่มเพื่อน)</Label>
            <Input name="oa_basic_id" defaultValue={basicId ?? ""} placeholder="@sudochatbot" />
          </div>
          <Button disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
        </form>
        {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}

        {configured && (
          <div className="mt-4 rounded-xl border border-neutral-200 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium"><LayoutGrid className="h-3.5 w-3.5 text-emerald-600" /> เมนูในแชท LINE (Rich Menu)</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              สร้างเมนู 6 ปุ่มให้ลูกค้ากดจากแชท LINE เข้าใช้งานได้ทันที — ผู้ช่วยบัญชี AI · ถ่ายรูปบิล · ออกเอกสาร · ยอดค้าง · รายงานภาษี · ช่วยเหลือ
              (ระบบสร้างรูปเมนูให้เอง ไม่ต้องออกแบบ)
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={buildRichMenu} disabled={menuBusy}>
              {menuBusy ? "กำลังสร้าง..." : "สร้าง / อัปเดตเมนูในแชท"}
            </Button>
            {menuMsg && <p className={`mt-2 text-xs ${menuMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{menuMsg.text}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
