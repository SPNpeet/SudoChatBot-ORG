"use client";
// ============================================================
//  ฟอร์มแก้ข้อมูลบัญชีตัวเอง + ขอลิงก์ตั้งรหัสผ่านใหม่
//
//  ตั้งใจไม่ให้ตั้งรหัสผ่านใหม่ตรงหน้านี้ทันที
//  หน้านี้เปิดค้างได้ทั้งวันบนเครื่องที่ใช้ร่วมกัน ถ้ามีช่องตั้งรหัสใหม่ตรง ๆ
//  ใครเดินมาก็ยึดบัญชีไปได้เลยโดยไม่ต้องรู้รหัสเดิม — บังคับผ่านลิงก์ทางอีเมล
//  แปลว่าต้องเข้าถึงอีเมลได้จริงก่อนเสมอ
// ============================================================
import { useState, useTransition } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { updateMyProfile } from "../actions";
import { CheckCircle2, KeyRound, Mail, UserRound } from "lucide-react";

export default function AccountForm({ email, displayName, phone, joined }: {
  email: string | null; displayName: string | null; phone: string | null; joined: string | null;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pwState, setPwState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [pwMsg, setPwMsg] = useState("");

  function submit(fd: FormData) {
    setResult(null);
    start(async () => {
      const r = await updateMyProfile(fd);
      setResult(r.ok ? { ok: true, msg: "บันทึกแล้ว" } : { ok: false, msg: r.error });
      if (r.ok) setTimeout(() => setResult(null), 3000);
    });
  }

  async function sendReset() {
    if (!email) return;
    setPwState("sending"); setPwMsg("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error && /rate limit|too many/i.test(error.message)) {
        setPwState("error"); setPwMsg("ขอลิงก์ถี่เกินไป — รอสัก 1 นาทีแล้วลองใหม่");
        return;
      }
      setPwState("sent");
    } catch {
      setPwState("error"); setPwMsg("ส่งลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  const joinedTH = joined
    ? new Date(joined).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-neutral-400" /> ข้อมูลผู้ใช้
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* อีเมลมาก่อนช่องกรอก — นี่คือสิ่งที่ผู้ใช้เข้ามาหน้านี้เพื่อดู
            ชื่อซ้ำกันได้ อีเมลคือตัวที่ระบุตัวตนได้จริงว่าล็อกอินด้วยบัญชีไหน */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-[11px] text-neutral-400">
            <Mail className="h-3 w-3" /> อีเมลที่ใช้เข้าสู่ระบบ
          </p>
          <p className="mt-0.5 break-all text-sm font-semibold text-neutral-900">{email ?? "ไม่มีอีเมล"}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">
            เปลี่ยนเองไม่ได้ เพราะเป็นทั้งกุญแจเข้าสู่ระบบและชื่อที่ติดอยู่กับเอกสารทุกใบที่บันทึกไว้
            — ถ้าต้องเปลี่ยนจริง ๆ ให้ติดต่อผู้ดูแลระบบ
            {joinedTH && <> · เปิดบัญชีเมื่อ {joinedTH}</>}
          </p>
        </div>

        <form action={submit} className="space-y-3">
          <div>
            <Label>ชื่อที่แสดง</Label>
            <Input name="display_name" defaultValue={displayName ?? ""} required minLength={2} maxLength={80}
              placeholder="เช่น สมชาย ใจดี" autoComplete="name" />
            <p className="mt-1 text-[11px] text-neutral-400">
              ชื่อนี้จะขึ้นในประวัติการแก้ไขเอกสาร และในรายชื่อทีมของกิจการ — ใส่ชื่อจริงจะตามงานกันง่ายที่สุด
            </p>
          </div>
          <div className="sm:max-w-xs">
            <Label>เบอร์ติดต่อ (ไม่บังคับ)</Label>
            <Input name="phone" defaultValue={phone ?? ""} maxLength={30} placeholder="08x-xxx-xxxx"
              inputMode="tel" autoComplete="tel" />
          </div>
          <div className="flex items-center gap-3">
            <Button disabled={pending} className="w-full sm:w-auto">{pending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</Button>
            {result?.ok && <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />{result.msg}</span>}
          </div>
          {result && !result.ok && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{result.msg}</p>}
        </form>

        <div className="border-t border-neutral-100 pt-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-800">
            <KeyRound className="h-4 w-4 text-neutral-400" /> รหัสผ่าน
          </p>
          {pwState === "sent" ? (
            <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[12px] leading-relaxed text-emerald-700">
              ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ <b>{email}</b> แล้ว — ลิงก์ใช้ได้ครั้งเดียวและมีอายุจำกัด
              ถ้าไม่เจอในกล่องจดหมาย ลองดูในอีเมลขยะ
            </p>
          ) : (
            <>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                เราจะส่งลิงก์ตั้งรหัสใหม่ไปที่อีเมลของคุณ — ตั้งรหัสจากหน้านี้ตรง ๆ ไม่ได้
                เพื่อกันคนที่มานั่งเครื่องต่อจากคุณยึดบัญชีไปโดยไม่รู้รหัสเดิม
              </p>
              <Button type="button" variant="outline" onClick={sendReset}
                disabled={pwState === "sending" || !email} className="mt-2 w-full sm:w-auto">
                {pwState === "sending" ? "กำลังส่ง..." : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
              </Button>
            </>
          )}
          {pwState === "error" && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{pwMsg}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
