"use client";
// ============================================================
//  ตั้งรหัสผ่านใหม่ — ปลายทางของลิงก์จากอีเมล
//
//  ผู้ใช้มาถึงหน้านี้ได้ก็ต่อเมื่อ /auth/callback แลก code เป็น session ให้แล้ว
//  ถ้าไม่มี session แปลว่าลิงก์หมดอายุหรือถูกใช้ไปแล้ว ต้องบอกให้ชัดและให้ทางไปต่อ
//  ไม่ใช่ปล่อยให้กรอกรหัสแล้วค่อยแจ้งว่าไม่สำเร็จ
// ============================================================
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await createClient().auth.getSession();
      setHasSession(!!data.session);
      setChecking(false);
    })();
  }, []);

  // เกณฑ์เดียวกับหน้าสมัคร — ถ้าคนละเกณฑ์ ผู้ใช้จะงงว่าทำไมตั้งไม่ผ่าน
  const tooShort = pw.length > 0 && pw.length < 8;
  const mismatch = pw2.length > 0 && pw !== pw2;
  const canSubmit = pw.length >= 8 && pw === pw2 && !loading;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const { error: err } = await createClient().auth.updateUser({ password: pw });
      if (err) throw err;
      // ตั้งรหัสใหม่แล้ว session เดิมยังใช้ได้ พาเข้าระบบเลย ไม่ต้องให้ล็อกอินซ้ำ
      window.location.href = "/dashboard";
    } catch (err) {
      const m = (err as Error).message;
      setError(
        /should be different|same as the old/i.test(m) ? "รหัสใหม่ต้องไม่ซ้ำกับรหัสเดิม"
          : /weak|pwned|compromised/i.test(m) ? "รหัสนี้เคยหลุดจากเว็บอื่นมาก่อน เลือกรหัสอื่นที่ไม่เคยใช้ที่ไหน"
            : /session|expired|Auth session missing/i.test(m) ? "ลิงก์หมดอายุแล้ว — ขอลิงก์ใหม่อีกครั้ง"
              : m,
      );
    } finally { setLoading(false); }
  }

  const field = "h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 pr-11 text-base outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 sm:text-sm";

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
          <Logo className="justify-center" />

          {checking ? (
            <p className="mt-6 text-center text-sm text-neutral-400">กำลังตรวจลิงก์...</p>
          ) : !hasSession ? (
            <>
              <div className="mt-5 grid h-12 w-12 place-items-center rounded-xl bg-amber-50 mx-auto">
                <TriangleAlert className="h-6 w-6 text-amber-600" />
              </div>
              <h1 className="mt-4 text-center text-lg font-bold tracking-tight">ลิงก์ใช้ไม่ได้แล้ว</h1>
              <p className="mt-2 text-center text-[13px] leading-relaxed text-neutral-500">
                ลิงก์ตั้งรหัสใหม่ใช้ได้ครั้งเดียวและมีอายุจำกัด — อาจถูกใช้ไปแล้วหรือหมดอายุ
              </p>
              <Link href="/forgot-password"
                className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700">
                ขอลิงก์ใหม่
              </Link>
              <p className="mt-4 text-center text-xs text-neutral-500">
                <Link href="/login" className="font-semibold text-emerald-700 hover:underline">กลับไปเข้าสู่ระบบ</Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-center text-lg font-bold tracking-tight">ตั้งรหัสผ่านใหม่</h1>
              <p className="mt-1 text-center text-xs text-neutral-500">ตั้งแล้วระบบจะพาเข้าใช้งานต่อทันที</p>

              <form onSubmit={submit} className="mt-6 space-y-3">
                <div className="relative">
                  <input type={showPw ? "text" : "password"} required autoComplete="new-password"
                    value={pw} onChange={(e) => setPw(e.target.value)}
                    placeholder="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)" className={field} />
                  <button type="button" aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 hover:text-neutral-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {tooShort && <p className="text-[12px] text-amber-700">รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร</p>}

                <input type={showPw ? "text" : "password"} required autoComplete="new-password"
                  value={pw2} onChange={(e) => setPw2(e.target.value)}
                  placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง" className={field} />
                {mismatch && <p className="text-[12px] text-red-600">รหัสผ่านสองช่องไม่ตรงกัน</p>}

                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}

                <button type="submit" disabled={!canSubmit}
                  className="h-11 w-full rounded-xl bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:opacity-50">
                  {loading ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
