"use client";
// ============================================================
//  ปุ่มเข้าระบบด้วยบัญชีภายนอก — ใช้ร่วมกันทั้งหน้าสมัครและหน้าเข้าสู่ระบบ
//  แสดงชุดเดียวกันทั้งสองหน้า เปลี่ยนแค่คำ (สมัครด้วย / เข้าสู่ระบบด้วย)
//  เจตนา: ไม่ให้มีช่องทางที่โผล่หน้าเดียว — คนกดผิดหน้าแล้วงงว่าทำไมได้บัญชีใหม่
//
//  หมายเหตุสำคัญ: OAuth ของ Supabase ไม่มีโหมด "เข้าอย่างเดียว ห้ามสมัคร"
//  ถ้าอีเมลนั้นยังไม่มีบัญชี ระบบจะสร้างให้อัตโนมัติ — จึงต้องเขียนบอกผู้ใช้ตรงๆ
//  ไม่ให้เข้าใจผิดว่า "กดเข้าสู่ระบบแล้วทำไมได้บัญชีใหม่"
//
//  2026-07-29 เอา Facebook ออก (เจ้าของสั่ง)
//  เหตุผล: คนทำบัญชีธุรกิจแทบไม่ใช้ Facebook ล็อกอิน แต่การมีไว้ทำให้ต้องแบก
//  ภาระฝั่ง Meta ตลอดไป (App Review ประจำปี · Data Deletion Callback · เอกสารกฎหมาย)
//
//  ⚠️ ห้ามลบข้อความเรื่อง Facebook ออกจากหน้านโยบายความเป็นส่วนตัว
//     และหน้าการลบข้อมูล จนกว่าจะปิด provider ใน Supabase และไม่มีบัญชี
//     ที่ผูกกับ Facebook เหลืออยู่จริง — ตราบใดที่ยังถือข้อมูลที่ได้จาก Facebook อยู่
//     หน้าที่ตามข้อกำหนดของ Meta และ PDPA ยังไม่จบ
// ============================================================
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authOrigin } from "@/lib/app-origin";

export type OAuthProvider = "google";

const LABEL: Record<OAuthProvider, string> = { google: "Google" };

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
        provider, options: { redirectTo: `${authOrigin()}/auth/callback` },
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
      <LineLoginButton verb={verb} />
      {error && <p className="text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ============================================================
//  ปุ่ม LINE Login — flow ทำเองฝั่ง server (/api/auth/line/*) เพราะ Supabase ไม่รองรับ LINE
//  โผล่เฉพาะเมื่อแพลตฟอร์มตั้ง LINE_LOGIN_CHANNEL_ID/SECRET แล้ว (ถาม /status ก่อน)
//  ยังไม่ตั้ง = ไม่มีปุ่ม = หน้าเดิมไม่เปลี่ยนอะไรเลย — เปิดได้โดยไม่ต้อง deploy ใหม่
// ============================================================
function LineLoginButton({ verb }: { verb: string }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    fetch("/api/auth/line/status")
      .then((r) => r.json())
      .then((j) => setEnabled(!!j?.enabled))
      .catch(() => { /* ถามไม่ได้ = ไม่โชว์ปุ่ม ดีกว่าโชว์แล้วกดพัง */ });
  }, []);
  if (!enabled) return null;
  return (
    <a href="/api/auth/line/start" onClick={() => setLoading(true)}
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-[#06C755] text-sm font-medium text-white transition hover:brightness-105 disabled:opacity-60">
      {/* ฟองแชทแบบกลาง ๆ ไม่ใช่โลโก้ทางการของ LINE — เลี่ยงเงื่อนไขการใช้เครื่องหมายการค้า */}
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 3C6.5 3 2 6.6 2 11c0 2.6 1.5 4.9 3.9 6.4-.1.6-.5 2-.6 2.4-.1.5.2.5.5.4.2-.1 2.5-1.6 3.5-2.3.9.2 1.8.3 2.7.3 5.5 0 10-3.6 10-8.1S17.5 3 12 3Z" />
      </svg>
      {loading ? "กำลังเชื่อมต่อ..." : `${verb} LINE`}
    </a>
  );
}
