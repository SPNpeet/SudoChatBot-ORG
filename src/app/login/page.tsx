"use client";
// ============================================================
//  เข้าสู่ระบบ — สำหรับคนที่ "มีบัญชีอยู่แล้ว" เท่านั้น
//  แยกจากหน้าสมัคร (/signup) ชัดเจน ไม่มีปุ่มสมัครปนในฟอร์ม
//  ช่องทาง: Google · Facebook · อีเมล/รหัสผ่าน — ชุดเดียวกับหน้าสมัคร เปลี่ยนแค่คำบนปุ่ม
// ============================================================
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Eye, EyeOff } from "lucide-react";
import OAuthButtons from "@/components/oauth-buttons";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function emailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (err) throw err;
      window.location.href = "/dashboard";
    } catch (err) {
      const m = (err as Error).message;
      setError(
        m.includes("Invalid login") ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง — ถ้ายังไม่เคยสมัคร กดสมัครสมาชิกฟรีด้านล่าง"
          : m.includes("Email not confirmed") ? "ยังไม่ได้ยืนยันอีเมล — ตรวจกล่องอีเมลของคุณ"
            : m.includes("rate limit") ? "ลองถี่เกินไป — รอสักครู่แล้วลองใหม่"
              : m,
      );
    } finally { setLoading(false); }
  }

  const field = "h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-base outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 sm:text-sm";

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
          <Logo className="justify-center" />
          <h1 className="mt-4 text-center text-lg font-bold tracking-tight">เข้าสู่ระบบ</h1>
          <p className="mt-1 text-center text-xs text-neutral-500">สำหรับผู้ที่มีบัญชีอยู่แล้ว</p>

          <div className="mt-6">
            <OAuthButtons mode="signin" providers={["google", "facebook"]} />
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-200" />
            <span className="text-[11px] text-neutral-400">หรือใช้อีเมล</span>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>

          <form onSubmit={emailLogin} className="space-y-3">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="อีเมล" autoComplete="email" className={field} />
            <div className="relative">
              <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน" autoComplete="current-password" className={`${field} pr-11`} />
              <button type="button" onClick={() => setShowPw((v) => !v)} tabIndex={-1}
                aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {/* ลืมรหัสผ่านต้องอยู่ตรงนี้ ตอนที่คนเพิ่งกรอกรหัสผิด ไม่ใช่ซ่อนท้ายหน้า */}
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-neutral-500 hover:text-emerald-700 hover:underline">
                ลืมรหัสผ่าน?
              </Link>
            </div>
            <button type="submit" disabled={loading}
              className="h-11 w-full rounded-xl bg-neutral-900 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-60">
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">{error}</p>}

          <p className="mt-5 rounded-xl bg-neutral-50 px-3 py-2.5 text-center text-xs text-neutral-500">
            ยังไม่มีบัญชี? <Link href="/signup" className="font-semibold text-emerald-600 hover:underline">สมัครสมาชิกฟรี</Link>
          </p>

        </div>

        {/* ต้องมีนโยบายความเป็นส่วนตัวด้วย ไม่ใช่เงื่อนไขอย่างเดียว —
            หน้านี้มีปุ่มเข้าระบบด้วย Google/Facebook ซึ่งทั้งสองค่ายบังคับให้ลิงก์นโยบายไว้
            และ PDPA ก็ต้องแจ้งก่อน/ขณะเก็บข้อมูล (หน้าสมัครมีครบอยู่แล้ว หน้านี้ตกไป) */}
        <p className="mt-4 text-center text-[11px] leading-relaxed text-neutral-400">
          การเข้าสู่ระบบถือว่ายอมรับ<Link href="/terms" className="underline">เงื่อนไขการใช้งาน</Link>
          และ<Link href="/privacy" className="underline">นโยบายความเป็นส่วนตัว</Link>
        </p>
      </div>
    </main>
  );
}
