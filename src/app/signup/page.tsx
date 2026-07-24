"use client";
// หน้าสมัครสมาชิก — แยกจากหน้าเข้าสู่ระบบชัดเจน · กรอกแค่ 4 ช่อง เข้าใช้ได้ทันทีไม่ต้องรอเมลยืนยัน
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { Eye, EyeOff, Check, Sparkles } from "lucide-react";
import { signUpDirect } from "./actions";

const PERKS = ["เริ่มฟรี ไม่ต้องใช้บัตรเครดิต", "ผู้ช่วยบัญชี AI + ถ่ายรูปบิลลงบัญชีให้", "ออกใบแจ้งหนี้/ใบกำกับภาษีได้ทันที"];

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = pw2.length > 0 && pw !== pw2;
  const match = pw2.length > 0 && pw === pw2;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== pw2) { setError("รหัสผ่านสองช่องไม่ตรงกัน"); return; }
    setLoading(true);
    try {
      const r = await signUpDirect(name, email, pw);
      if (!r.ok) { setError(r.error ?? "สมัครไม่สำเร็จ ลองใหม่อีกครั้ง"); return; }
      // สมัครสำเร็จ -> ล็อกอินต่อทันที ไม่ต้องรอเมลยืนยัน
      const supabase = createClient();
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pw });
      if (loginErr) { setError("สมัครสำเร็จแล้ว! แต่เข้าสู่ระบบอัตโนมัติไม่ได้ — กดเข้าสู่ระบบด้วยอีเมล/รหัสผ่านที่เพิ่งตั้ง"); return; }
      window.location.href = "/dashboard";
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-base outline-none focus:border-emerald-500 sm:text-sm";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-white px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-emerald-100 bg-white p-8 shadow-sm">
          <Logo className="justify-center" />
          <h1 className="mt-4 text-center text-lg font-bold tracking-tight">สร้างบัญชีฟรี</h1>
          <ul className="mt-3 space-y-1.5">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2 text-xs text-neutral-500">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> {p}
              </li>
            ))}
          </ul>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อของคุณ / ชื่อเล่นก็ได้" autoComplete="name" className={inputCls} />
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="อีเมล" autoComplete="email" className={inputCls} />
            <div className="relative">
              <input type={showPw ? "text" : "password"} required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)}
                placeholder="ตั้งรหัสผ่าน (อย่างน้อย 6 ตัว)" autoComplete="new-password" className={`${inputCls} pr-11`} />
              <button type="button" onClick={() => setShowPw((v) => !v)} tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div>
              <input type={showPw ? "text" : "password"} required value={pw2} onChange={(e) => setPw2(e.target.value)}
                placeholder="พิมพ์รหัสผ่านอีกครั้ง" autoComplete="new-password"
                className={`${inputCls} ${mismatch ? "border-red-300 focus:border-red-400" : match ? "border-emerald-400" : ""}`} />
              {mismatch && <p className="mt-1 text-[11px] text-red-500">รหัสผ่านยังไม่ตรงกัน</p>}
              {match && <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600"><Check className="h-3 w-3" /> รหัสผ่านตรงกัน</p>}
            </div>
            <button type="submit" disabled={loading || mismatch}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">
              <Sparkles className="h-4 w-4" /> {loading ? "กำลังสร้างบัญชี..." : "สมัครและเริ่มใช้เลย"}
            </button>
          </form>

          {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">{error}</p>}

          <p className="mt-4 text-center text-xs text-neutral-500">
            มีบัญชีแล้ว? <Link href="/login" className="font-medium text-emerald-600 hover:underline">เข้าสู่ระบบ</Link>
          </p>
        </div>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-neutral-400">
          การสมัครถือว่ายอมรับ<Link href="/terms" className="underline">เงื่อนไขการใช้งาน</Link>และ<Link href="/privacy" className="underline">นโยบายความเป็นส่วนตัว</Link>
        </p>
      </div>
    </main>
  );
}
