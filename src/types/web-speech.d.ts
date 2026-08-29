// ประเภทขั้นต่ำของ Web Speech API — TypeScript lib.dom.d.ts ยังไม่มีให้ในตัว
// ใช้เฉพาะฝั่งเบราว์เซอร์ (ดู src/app/dashboard/assistant/chat.tsx) ต้องเช็ค undefined ก่อนใช้เสมอ
//
// ⚠️ อินเทอร์เฟซทั้งหมดต้องอยู่ใน declare global — ไฟล์นี้มี export {} ท้ายไฟล์
// ทำให้กลายเป็น module ประกาศนอก declare global จะเห็นแค่ในไฟล์นี้ ไม่ global จริง

declare global {
  interface SpeechRecognitionResultItem {
    readonly transcript: string;
  }

  interface SpeechRecognitionResult {
    readonly length: number;
    [index: number]: SpeechRecognitionResultItem;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  }

  interface SpeechRecognitionConstructor {
    new (): SpeechRecognition;
  }

  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export {};
