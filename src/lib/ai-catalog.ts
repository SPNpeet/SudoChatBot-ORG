// ==== แคตตาล็อกค่าย/โมเดล AI ที่ Admin เลือกได้ ====
export type Provider = "anthropic" | "google" | "openai" | "deepseek" | "qwen" | "zhipu" | "moonshot" | "mistral";

export const PROVIDERS: { id: Provider; label: string; keyHint: string; keyUrl: string }[] = [
  { id: "anthropic", label: "Anthropic (Claude)", keyHint: "ขึ้นต้น sk-ant-...", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "google", label: "Google (Gemini)", keyHint: "จาก AI Studio", keyUrl: "https://aistudio.google.com/app/apikey" },
  { id: "openai", label: "OpenAI (GPT)", keyHint: "ขึ้นต้น sk-...", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "deepseek", label: "DeepSeek", keyHint: "จาก platform.deepseek.com", keyUrl: "https://platform.deepseek.com/api_keys" },
  { id: "qwen", label: "Alibaba (Qwen)", keyHint: "DashScope International", keyUrl: "https://bailian.console.alibabacloud.com/?apiKey=1" },
  { id: "zhipu", label: "Zhipu (GLM)", keyHint: "จาก z.ai", keyUrl: "https://z.ai/manage-apikey/apikey-list" },
  { id: "moonshot", label: "Moonshot (Kimi)", keyHint: "ขึ้นต้น sk-...", keyUrl: "https://platform.moonshot.ai/console/api-keys" },
  { id: "mistral", label: "Mistral (OCR + Chat)", keyHint: "จาก console.mistral.ai", keyUrl: "https://console.mistral.ai/api-keys" },
];

/** ค่ายที่ใช้ OpenAI-compatible API — เรียกผ่าน chat/completions ด้วย base URL ของค่ายนั้น */
export const OPENAI_COMPAT_BASE: Partial<Record<Provider, string>> = {
  deepseek: "https://api.deepseek.com/v1",
  qwen: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  zhipu: "https://api.z.ai/api/paas/v4",
  moonshot: "https://api.moonshot.ai/v1",
  mistral: "https://api.mistral.ai/v1",
};

export const CHAT_MODELS: Record<Provider, { id: string; label: string; note?: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", note: "ฉลาด ปิดการขายเก่ง ~0.6฿/ข้อความ" },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8", note: "ดีที่สุด งานซับซ้อน (แพง)" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", note: "เร็ว ไทยดี tool แม่น ~0.2฿ (แนะนำ)" },
  ],
  google: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", note: "ฉลาดสุดของ Google" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", note: "เร็ว คุ้ม ~0.07฿ (แนะนำ)" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", note: "ถูกสุดของ Google" },
  ],
  openai: [
    { id: "gpt-5", label: "GPT-5", note: "เรือธง" },
    { id: "gpt-5-mini", label: "GPT-5 mini", note: "คุ้มค่า (แนะนำ)" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o mini", note: "ถูก เร็ว ~0.05฿" },
  ],
  deepseek: [
    { id: "deepseek-chat", label: "DeepSeek Chat (V3.2)", note: "ถูกมาก ~0.05฿ ฉลาดเกินราคา (แนะนำ)" },
    { id: "deepseek-reasoner", label: "DeepSeek Reasoner", note: "คิดลึก ช้ากว่า ไม่เหมาะแชทเร็ว" },
  ],
  qwen: [
    { id: "qwen-max", label: "Qwen Max", note: "เรือธง หลายภาษาแข็ง" },
    { id: "qwen-plus", label: "Qwen Plus", note: "สมดุลราคา/คุณภาพ ~0.07฿ (แนะนำ)" },
    { id: "qwen-flash", label: "Qwen Flash", note: "เร็ว ถูกสุดของ Qwen" },
  ],
  zhipu: [
    { id: "glm-4.6", label: "GLM-4.6", note: "ตัวหลัก tool ใช้ได้ดี ~0.1฿" },
    { id: "glm-4.5-air", label: "GLM-4.5 Air", note: "เบา ถูกกว่า" },
  ],
  moonshot: [
    { id: "kimi-k2-0905-preview", label: "Kimi K2", note: "โมเดลใหญ่ agentic ~0.1฿" },
    { id: "kimi-latest", label: "Kimi Latest", note: "ตัวล่าสุดอัตโนมัติ" },
  ],
  mistral: [
    { id: "mistral-small-latest", label: "Mistral Small", note: "ถูก เร็ว — คู่กับ OCR นำเข้าสินค้า (แนะนำ)" },
    { id: "mistral-medium-latest", label: "Mistral Medium", note: "ฉลาดขึ้น งานซับซ้อน" },
  ],
};

export const EMBED_MODELS: Record<string, { id: string; label: string }[]> = {
  google: [{ id: "gemini-embedding-001", label: "Gemini Embedding (แนะนำ)" }],
  openai: [
    { id: "text-embedding-3-small", label: "text-embedding-3-small" },
    { id: "text-embedding-3-large", label: "text-embedding-3-large" },
  ],
};

/** โมเดลแนะนำต่อค่าย เฉพาะงานอ่านเอกสาร/บิล (OCR) — ต่างจาก DEFAULT_CHAT_MODEL เพราะ OCR ต้องการโมเดลที่อ่านภาพ/เอกสารได้ดีที่สุด */
export const OCR_DEFAULT_MODEL: Record<string, string> = {
  mistral: "mistral-ocr-latest", google: "gemini-2.5-flash", anthropic: "claude-haiku-4-5-20251001", openai: "gpt-4o-mini",
};

export function providerLabel(p: string) { return PROVIDERS.find((x) => x.id === p)?.label ?? p; }

// ประมาณต้นทุน USD ต่อการเรียก AI (in, out) USD/1M tokens — mirror ของ _shared/ai.ts ฝั่ง Deno
// ใช้ให้ owner-facing AI (ผู้จัดการร้าน/ads/playground) log ต้นทุนจริง เพื่อให้ circuit breaker + แดชบอร์ดเห็นครบ
const PRICE_TABLE: [string, [number, number]][] = [
  ["claude-haiku", [1, 5]], ["claude-sonnet", [3, 15]], ["claude-opus", [15, 75]], ["claude-fable", [25, 100]],
  ["gpt-5-mini", [0.5, 2]], ["gpt-5-nano", [0.1, 0.4]], ["gpt-5", [2.5, 10]], ["gpt-4o-mini", [0.15, 0.6]], ["gpt-4o", [2.5, 10]],
  ["gemini-2.5-flash-lite", [0.1, 0.4]], ["gemini-2.5-flash", [0.3, 2.5]], ["gemini-2.5-pro", [1.25, 10]], ["gemini", [0.3, 2.5]],
  ["deepseek-reasoner", [0.55, 2.19]], ["deepseek", [0.27, 1.1]],
  ["qwen-max", [1.6, 6.4]], ["qwen-plus", [0.4, 1.2]], ["qwen-flash", [0.05, 0.4]], ["qwen", [0.4, 1.2]],
  ["glm-4.5-air", [0.2, 1.1]], ["glm", [0.6, 2.2]],
  ["kimi", [0.6, 2.5]],
  ["mistral-small", [0.1, 0.3]], ["mistral", [0.4, 2]],
];

/** ประมาณต้นทุน USD — model รับได้ทั้ง "provider/model" หรือ "model" ล้วน */
/** ต้นทุนประมาณการต่อการอ่านไฟล์ 1 ครั้ง (OCR/vision) — จงใจเผื่อสูงเล็กน้อย
 *  ทำไมต้องมี: เดิมทางอ่านไฟล์ทั้งสองบันทึก cost_usd: 0 ตายตัว ทำให้เพดานค่า AI/วัน
 *  (platform_ai_ok เทียบผลรวม cost_usd) มองไม่เห็นการใช้ทางนี้เลย = เพดานปลอม
 *  ทางอ่านไฟล์ไม่รู้ token จริง (หลายค่าย ฟอร์แมตตอบต่างกัน) จึงใช้ค่าคงที่
 *  ประมาณเกินปลอดภัยกว่าประมาณขาด เพราะนี่คือเกราะกันเงินรั่ว ไม่ใช่ใบแจ้งหนี้ */
export const OCR_EST_COST_USD = 0.02;

/**
 * ต้นทุน "จริง" โดยประมาณต่อการอ่านไฟล์ 1 ใบ แยกตามค่าย (USD)
 *
 * ⚠️ ตัวเลขชุดนี้มีไว้ให้ **เพดานเงินต่อวันวัดของจริง** ไม่ใช่ไว้ตั้งราคาขาย
 * สองงานนี้ต้องการเลขคนละแบบ และเดิมใช้ค่าเดียวกัน ($0.02) ทำงานทั้งสองอย่าง
 * ซึ่งทำอย่างหนึ่งผิด:
 *   · ตั้งราคา  -> ประมาณเกินไว้ = ปลอดภัย (ยังคง OCR_EST_COST_USD ไว้ให้งานนี้)
 *   · เพดาน/kill switch -> ประมาณเกิน = **ตัดระบบ AI ของทุกกิจการเร็วกว่าที่ควร**
 *     เพดาน $5/วัน กับค่า $0.02 จะดับที่ ~250 ครั้ง/วัน ทั้งที่เงินจริงซื้อได้ ~1,100 ครั้ง
 *     ลูกค้าที่จ่ายเงินจะโดนตัดกลางคันโดยที่เรายังไม่ได้ใช้เงินถึงเพดานเลย
 *
 * ที่มาของตัวเลข (ตรวจ 5 ส.ค. 2569):
 *   mistral   = OCR $4/1,000 หน้า + จัดรูปด้วย mistral-small อีกนิด  ~$0.0045
 *   google    = gemini flash อ่านภาพ + ตอบ JSON                        ~$0.004
 *   openai    = โมเดล vision ราคาสูงกว่า                                ~$0.016
 *   anthropic = แพงสุดในชุด                                            ~$0.022
 * ค่ายที่ไม่รู้จัก -> ใช้ค่าเผื่อสูง (OCR_EST_COST_USD) เพราะเดาขาดอันตรายกว่าเดาเกิน
 */
export const OCR_COST_BY_PROVIDER: Record<string, number> = {
  mistral: 0.005,
  google: 0.004,
  openai: 0.016,
  anthropic: 0.022,
};

/** ชื่อเอนจินในหน้านำเข้าสินค้าใช้ชื่อโมเดล ไม่ใช่ชื่อค่าย — แปลงให้ตรงกันก่อนเทียบราคา
 *  (ถ้าไม่แปลง จะตกไปใช้ค่าเผื่อสูงทุกครั้ง = เพดานยังดับเร็วเกินจริงอยู่ดี) */
const OCR_ENGINE_ALIAS: Record<string, string> = {
  "mistral-ocr": "mistral", gemini: "google", claude: "anthropic", gpt: "openai",
};

/** ป้ายเอนจินมาได้ 2 แบบ: "ocr:mistral" / "fallback-key:google" หรือชื่อสั้น "gemini" */
export function ocrCostUsd(engineLabel: string): number {
  const raw = (engineLabel.includes(":") ? engineLabel.split(":").pop()! : engineLabel).trim();
  const provider = OCR_ENGINE_ALIAS[raw] ?? raw;
  return OCR_COST_BY_PROVIDER[provider] ?? OCR_EST_COST_USD;
}

export function estimateAiCost(model: string, inTok: number, outTok: number): number {
  const m = model.includes("/") ? model.split("/").pop()! : model;
  let price: [number, number] = [3, 15];
  for (const [p, v] of PRICE_TABLE) if (m.startsWith(p)) { price = v; break; }
  return +(((inTok || 0) * price[0] + (outTok || 0) * price[1]) / 1_000_000).toFixed(6);
}
