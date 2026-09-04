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
import { ArrowUp, ImagePlus, Bot, Mic, MicOff, FileText } from "lucide-react";
import { useVoiceInput } from "@/lib/use-voice-input";
import Mascot from "@/components/mascot";

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
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const { listening, supported: voiceSupported, toggle: toggleVoice } = useVoiceInput(setText, setVoiceMsg);

  function go(raw: string) {
    const q = raw.trim().slice(0, MAX_LEN);
    if (!q) { inputRef.current?.focus(); return; }
    router.push(`/dashboard/assistant?q=${encodeURIComponent(q)}`);
  }

  return (
    <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] sm:p-5">
      {/* มาสคอตอยู่ในแถวหัวด้วย flex — ห้ามใช้ absolute เพราะภาพจริง 31 ส.ค. 2569
          มันลอยลงมาทับปุ่มส่งของช่องพิมพ์ · โชว์เฉพาะจอกว้างที่มีที่ว่างจริง */}
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <Bot className="h-3.5 w-3.5 text-emerald-600" />
          สั่งงานบัญชีได้เลย {assistantName ? `— ${assistantName} รออยู่` : "— พิมพ์เป็นภาษาคน"}
        </p>
        <Mascot size={44} className="hidden shrink-0 md:block" />
      </div>

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
            onClick={() => { setVoiceMsg(null); toggleVoice(text); }}
            aria-label={listening ? "หยุดฟัง" : "พูดสั่งงาน"} aria-pressed={listening}
            title={listening ? "หยุดฟัง" : "พูดสั่งงาน — พูดจบแล้วหยุดเอง ตรวจข้อความก่อนกดส่งเหมือนพิมพ์เอง"}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg transition-colors ${
              listening ? "animate-pulse bg-red-50 text-red-600" : "text-neutral-400 hover:bg-neutral-100 hover:text-emerald-600"
            }`}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
        <button
          type="submit"
          aria-label="ส่งคำสั่ง"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
      {/* สถานะเสียงต้องเห็นชัดโดยไม่ต้องจ้องปุ่มเล็ก ๆ — บรรทัดเดียว หายเองเมื่อจบ */}
      {(listening || voiceMsg) && (
        <p className={`mt-2 inline-flex items-center gap-1.5 text-xs ${listening ? "font-medium text-red-600" : "text-amber-700"}`}>
          {listening && <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-red-500" />}
          {listening ? "กำลังฟัง — พูดจบแล้วหยุดเอง แล้วค่อยกดส่ง" : voiceMsg}
        </p>
      )}

      {/* ⚠️ งานหลักต้องอยู่จอแรก (แก้ 5 ก.ย. 2569 — วัดจริงบนมือถือ 390px)
          เดิมจอแรกของแดชบอร์ดมีแต่ช่องแชทกับ "ตัวอย่างคำสั่ง" 3 อันเรียงลงมาแนวตั้ง
          กินครึ่งจอ แล้วต้องเลื่อนถึงจะเจอตัวเลข ส่วนงานที่คนเปิดแอปมาทำจริง
          (ออกบิล/บันทึกรายจ่าย) ถูกซ่อนหลังปุ่ม + ลอยซึ่งไม่มีอะไรบอกว่ากดแล้วได้อะไร
          ตอนนี้: ปุ่มงานจริง 2 ปุ่มมาก่อน · ตัวอย่างคำสั่งย้ายไปแถวเลื่อนแนวนอนบรรทัดเดียว */}
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <Link href="/dashboard/sales/new?type=invoice"
          className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-700">
          <FileText className="h-4 w-4" />ออกบิล/ใบเสร็จ
        </Link>
        <Link href="/dashboard/expenses/new"
          className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50">
          <ImagePlus className="h-4 w-4" />ถ่ายรูปบิล
        </Link>
      </div>

      {/* แถวเดียวเลื่อนแนวนอน — ตัวอย่างคำสั่งเป็นของ "ลองดู" ไม่ใช่งานประจำวัน
          จึงไม่ควรกินพื้นที่แนวตั้งเท่างานจริง */}
      <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="flex shrink-0 items-center pr-0.5 text-[11px] text-neutral-400">ลองสั่ง:</span>
        {EXAMPLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => go(s)}
            className="inline-flex min-h-[36px] shrink-0 items-center whitespace-nowrap rounded-full border border-neutral-200 bg-white px-3 text-xs text-neutral-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-700"
          >
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}
