"use client";
import { useEffect, useRef, useState } from "react";

/**
 * พูดสั่งงาน (Web Speech API) — ใช้ร่วมกันระหว่างช่องสั่งงานหน้าแรกและหน้าแชท
 * เสียงแค่ "พิมพ์แทนมือ" ผ่าน onTranscript เท่านั้น ไม่ auto-submit เด็ดขาด
 * ต้องผ่านด่านตรวจ/ยืนยันเดิมเหมือนพิมพ์เอง ไม่เปิดทางลัดให้เสียงสั่งเงินโดยไม่มีคนเห็นข้อความก่อนส่ง
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

  function toggle() {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) { recognitionRef.current?.stop(); return; }
    const rec = new Ctor();
    rec.lang = "th-TH";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ");
      onTranscriptRef.current(text);
    };
    rec.onerror = () => {
      setListening(false);
      onErrorRef.current?.("ฟังเสียงไม่สำเร็จ — ตรวจสิทธิ์การใช้ไมโครโฟนของเบราว์เซอร์ แล้วลองใหม่");
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  return { listening, supported, toggle };
}
