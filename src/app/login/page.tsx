"use client";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);

  async function signIn(provider: "facebook" | "google") {
    setLoading(provider);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8">
        <h1 className="text-center text-xl font-bold">
          Sudo<span className="text-emerald-600">ChatBot</span>
        </h1>
        <p className="mt-2 text-center text-sm text-neutral-500">
          เข้าสู่ระบบด้วยบัญชีที่คุณใช้ดูแลเพจ/ร้านของคุณ
        </p>
        <div className="mt-8 space-y-3">
          <button
            onClick={() => signIn("facebook")}
            disabled={!!loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading === "facebook" ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย Facebook"}
          </button>
          <button
            onClick={() => signIn("google")}
            disabled={!!loading}
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
