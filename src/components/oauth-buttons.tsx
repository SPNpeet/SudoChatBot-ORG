"use client";
// ============================================================
//  ปุ่มเข้าระบบด้วยบัญชีภายนอก — ใช้ร่วมกันทั้งหน้าสมัครและหน้าเข้าสู่ระบบ
//  หมายเหตุสำคัญ: OAuth ของ Supabase ไม่มีโหมด "เข้าอย่างเดียว ห้ามสมัคร"
//  ถ้าอีเมลนั้นยังไม่มีบัญชี ระบบจะสร้างให้อัตโนมัติ — จึงต้องเขียนบอกผู้ใช้ตรงๆ
//  ไม่ให้เข้าใจผิดว่า "กดเข้าสู่ระบบแล้วทำไมได้บัญชีใหม่"
// ============================================================
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type OAuthProvider = "google" | "facebook";

const LABEL: Record<OAuthProvider, string> = { google: "Google", facebook: "Facebook" };

function GoogleMark() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.6c-.1 1.1-.9 2.8-2.5 3.9l-.02.15 3.6 2.8.25.02c2.3-2.1 3.6-5.2 3.6-8.8Z" />
      <path fill="#34A853" d="M12 24c3.3 0 6-1.1 8-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.9-5l-.14.01-3.7 2.9-.05.14C3.3 21.3 7.3 24 12 24Z" />
      <path fill="#FBBC05" d="M5.1 14.4c-.3-.8-.4-1.6-.4-2.4 0-.9.2-1.7.4-2.4l-.01-.16L1.3 6.5l-.12.06A12 12 0 0 0 0 12c0 1.9.5 3.8 1.2 5.4l3.9-3Z" />
      <path fill="#EA4335" d="M12 4.7c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.3 0 12 0 7.3 0 3.3 2.7 1.2 6.6l3.9 3c1-2.9 3.7-4.9 6.9-4.9Z" />
    </svg>
  );
}

export default function OAuthButtons({ mode, providers = ["google"] }: {
  mode: "signin" | "signup";
  providers?: OAuthProvider[];
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verb = mode === "signup" ? "สมัครด้วย" : "เข้าสู่ระบบด้วย";

  async function go(provider: OAuthProvider) {
    setLoading(provider); setError(null);
    try {
      // เช็คก่อนพา redirect: ค่ายที่ยังไม่เปิดใน Supabase จะพาไปเจอหน้า JSON ดิบ
      const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      });
      const s = await r.json();
      if (!s?.external?.[provider]) {
        setLoading(null);
        setError(`${LABEL[provider]} ยังไม่เปิดใช้งาน — ใช้อีเมล/รหัสผ่านแทนได้เลย`);
        return;
      }
      const supabase = createClient();
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider, options: { redirectTo: `${location.origin}/auth/callback` },
      });
      if (e) { setLoading(null); setError("ช่องทางนี้ยังไม่พร้อม — ใช้อีเมล/รหัสผ่านแทนได้เลย"); }
    } catch {
      setLoading(null);
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div className="space-y-2.5">
      {providers.includes("google") && (
        <button type="button" onClick={() => go("google")} disabled={!!loading}
          className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-300 bg-white text-sm font-medium text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-60">
          <GoogleMark /> {loading === "google" ? "กำลังเชื่อมต่อ..." : `${verb} Google`}
        </button>
      )}
      {providers.includes("facebook") && (
        <button type="button" onClick={() => go("facebook")} disabled={!!loading}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-[13px] text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-60">
          {loading === "facebook" ? "กำลังเชื่อมต่อ..." : `${verb} Facebook`}
        </button>
      )}
      {error && <p className="text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
