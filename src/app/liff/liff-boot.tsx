"use client";
// ตัวเริ่ม LIFF ฝั่ง client — ต้องเป็น client component เพราะ SDK ทำงานบนเบราว์เซอร์เท่านั้น
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, TriangleAlert } from "lucide-react";

const SDK = "https://static.line-scdn.net/liff/edge/2/sdk.js";

interface Liff {
  init(c: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  login(o?: { redirectUri?: string }): void;
}

export default function LiffBoot({ liffId, target }: { liffId: string; target: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // ⚠️ ไม่มี LIFF ID = ห้ามค้างอยู่หน้าเปล่า
    // หน้านี้ถูกเปิดจากเมนูใน LINE ซึ่งเป็นทางเข้าของลูกค้าจริง
    // ถ้าเจ้าของยังไม่ได้ตั้ง LIFF ID ให้พาไปหน้าปลายทางตามปกติทันที
    // เมนูต้องใช้งานได้เสมอ ไม่ว่าตั้งค่าครบหรือยัง
    if (!liffId) { router.replace(target); return; }

    const go = () => { if (!cancelled) router.replace(target); };

    const boot = async () => {
      try {
        const liff = (window as unknown as { liff?: Liff }).liff;
        if (!liff) { go(); return; }
        await liff.init({ liffId });
        // ยังไม่ได้ยืนยันตัวกับ LINE (เปิดลิงก์นอกแอป) — ให้ LINE ยืนยันก่อนแล้วกลับมาที่เดิม
        if (!liff.isLoggedIn()) { liff.login({ redirectUri: window.location.href }); return; }
        go();
      } catch (e) {
        // SDK พังไม่ควรทำให้ผู้ใช้ไปต่อไม่ได้ — แจ้งแล้วพาไปหน้าเว็บปกติ
        if (!cancelled) { setErr((e as Error).message); setTimeout(go, 1500); }
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK}"]`);
    if (existing) { void boot(); return () => { cancelled = true; }; }

    const s = document.createElement("script");
    s.src = SDK;
    s.onload = () => void boot();
    s.onerror = () => go();          // โหลด SDK ไม่ได้ (เน็ตแย่/โดนบล็อก) = ไปหน้าเว็บปกติ
    document.head.appendChild(s);
    return () => { cancelled = true; };
  }, [liffId, target, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      {err ? (
        <>
          <TriangleAlert className="h-6 w-6 text-amber-500" />
          <p className="text-sm text-neutral-600">เปิดแบบแอปในไลน์ไม่สำเร็จ กำลังพาไปหน้าเว็บปกติ</p>
        </>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <h1 className="text-sm font-medium text-neutral-500">กำลังเปิดระบบบัญชีจาก LINE…</h1>
        </>
      )}
    </div>
  );
}
