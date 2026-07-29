"use client";
// ============================================================
//  ลืมรหัสผ่าน — ขอลิงก์ตั้งรหัสใหม่ทางอีเมล
//
//  ทำไมต้องมี: ก่อนหน้านี้ระบบไม่มีทางรีเซ็ตรหัสผ่านเลยแม้แต่ทางเดียว
//  ลูกค้าที่ลืมรหัส = เข้าข้อมูลบัญชีของกิจการตัวเองไม่ได้ถาวร
//  ซึ่งสำหรับระบบบัญชีที่เก็บเอกสารภาษีย้อนหลัง 5 ปี คือความเสียหายร้ายแรง
//
//  ⚠️ ไม่บอกว่าอีเมลนี้มีในระบบหรือไม่ — ขึ้นข้อความเดียวกันเสมอ
//     ถ้าบอกต่างกัน คนนอกจะใช้หน้านี้ไล่เดาว่าใครเป็นลูกค้าเราบ้าง
// ============================================================
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` },
      );
      // ยิงถี่เกินเป็นข้อจำกัดจริงที่ต้องบอก ส่วนกรณีอื่นกลืนไว้ไม่ให้เดาได้ว่ามีอีเมลนี้ไหม
      if (err && /rate limit|too many/i.test(err.message)) {
        setError("ขอลิงก์ถี่เกินไป — รอสัก 1 นาทีแล้วลองใหม่");
        return;
      }
      setSent(true);
    } catch {
      setSent(true);
    } finally { setLoading(false); }
  }

  const field = "h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-base outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 sm:text-sm";

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
          <Logo className="justify-center" />

          {sent ? (
            <>
              <div className="mt-5 grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 mx-auto">
                <MailCheck className="h-6 w-6 text-emerald-600" />
              </div>
              <h1 className="mt-4 text-center text-lg font-bold tracking-tight">ส่งลิงก์ให้แล้ว</h1>
              <p className="mt-2 text-center text-[13px] leading-relaxed text-neutral-500">
                ถ้ามีบัญชีที่ใช้อีเมล <b className="text-neutral-700">{email.trim().toLowerCase()}</b> อยู่ในระบบ
                เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว — ลิงก์ใช้ได้ครั้งเดียวและมีอายุจำกัด
              </p>
              <p className="mt-3 text-center text-[12px] text-neutral-400">
                ไม่เห็นอีเมล? ลองดูในกล่องจดหมายขยะ หรือรอสักครู่แล้วขอใหม่
              </p>
              <Link href="/login"
                className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700">
                กลับไปหน้าเข้าสู่ระบบ
              </Link>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-center text-lg font-bold tracking-tight">ลืมรหัสผ่าน</h1>
              <p className="mt-1 text-center text-xs text-neutral-500">
                กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสใหม่ไปให้
              </p>

              <form onSubmit={submit} className="mt-6 space-y-3">
                <input type="email" required autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="อีเมล" className={field} />
                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
                <button type="submit" disabled={loading || !email.trim()}
                  className="h-11 w-full rounded-xl bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:opacity-50">
                  {loading ? "กำลังส่ง..." : "ส่งลิงก์ตั้งรหัสใหม่"}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-neutral-500">
                นึกออกแล้ว? <Link href="/login" className="inline-flex min-h-[36px] items-center font-semibold text-emerald-700 hover:underline">กลับไปเข้าสู่ระบบ</Link>
              </p>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-neutral-400">
                สมัครด้วยบัญชี Google ก็ขอลิงก์นี้ได้ — ตั้งรหัสแล้วจะเข้าได้ทั้งสองทาง เผื่อวันไหนเข้าบัญชี Google ไม่ได้
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
