"use client";
import { useEffect, useRef, useState } from "react";

/**
 * พูดสั่งงาน (Web Speech API) — ใช้ร่วมกันทุกช่องสั่งงาน (หน้าแรกก่อนสมัคร · แดชบอร์ด · แชท)
 *
 * เสียงแค่ "พิมพ์แทนมือ" ผ่าน onTranscript เท่านั้น ไม่ auto-submit เด็ดขาด
 * ต้องผ่านด่านตรวจ/ยืนยันเดิมเหมือนพิมพ์เอง ไม่เปิดทางลัดให้เสียงสั่งเงินโดยไม่มีคนเห็นข้อความก่อนส่ง
 *
 * ยกระดับ 31 ส.ค. 2569 (เจ้าของ: "สั่งเสียงต้องใช้ง่ายกว่าทุกเจ้า") — สิ่งที่ทำให้ "ง่าย" จริง:
 *  · แตะครั้งเดียว พูด แล้วหยุดเองเมื่อเงียบ — ไม่ต้องแตะซ้ำเพื่อหยุด (continuous=false ทำให้)
 *  · ต่อท้ายข้อความที่พิมพ์ค้างไว้ ไม่ทับทิ้ง — คนสั่งงานเป็นท่อน ๆ "ออกใบแจ้งหนี้" (พัก) "ให้ร้าน A"
 *  · เห็นคำขึ้นสด ๆ ระหว่างพูด (interimResults) ไม่ต้องรอจบประโยคแล้วลุ้นว่าฟังถูกไหม
 *  · error บอกสาเหตุจริง: ไม่ได้ยิน / ไม่ให้สิทธิ์ไมค์ / ไม่มีเน็ต — ไม่ใช่ข้อความเดียวรวมทุกกรณี
 *  · สั่นสั้น ๆ ตอนเริ่ม-จบบนมือถือ (ตาไม่ต้องจ้องปุ่มก็รู้ว่าฟังอยู่)
 */
export function useVoiceInput(onTranscript: (text: string) => void, onError?: (message: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    // Web Speech API เป็น native browser API ไม่ใช่สคริปต์นอกที่โหลดช้า จึงเช็คตอน mount ได้เลย
    // (ต่างจากเคส window.gtag ที่เคยพังเพราะ global มาช้า — ดูบันทึกเก่า)
    setSupported(!!(window.SpeechRecognition ?? window.webkitSpeechRecognition));
  }, []);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* เบราว์เซอร์ที่ไม่มีไม่เป็นไร */ } };

  /** base = ข้อความที่พิมพ์ค้างอยู่ก่อนกดไมค์ — เสียงจะต่อท้าย ไม่ทับ */
  function toggle(base = "") {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) { recognitionRef.current?.stop(); return; }
    const prefix = base.trim() ? base.trimEnd() + " " : "";
    const rec = new Ctor();
    rec.lang = "th-TH";
    rec.interimResults = true;
    rec.continuous = false;           // เงียบแล้วหยุดเอง = ไม่ต้องแตะปุ่มซ้ำ
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ");
      onTranscriptRef.current(prefix + text);
    };
    rec.onerror = (e) => {
      setListening(false);
      const code = (e as { error?: string }).error ?? "";
      if (code === "aborted") return;                       // ผู้ใช้กดหยุดเอง ไม่ใช่ความผิดพลาด
      const msg =
        code === "no-speech" ? "ไม่ได้ยินเสียง — แตะไมค์แล้วพูดได้เลย ไม่ต้องรอ"
        : code === "not-allowed" || code === "service-not-allowed" ? "เบราว์เซอร์ยังไม่อนุญาตให้ใช้ไมโครโฟน — กดอนุญาตที่แถบที่อยู่ด้านบน แล้วแตะไมค์อีกครั้ง"
        : code === "network" ? "แปลงเสียงต้องใช้อินเทอร์เน็ต — เช็คสัญญาณแล้วลองใหม่"
        : code === "audio-capture" ? "ไม่พบไมโครโฟนในเครื่องนี้ — พิมพ์สั่งแทนได้เลย"
        : "ฟังเสียงไม่สำเร็จ — ลองแตะไมค์อีกครั้ง หรือพิมพ์สั่งแทน";
      onErrorRef.current?.(msg);
    };
    rec.onend = () => { setListening(false); buzz(20); };
    recognitionRef.current = rec;
    setListening(true);
    buzz(30);
    rec.start();
  }

  return { listening, supported, toggle };
}
