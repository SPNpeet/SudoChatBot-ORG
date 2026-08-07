"use client";
// ============================================================
//  แจ้งเตือน LINE — ออกแบบให้ "คลิกเดียวจบ" สำหรับเจ้าของร้านทั่วไป
//   · เชื่อมแล้ว: โชว์ชื่อบัญชี LINE ที่ผูกไว้ + ปุ่มทดสอบ/ยกเลิกการเชื่อม
//   · ยังไม่เชื่อม: ปุ่มเดียว "เชื่อมต่อ LINE" (ล็อกอิน LINE แล้วเสร็จเลย)
//   · คนที่อยากใช้ OA ของแบรนด์ตัวเอง ซ่อนไว้ใน "ตั้งค่าขั้นสูง"
// ============================================================
import { useState, useTransition } from "react";
import { Button, Input, Label } from "@/components/ui";
import { MessageCircle, CheckCircle2, Send, Unlink, AlertTriangle } from "lucide-react";
import { saveNotifySettings, testLineNotify, unlinkLine } from "../actions";

interface Props {
  shopId: string;
  platformReady: boolean;              // แอดมินตั้งค่า OA กลางไว้แล้วหรือยัง
  oaBasicId: string | null;            // @xxxx ของ OA กลาง (ไว้บอกให้เพิ่มเพื่อน)
  linked: null | { source: "platform" | "own"; displayName: string | null; toId: string; notifyApproval: boolean };
  hasOwnToken: boolean;
  status?: string;                     // ผลลัพธ์จาก ?line=... หลังกลับจาก LINE
}

const STATUS_MSG: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: "เชื่อมต่อ LINE สำเร็จ — ลองเช็คข้อความต้อนรับใน LINE ได้เลย" },
  need_friend: { ok: false, text: "เชื่อมบัญชีแล้ว แต่ยังส่งข้อความไม่ได้ — ต้องเพิ่มบัญชี LINE ของระบบเป็นเพื่อนก่อน แล้วกด 'ส่งข้อความทดสอบ'" },
  cancelled: { ok: false, text: "ยกเลิกการเชื่อมต่อ" },
  not_configured: { ok: false, text: "ผู้ดูแลแพลตฟอร์มยังไม่ได้ตั้งค่า LINE — ใช้วิธีขั้นสูงด้านล่างไปก่อนได้" },
  bad_state: { ok: false, text: "ลิงก์หมดอายุ กดเชื่อมต่อใหม่อีกครั้ง" },
  token_failed: { ok: false, text: "แลกสิทธิ์กับ LINE ไม่สำเร็จ ลองใหม่อีกครั้ง" },
  profile_failed: { ok: false, text: "ดึงข้อมูลบัญชี LINE ไม่สำเร็จ ลองใหม่อีกครั้ง" },
  forbidden: { ok: false, text: "เฉพาะเจ้าของ/ผู้ดูแลเชื่อมต่อได้" },
  failed: { ok: false, text: "เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง" },
};

export default function NotifySettingsForm({ shopId, platformReady, oaBasicId, linked, hasOwnToken, status }: Props) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const banner = status ? STATUS_MSG[status] : null;

  function saveOwn(fd: FormData) {
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
      setResult(r.ok ? { ok: true, msg: "ส่งข้อความทดสอบแล้ว — เช็คใน LINE ได้เลย" } : { ok: false, msg: r.error });
    });
  }

  function unlink() {
    setResult(null);
    start(async () => {
      const r = await unlinkLine(shopId);
      setResult(r.ok ? { ok: true, msg: "ยกเลิกการเชื่อมต่อแล้ว" } : { ok: false, msg: r.error });
    });
  }

  return (
    <div className="space-y-4">
      {banner && (
        <p className={`rounded-xl px-3 py-2.5 text-sm ${banner.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
          {banner.text}
        </p>
      )}

      {linked ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> เชื่อมต่อ LINE แล้ว
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            {linked.source === "platform"
              ? <>ส่งเข้าแชท LINE ของ <b>{linked.displayName ?? "บัญชีที่เชื่อมไว้"}</b> ผ่านบัญชีทางการของระบบ</>
              : <>ใช้ LINE OA ของกิจการเอง ส่งไปที่ <b>{linked.toId.slice(0, 8)}…</b></>}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={test} disabled={pending}>
              <Send className="h-3.5 w-3.5" /> {pending ? "กำลังส่ง..." : "ส่งข้อความทดสอบ"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={unlink} disabled={pending}>
              <Unlink className="h-3.5 w-3.5" /> ยกเลิกการเชื่อมต่อ
            </Button>
          </div>
        </div>
      ) : platformReady ? (
        <div className="rounded-2xl border border-neutral-200 p-4">
          <p className="text-sm font-medium">รับแจ้งเตือนเข้า LINE ส่วนตัวของคุณ</p>
          <p className="mt-1 text-xs text-neutral-500">
            กดปุ่มเดียว ล็อกอิน LINE แล้วเสร็จ — ไม่ต้องสร้างบัญชีทางการ ไม่ต้องคัดลอกโค้ดอะไรทั้งนั้น
          </p>
          <a href={`/api/line/connect?shop_id=${shopId}`}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#06C755] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95">
            <MessageCircle className="h-4 w-4" /> เชื่อมต่อ LINE
          </a>
          <p className="mt-2 text-xs text-neutral-400">
            ระบบจะขอให้เพิ่มบัญชีทางการ{oaBasicId ? ` ${oaBasicId}` : ""} เป็นเพื่อนในขั้นตอนเดียวกัน (จำเป็นเพื่อให้ส่งข้อความหาคุณได้)
          </p>
        </div>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ผู้ดูแลแพลตฟอร์มยังไม่ได้ตั้งค่าบัญชี LINE กลาง — ระหว่างนี้ใช้ &ldquo;ตั้งค่าขั้นสูง&rdquo; ด้านล่างเชื่อม OA ของกิจการเองได้
        </p>
      )}

      <details className="rounded-xl border border-neutral-200 p-3">
        <summary className="flex min-h-[44px] cursor-pointer items-center text-xs font-medium text-neutral-600">ตั้งค่าขั้นสูง — ใช้ LINE OA ของกิจการเอง</summary>
        <form action={saveOwn} className="mt-3 space-y-3">
          <p className="text-xs leading-relaxed text-neutral-400">
            เหมาะกับกิจการที่อยากให้ข้อความมาจากบัญชีทางการของตัวเอง หรืออยากส่งเข้ากลุ่ม LINE ของทีม —
            สร้าง LINE Official Account ฟรีที่ developers.line.biz → เปิด Messaging API → คัดลอก Channel access token
            แล้วเพิ่มบอทเป็นเพื่อน/ดึงเข้ากลุ่มปลายทาง
          </p>
          <div>
            <Label>Channel access token</Label>
            <Input name="line_channel_token" type="password" autoComplete="off"
              placeholder={hasOwnToken ? "•••••••• ตั้งค่าไว้แล้ว — เว้นว่าง = ใช้ค่าเดิม" : "วาง token ของ LINE OA กิจการ"} />
          </div>
          <div>
            <Label>ส่งเข้า (User ID หรือ Group ID)</Label>
            <Input name="line_to_id" defaultValue={linked?.source === "own" ? linked.toId : ""} placeholder="เช่น U1234... หรือ C1234... (กลุ่ม)" />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" name="notify_approval" defaultChecked={linked?.notifyApproval ?? true} className="h-4 w-4 accent-emerald-600" />
            แจ้งเตือนเมื่อมีค่าใช้จ่ายรออนุมัติ
          </label>
          <Button size="sm" disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึกการตั้งค่าขั้นสูง"}</Button>
        </form>
      </details>

      {result && <p className={`text-xs ${result.ok ? "text-emerald-600" : "text-red-600"}`}>{result.msg}</p>}
    </div>
  );
}
