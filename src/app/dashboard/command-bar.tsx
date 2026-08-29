"use client";
// ============================================================
//  ช่องสั่งงาน AI บนหน้าแรกของแดชบอร์ด
//
//  ⚠️ ทำไมต้องมีทั้งที่หน้า /dashboard/assistant มีอยู่แล้ว
//  จุดขายของระบบคือ "พิมพ์สั่งประโยคเดียวแล้วบัญชีเสร็จ" แต่คนที่ล็อกอินเข้ามา
//  เจอหน้าแรกเป็นตัวเลขกับตาราง ต้องรู้เองว่าให้ไปกดเมนู "แชทกับบัญชี AI" ก่อน
//  = ฟีเจอร์ที่แพงที่สุดของระบบถูกซ่อนอยู่หลังการกดหนึ่งครั้งที่ไม่มีอะไรบอกให้กด
//  หน้าแรกเว็บ (ยังไม่ล็อกอิน) ให้พิมพ์ได้ทันทีตั้งแต่วินาทีแรกแล้ว
//  หน้าแรกหลังล็อกอินจึงต้องทำแบบเดียวกัน ไม่งั้นคนจ่ายเงินได้ประสบการณ์แย่กว่าคนยังไม่จ่าย
//
//  ⚠️ ที่นี่ไม่ได้คุยกับ AI เอง — แค่ส่งข้อความต่อไปหน้าผู้ช่วยผ่าน ?q=
//  ตั้งใจให้เป็นแบบนี้ ไม่ใช่ทางลัด: ตรรกะแชท (ประวัติ · ไฟล์แนบ · เพดานโควตา ·
//  ตัวอย่างเอกสาร) อยู่ใน chat.tsx ที่เดียว ถ้าทำกล่องคุยซ้อนอีกอันที่นี่
//  วันหนึ่งจะแก้เพดานโควตาที่หนึ่งแล้วลืมอีกที่ ซึ่งเป็นเรื่องเงินของลูกค้า
// ============================================================
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ImagePlus, Bot, Mic, MicOff } from "lucide-react";
import { useVoiceInput } from "@/lib/use-voice-input";

/** ยาวสุดที่ส่งผ่าน URL ได้อย่างปลอดภัย — ยาวกว่านี้ให้ไปพิมพ์ต่อในหน้าแชท */
const MAX_LEN = 300;

const EXAMPLES = [
  "ออกใบแจ้งหนี้ให้ลูกค้า ABC จำนวน 15,000 บาท",
  "สรุปรายรับรายจ่ายเดือนนี้",
  "บันทึกค่าใช้จ่ายค่าน้ำมัน 800 บาท",
];

export interface ProactiveNudge { text: string; command: string }

export default function CommandBar({ assistantName, proactive }: { assistantName?: string | null; proactive?: ProactiveNudge | null }) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  // พูดสั่งงานได้จากหน้าแรกเลย ไม่ต้องเข้าไปหน้าแชทก่อน — เติมข้อความอย่างเดียว
  // ยังต้องกด "ส่งคำสั่ง" เองเหมือนพิมพ์ ไม่ auto-submit เพราะเป็นคำสั่งเงินของลูกค้า
  const { listening, supported: voiceSupported, toggle: toggleVoice } = useVoiceInput(setText);

  function go(raw: string) {
    const q = raw.trim().slice(0, MAX_LEN);
    if (!q) { inputRef.current?.focus(); return; }
    router.push(`/dashboard/assistant?q=${encodeURIComponent(q)}`);
  }

  return (
    <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] sm:p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        <Bot className="h-3.5 w-3.5 text-emerald-600" />
        สั่งงานบัญชีได้เลย {assistantName ? `— ${assistantName} รออยู่` : "— พิมพ์เป็นภาษาคน"}
      </p>

      {/* AI ทักก่อน — ผลตรวจ 28 ส.ค. 2569: ผู้ช่วยที่ดีไม่รอให้ถาม เห็นงานค้างแล้วชวนทำเลย
          กดแล้วส่งคำสั่งสำเร็จรูปไปหน้าผู้ช่วยทันที ไม่ต้องคิดเองว่าจะพิมพ์ยังไง */}
      {proactive && (
        <button type="button" onClick={() => go(proactive.command)}
          className="mt-2.5 flex w-full items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-left text-[13px] text-emerald-900 transition-colors hover:bg-emerald-100/70">
          <Bot className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span className="min-w-0 flex-1">{proactive.text}</span>
          <span className="shrink-0 text-xs font-semibold text-emerald-700">ให้ช่วยเลย →</span>
        </button>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); go(text); }}
        className="mt-2.5 flex items-center gap-2 rounded-xl border border-neutral-300 bg-white p-1.5 pl-3.5 transition-colors focus-within:border-emerald-500"
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_LEN}
          aria-label="พิมพ์สั่งงานบัญชี"
          placeholder={listening ? "กำลังฟัง... พูดสั่งงานได้เลย" : "พิมพ์สิ่งที่คุณต้องการ..."}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        {/* ปุ่มไอคอนล้วนต้องมีชื่อ ไม่งั้นโปรแกรมอ่านหน้าจอจะอ่านได้แค่คำว่า "ปุ่ม" */}
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={listening ? "หยุดฟัง" : "พูดสั่งงาน"}
            title={listening ? "หยุดฟัง" : "พูดสั่งงาน — พูดแล้วตรวจข้อความก่อนกดส่งเหมือนพิมพ์เอง"}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
              listening ? "animate-pulse bg-red-50 text-red-600" : "text-neutral-400 hover:bg-neutral-100 hover:text-emerald-600"
            }`}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
        <button
          type="submit"
          aria-label="ส่งคำสั่ง"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {EXAMPLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => go(s)}
            className="inline-flex min-h-[44px] items-center rounded-full border border-neutral-200 bg-white px-3.5 text-xs text-neutral-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-700"
          >
            {s}
          </button>
        ))}
        {/* ⚠️ ไม่มีปุ่มไมโครโฟน — ระบบยังพูดสั่งไม่ได้
            ปุ่มที่กดแล้วไม่เกิดอะไรทำให้ผู้ใช้คิดว่าระบบพัง แย่กว่าไม่มีปุ่มนั้น */}
        <Link
          href="/dashboard/assistant"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-neutral-500 transition-colors hover:text-emerald-700"
        >
          <ImagePlus className="h-3.5 w-3.5" />แนบรูปบิล
        </Link>
      </div>
    </section>
  );
}
