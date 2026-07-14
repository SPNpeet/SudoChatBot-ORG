// ==== แคตตาล็อกค่าย/โมเดล AI ที่ Admin เลือกได้ ====
export type Provider = "anthropic" | "google" | "openai";

export const PROVIDERS: { id: Provider; label: string; keyHint: string; keyUrl: string }[] = [
  { id: "anthropic", label: "Anthropic (Claude)", keyHint: "ขึ้นต้น sk-ant-...", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "google", label: "Google (Gemini)", keyHint: "จาก AI Studio", keyUrl: "https://aistudio.google.com/app/apikey" },
  { id: "openai", label: "OpenAI (GPT)", keyHint: "ขึ้นต้น sk-...", keyUrl: "https://platform.openai.com/api-keys" },
];

export const CHAT_MODELS: Record<Provider, { id: string; label: string; note?: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: "ฉลาด ปิดการขายเก่ง (แนะนำ)" },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8", note: "ดีที่สุด งานซับซ้อน" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", note: "เร็ว ประหยัด" },
  ],
  google: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", note: "ฉลาดสุดของ Google" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", note: "เร็ว คุ้ม (แนะนำ)" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", note: "ถูกสุด" },
  ],
  openai: [
    { id: "gpt-5", label: "GPT-5", note: "เรือธง" },
    { id: "gpt-5-mini", label: "GPT-5 mini", note: "คุ้มค่า (แนะนำ)" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o mini", note: "ถูก เร็ว" },
  ],
};

export const EMBED_MODELS: Record<string, { id: string; label: string }[]> = {
  google: [{ id: "gemini-embedding-001", label: "Gemini Embedding (แนะนำ)" }],
  openai: [
    { id: "text-embedding-3-small", label: "text-embedding-3-small" },
    { id: "text-embedding-3-large", label: "text-embedding-3-large" },
  ],
};

export const TIERS: { id: string; label: string; desc: string }[] = [
  { id: "economy", label: "ประหยัด", desc: "บอทร้านที่ตั้งค่าโมเดล 'ประหยัด'" },
  { id: "standard", label: "มาตรฐาน", desc: "ค่าเริ่มต้นของทุกร้าน" },
  { id: "premium", label: "พรีเมียม", desc: "ร้านที่ต้องการคุณภาพสูงสุด" },
];

export function providerLabel(p: string) { return PROVIDERS.find((x) => x.id === p)?.label ?? p; }
