"use client";
// หน้าสมัครสมาชิก — แยกจากหน้าเข้าสู่ระบบชัดเจน · กรอกแค่ 4 ช่อง เข้าใช้ได้ทันทีไม่ต้องรอเมลยืนยัน
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import AuthSide from "@/components/auth-side";
import { Eye, EyeOff, Check, ArrowRight } from "lucide-react";
import { signUpDirect } from "./actions";
import OAuthButtons from "@/components/oauth-buttons";

const PERKS = ["เริ่มฟรี ไม่ต้องใช้บัตรเครดิต", "ผู้ช่วยบัญชี AI + ถ่ายรูปบิลลงบัญชีให้", "ออกใบแจ้งหนี้/ใบกำกับภาษีได้ทันที"];

// ============================================================
// เดาโดเมนอีเมลที่พิมพ์ผิด — ระบบนี้สมัครแล้วเข้าได้ทันทีโดยไม่รอเมลยืนยัน (ตั้งใจ)
// ราคาของความสะดวกนั้นคือ อีเมลพิมพ์ผิด = ลืมรหัสผ่านแล้วกู้บัญชีไม่ได้ตลอดไป
// จึงดักคำผิดยอดฮิตก่อนสมัคร ให้กดแก้ได้คลิกเดียว (ไม่บังคับ — บางคนใช้โดเมนแปลกจริง)
// ============================================================
const COMMON_DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.com"];
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain || COMMON_DOMAINS.includes(domain)) return null;
  for (const d of COMMON_DOMAINS) {
    const dist = editDistance(domain, d);
    if (dist > 0 && dist <= 2) return `${email.slice(0, at)}@${d}`;
  }
  return null;
}

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agree, setAgree] = useState(false);
  const mismatch = pw2.length > 0 && pw !== pw2;
  const match = pw2.length > 0 && pw === pw2;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== pw2) { setError("รหัสผ่านสองช่องไม่ตรงกัน"); return; }
    setLoading(true);
    try {
      const r = await signUpDirect(name, email, pw, agree);
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
      {/* จอกว้าง: แผงเล่าคุณค่าซ้าย + ฟอร์มขวา (30 ส.ค. 2569 ตามภาพอ้างอิงของเจ้าของ)
          เดิมการ์ดเดี่ยวลอยกลางจอเปล่า — ครึ่งจอที่เหลือควรเล่าว่าระบบทำอะไรได้
          มือถือเห็นเฉพาะฟอร์มเหมือนเดิม ฟอร์มข้างในไม่ถูกแตะแม้แต่บรรทัดเดียว */}
      <div className="grid w-full max-w-sm gap-6 lg:max-w-4xl lg:grid-cols-2 lg:items-stretch">
        <AuthSide />
      <div className="w-full lg:self-center">
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

          {/* Google = ช่องทางที่คนใช้เยอะสุด วางไว้บนสุด กดครั้งเดียวจบ ไม่ต้องตั้งรหัสผ่าน */}
          <div className="mt-5">
            <OAuthButtons mode="signup" />
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-200" />
            <span className="text-xs text-neutral-400">หรือสมัครด้วยอีเมล</span>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อของคุณ / ชื่อเล่นก็ได้" autoComplete="name" className={inputCls} />
            <div>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="อีเมล" autoComplete="email" className={inputCls} />
              {/* อีเมลนี้คือกุญแจกู้บัญชี — เตือนคำผิดตรงนี้ ก่อนที่มันจะกลายเป็นบัญชีที่กู้ไม่ได้ */}
              {suggestEmail(email) && (
                <button type="button" onClick={() => setEmail(suggestEmail(email)!)}
                  className="mt-1 inline-flex min-h-[44px] items-center rounded-lg px-1 text-[12px] text-amber-700 hover:underline">
                  หมายถึง <span className="mx-1 font-semibold">{suggestEmail(email)}</span> ใช่ไหม? กดเพื่อแก้
                </button>
              )}
            </div>
            <div className="relative">
              <input type={showPw ? "text" : "password"} required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)}
                placeholder="ตั้งรหัสผ่าน (อย่างน้อย 8 ตัว)" autoComplete="new-password" className={`${inputCls} pr-11`} />
              <button type="button" onClick={() => setShowPw((v) => !v)} tabIndex={-1}
                className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 transition-colors hover:text-neutral-600"
                aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div>
              <input type={showPw ? "text" : "password"} required value={pw2} onChange={(e) => setPw2(e.target.value)}
                placeholder="พิมพ์รหัสผ่านอีกครั้ง" autoComplete="new-password"
                className={`${inputCls} ${mismatch ? "border-red-300 focus:border-red-400" : match ? "border-emerald-400" : ""}`} />
              {mismatch && <p className="mt-1 text-xs text-red-500">รหัสผ่านยังไม่ตรงกัน</p>}
              {match && <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3 w-3" /> รหัสผ่านตรงกัน</p>}
            </div>
            {/* consent ต้องติ๊กเอง ไม่ใช่ "การสมัครถือว่ายอมรับ" (แก้ 28 ส.ค. 2569 ตามผลตรวจ PDPA)
                implied consent พิสูจน์ไม่ได้ว่าใครเห็นเมื่อไร — ฝั่ง server บังคับซ้ำอีกชั้น
                และบันทึกหลักฐานลง consent_logs พร้อมเวลา */}
            <label className="flex items-start gap-2.5 rounded-xl bg-neutral-50 px-3 py-2.5 text-xs leading-relaxed text-neutral-600">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600" />
              <span>
                ฉันได้อ่านและยอมรับ<Link href="/terms" target="_blank" className="px-0.5 py-3 font-semibold underline">ข้อกำหนดการใช้งาน</Link>
                และ<Link href="/privacy" target="_blank" className="px-0.5 py-3 font-semibold underline">นโยบายความเป็นส่วนตัว</Link>
              </span>
            </label>
            <button type="submit" disabled={loading || mismatch || !agree}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">
              <ArrowRight className="h-4 w-4" /> {loading ? "กำลังสร้างบัญชี..." : "สมัครและเริ่มใช้เลย"}
            </button>
          </form>

          {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">{error}</p>}

          <p className="mt-5 rounded-xl bg-neutral-50 px-3 py-2.5 text-center text-xs text-neutral-500">
            มีบัญชีอยู่แล้ว? <Link href="/login" className="inline-flex min-h-[44px] items-center font-semibold text-emerald-600 hover:underline">เข้าสู่ระบบ</Link>
          </p>
        </div>
      </div>
      </div>
    </main>
  );
}
