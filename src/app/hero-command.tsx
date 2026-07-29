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
import { ArrowRight } from "lucide-react";

// ตัวอย่างคำสั่งจริงที่ระบบทำได้ — วนให้เห็นขอบเขตงานโดยไม่ต้องเขียนบรรยายยาว
const SAMPLES = [
  "ออกใบแจ้งหนี้ค่าออกแบบเว็บ 25,000 ให้บริษัท สยามเทรด บวก VAT",
  "ถ่ายรูปบิลค่าไฟใบนี้ ลงบัญชีให้หน่อย",
  "เดือนนี้ต้องยื่นภาษีอะไรบ้าง",
  "ใครค้างเงินเรานานเกิน 30 วัน",
];

/** ส่งข้อความไปให้กล่องทดลองด้านล่างแล้วเลื่อนไปหา */
export const HERO_ASK_EVENT = "sudo:hero-ask";

export default function HeroCommand() {
  const [text, setText] = useState("");
  const [ph, setPh] = useState("");
  const [focused, setFocused] = useState(false);
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
  }, [focused, text]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim() || ph.trim();
    if (!q) { inputRef.current?.focus(); return; }
    // ส่งต่อให้กล่องทดลอง (ฟรี 3 ครั้ง ไม่ต้องสมัคร) แล้วเลื่อนไปให้เห็นคำตอบ
    window.dispatchEvent(new CustomEvent(HERO_ASK_EVENT, { detail: q }));
    document.getElementById("try")?.scrollIntoView({ behavior: "smooth", block: "center" });
    setText("");
  }

  return (
    <form onSubmit={submit} className="mt-7">
      <div className="flex items-center gap-2 rounded-2xl border-[1.5px] border-neutral-300 bg-white p-1.5 pl-4 shadow-[0_1px_2px_rgba(21,24,15,.05),0_10px_28px_-14px_rgba(21,24,15,.25)] transition-colors focus-within:border-[#0B6B4A]">
        <span aria-hidden className="h-5 w-[2px] shrink-0 animate-pulse bg-[#12A06B]" />
        <input
          ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          maxLength={150} aria-label="พิมพ์สั่งงานบัญชี"
          placeholder={focused ? "พิมพ์สั่งได้เลย เช่น ออกใบแจ้งหนี้ 5,000 ให้คุณสมชาย" : ph || " "}
          className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        <button type="submit"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0B6B4A] px-4 py-3 text-sm font-semibold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.97] sm:px-5">
          ลองสั่ง <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2.5 text-[12px] text-neutral-500">
        ลองฟรี 3 ครั้ง ไม่ต้องสมัคร ไม่ต้องใช้บัตร
      </p>
    </form>
  );
}
