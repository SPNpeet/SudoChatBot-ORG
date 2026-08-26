"use client";
// ============================================================
//  ปุ่มสลับภาษา ไทย / EN
//
//  ⚠️ ตั้ง cookie เองแล้ว router.refresh() แทนการทำ route /en/...
//  เพราะการแยก route ต้องรื้อ sitemap · canonical · JSON-LD ทั้งชุด
//  ซึ่งตอนนี้ตั้งไว้ถูกและมีคอมเมนต์กำกับว่าเคยตั้งผิดมาก่อน (ดู src/lib/i18n.ts)
//
//  ⚠️ ต้องเป็นปุ่มจริงที่กดได้ด้วยนิ้ว ไม่ใช่ตัวหนังสือเล็ก ๆ (กติกาข้อ 9: เป้ากดขั้นต่ำ 44px)
//  และต้องเห็นชัดว่าตอนนี้อยู่ภาษาอะไร ไม่ใช่เดาเอาจากปุ่มที่เขียนว่าอีกภาษาหนึ่ง
// ============================================================
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";

export default function LangToggle({ lang }: { lang: "th" | "en" }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function set(next: "th" | "en") {
    if (next === lang) return;
    // 1 ปี · path=/ เพื่อให้ทุกหน้าสาธารณะเห็นค่าเดียวกัน
    document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }

  return (
    <div className="inline-flex min-h-[44px] items-center gap-0.5 rounded-xl border border-neutral-200 p-0.5"
      role="group" aria-label="เลือกภาษา / Choose language">
      <Languages className="ml-1.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
      {(["th", "en"] as const).map((l) => (
        <button key={l} type="button" onClick={() => set(l)} disabled={pending}
          aria-pressed={lang === l}
          className={`min-h-9 rounded-lg px-2.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            lang === l ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          }`}>
          {l === "th" ? "ไทย" : "EN"}
        </button>
      ))}
    </div>
  );
}
