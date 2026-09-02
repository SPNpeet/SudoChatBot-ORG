"use client";
// ============================================================
//  ช่องสั่งงานบนหัวหน้าแรก — เป็น "พระเอก" แทนป้ายแคปซูลเดิม
//
//  ทำไมเปลี่ยน: ป้าย "ระบบบัญชี + ผู้ช่วย AI — เริ่มฟรี ไม่ต้องใช้บัตร" เป็นองค์ประกอบ
//  ที่หน้าเว็บซึ่ง AI สร้างมีเหมือนกันแทบทุกอัน และมัน "บรรยาย" สินค้าแทนที่จะ "พิสูจน์"
//  จุดต่างจริงของระบบนี้คือพิมพ์ประโยคเดียวแล้วได้ทั้งเอกสารและบัญชี
//  จึงเอาสิ่งนั้นมาให้ลองเลยตั้งแต่วินาทีแรกที่เห็นหน้า
//
//  เข้าถึงทุกวัย เพราะหน้าตาคือช่องพิมพ์ธรรมดาที่ทุกคนใช้เป็นอยู่แล้ว
//  ไม่ต้องเรียนรู้อะไรใหม่ และไม่ได้บังคับให้พิมพ์ — ปุ่ม "เริ่มใช้ฟรี" ยังอยู่ครบ
// ============================================================
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Mic, MicOff } from "lucide-react";
import { useVoiceInput } from "@/lib/use-voice-input";
import type { HomeCopy } from "@/lib/i18n";

// ตัวอย่างคำสั่งจริงที่ระบบทำได้ — วนให้เห็นขอบเขตงานโดยไม่ต้องเขียนบรรยายยาว
const TH_SAMPLES = [
  "ออกใบแจ้งหนี้ค่าออกแบบเว็บ 25,000 ให้บริษัท สยามเทรด บวก VAT",
  "ถ่ายรูปบิลค่าไฟใบนี้ ลงบัญชีให้หน่อย",
  "เดือนนี้ต้องยื่นภาษีอะไรบ้าง",
  "ใครค้างเงินเรานานเกิน 30 วัน",
];

/** ส่งข้อความไปให้กล่องทดลองด้านล่างแล้วเลื่อนไปหา */
export const HERO_ASK_EVENT = "sudo:hero-ask";

// ⚠️ ฉบับอังกฤษส่งมาทาง prop ไม่ใช่ให้ component อ่าน cookie เอง
// เพราะ component นี้เป็น "use client" อ่าน cookies() ของ next/headers ไม่ได้
// และถ้าอ่าน document.cookie ฝั่ง client จะเห็นภาษาไม่ตรงกับที่เซิร์ฟเวอร์ render มา = ข้อความกระพริบ
export default function HeroCommand({ cmd }: { cmd?: HomeCopy["heroCmd"] }) {
  const SAMPLES = cmd?.examples ?? TH_SAMPLES;
  const [text, setText] = useState("");
  const [ph, setPh] = useState("");
  const [focused, setFocused] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  // พูดสั่งได้ตั้งแต่ยังไม่สมัคร — จุดที่คนตัดสินใจว่าจะใช้หรือไม่ใช้อยู่ตรงนี้
  // เสียงเติมลงช่องเท่านั้น ยังต้องกด "ลองสั่ง" เอง (เห็นข้อความก่อนส่งเสมอ)
  const { listening, supported: voiceOk, toggle: toggleVoice } = useVoiceInput(setText, setVoiceMsg);
  const inputRef = useRef<HTMLInputElement>(null);

  // พิมพ์ตัวอย่างวนไปเรื่อย ๆ จนกว่าผู้ใช้จะเริ่มพิมพ์เอง
  useEffect(() => {
    if (focused || text) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPh(SAMPLES[0]);
      return;
    }
    let i = 0, j = 0, del = false, timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const s = SAMPLES[i];
      j += del ? -2 : 1;
      setPh(s.slice(0, Math.max(0, j)));
      if (!del && j >= s.length) { del = true; timer = setTimeout(tick, 2200); return; }
      if (del && j <= 0) { del = false; i = (i + 1) % SAMPLES.length; }
      timer = setTimeout(tick, del ? 18 : 42);
    };
    timer = setTimeout(tick, 700);
    return () => clearTimeout(timer);
  }, [focused, text, SAMPLES]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim() || ph.trim();
    if (!q) { inputRef.current?.focus(); return; }
    // ส่งต่อให้กล่องทดลอง (ฟรี 3 ครั้ง ไม่ต้องสมัคร) แล้วเลื่อนไปให้เห็นคำตอบ
    //
    // ⚠️ ต้อง block: "start" ไม่ใช่ "center" — เจ้าของกดแล้ว "เด้งไปตรงการ์ด 3 ขั้นตอนตลอด"
    // เพราะ center เอากล่องทดลองไว้กลางจอ ครึ่งล่างของจอเลยเป็นเนื้อหาส่วนถัดไป
    // สายตาคนจับสิ่งที่อยู่กลางล่างก่อน = รู้สึกว่าถูกพาไปผิดที่ ทั้งที่กล่องอยู่ตรงนั้น
    // ให้กล่องขึ้นชิดบน (#try มี scroll-mt-24 เว้นหายใจให้แล้ว) คำตอบ AI จะเด่นสุดในจอ
    window.dispatchEvent(new CustomEvent(HERO_ASK_EVENT, { detail: q }));
    document.getElementById("try")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setText("");
  }

  return (
    <form onSubmit={submit} className="mt-7">
      <div className="flex items-center gap-2 rounded-2xl border-[1.5px] border-neutral-300 bg-white p-1.5 pl-4 shadow-[0_1px_2px_rgba(21,24,15,.05),0_10px_28px_-14px_rgba(21,24,15,.25)] transition-colors focus-within:border-[#0B6B4A]">
        <span aria-hidden className="h-5 w-[2px] shrink-0 animate-pulse bg-[#12A06B]" />
        <input
          ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          maxLength={150} aria-label={cmd?.label ?? "พิมพ์สั่งงานบัญชี"}
          placeholder={listening ? "กำลังฟัง... พูดได้เลย" : focused ? (cmd?.placeholder ?? "พิมพ์สั่งได้เลย เช่น ออกใบแจ้งหนี้ 5,000 ให้คุณสมชาย") : ph || " "}
          className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        {voiceOk && (
          <button type="button" onClick={() => { setVoiceMsg(null); toggleVoice(text); }}
            aria-label={listening ? "หยุดฟัง" : "พูดสั่งงาน"} aria-pressed={listening}
            title={listening ? "หยุดฟัง" : "พูดสั่งงาน — พูดจบแล้วหยุดเอง"}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${
              listening ? "animate-pulse bg-red-50 text-red-600" : "text-neutral-500 hover:bg-neutral-100 hover:text-[#0B6B4A]"}`}>
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        )}
        <button type="submit"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0B6B4A] px-4 py-3 text-sm font-semibold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.97] sm:px-5">
          {cmd?.send ?? "ลองสั่ง"} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2.5 text-[12px] text-neutral-500">
        {listening
          ? <span className="inline-flex items-center gap-1.5 font-medium text-red-600"><span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-red-500" />กำลังฟัง — พูดจบแล้วหยุดเอง แล้วค่อยกด “{cmd?.send ?? "ลองสั่ง"}”</span>
          : voiceMsg ? <span className="text-amber-700">{voiceMsg}</span>
          : (cmd?.note ?? "ลองฟรี 3 ครั้ง ไม่ต้องสมัคร ไม่ต้องใช้บัตร")}
      </p>
    </form>
  );
}
