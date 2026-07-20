"use client";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function oauth(provider: "facebook" | "google") {
    setLoading(provider); setMsg(null);
    // เช็คก่อน redirect: ค่ายที่ยังไม่เปิดใน Supabase จะพาไปเจอหน้า JSON error ดิบ — กันไว้ตรงนี้
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      });
      const s = await r.json();
      if (!s?.external?.[provider]) {
        setLoading(null);
        setMsg({ ok: false, text: `เข้าสู่ระบบด้วย ${provider === "google" ? "Google" : "Facebook"} ยังไม่เปิดใช้งาน — ใช้อีเมล/รหัสผ่าน หรือช่องทางอื่นได้เลยค่ะ` });
        return;
      }
    } catch { /* เช็คไม่ได้ให้ลองต่อตามปกติ */ }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setLoading(null);
      setMsg({ ok: false, text: "ช่องทางนี้ยังไม่เปิดใช้งาน — ใช้อีเมล/รหัสผ่านด้านล่างได้เลย" });
    }
  }

  async function emailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading("email"); setMsg(null);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) { window.location.href = "/dashboard"; return; }
        setMsg({ ok: true, text: "สมัครสำเร็จ! ตรวจอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        window.location.href = "/dashboard";
      }
    } catch (err) {
      const m = (err as Error).message;
      const th = m.includes("Invalid login") ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
        : m.includes("already registered") ? "อีเมลนี้มีบัญชีแล้ว — กดเข้าสู่ระบบ"
        : m.includes("Email not confirmed") ? "ยังไม่ได้ยืนยันอีเมล — ตรวจกล่องอีเมลของคุณ"
        : m.includes("rate limit") ? "ระบบส่งอีเมลถี่เกินไป — รอสักครู่แล้วลองใหม่ หรือติดต่อผู้ดูแลระบบ"
        : m.includes("at least") || m.includes("Password") ? "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"
        : m.includes("invalid format") || m.includes("is invalid") ? "รูปแบบอีเมลไม่ถูกต้อง"
        : m;
      setMsg({ ok: false, text: th });
    } finally { setLoading(null); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8">
        <Logo className="justify-center" />
        <p className="mt-2 text-center text-sm text-neutral-500">
          {mode === "signin" ? "เข้าสู่ระบบเพื่อจัดการร้านของคุณ" : "สร้างบัญชีใหม่เพื่อเริ่มใช้งาน"}
        </p>

        {/* อีเมล/รหัสผ่าน */}
        <form onSubmit={emailAuth} className="mt-6 space-y-3">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="อีเมล" autoComplete="email"
            className="h-11 w-full rounded-xl border border-neutral-300 px-3.5 text-base outline-none focus:border-emerald-500 sm:text-sm"
          />
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)" autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="h-11 w-full rounded-xl border border-neutral-300 px-3.5 text-base outline-none focus:border-emerald-500 sm:text-sm"
          />
          <button
            type="submit" disabled={!!loading}
            className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading === "email" ? "กำลังดำเนินการ..." : mode === "signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </button>
        </form>

        {msg && (
          <p className={`mt-3 text-center text-xs ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>
        )}

        <p className="mt-3 text-center text-xs text-neutral-500">
          {mode === "signin" ? "ยังไม่มีบัญชี? " : "มีบัญชีแล้ว? "}
          <button
            type="button"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}
            className="font-medium text-emerald-600 hover:underline"
          >
            {mode === "signin" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
          </button>
        </p>

        {/* ตัวคั่น */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-neutral-200" />
          <span className="text-[11px] text-neutral-400">หรือ</span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        {/* OAuth */}
        <div className="space-y-3">
          <button
            onClick={() => oauth("facebook")} disabled={!!loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading === "facebook" ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย Facebook"}
          </button>
          <button
            onClick={() => oauth("google")} disabled={!!loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
          >
            {loading === "google" ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย Google"}
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-neutral-400">
          การเข้าสู่ระบบถือว่ายอมรับเงื่อนไขการใช้งาน<br />ใช้ Facebook ที่เป็นแอดมินเพจ เพื่อเชื่อมต่อเพจได้ทันที
        </p>
      </div>
    </main>
  );
}
