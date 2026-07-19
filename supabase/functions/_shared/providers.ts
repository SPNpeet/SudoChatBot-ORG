// ==== AI Provider Resolver — อ่านการตั้งค่าจากหน้า Admin (DB+Vault) fallback เป็น env ====
import { sb } from "./supabase.ts";

export type ChatProvider = "anthropic" | "google" | "openai" | "deepseek" | "qwen" | "zhipu" | "moonshot" | "mistral";
export interface ChatConfig { provider: ChatProvider; model: string; apiKey: string }

/** ค่าย OpenAI-compatible — เรียก chat/completions ด้วย base URL ของค่ายนั้น */
export const OPENAI_COMPAT_BASE: Partial<Record<ChatProvider, string>> = {
  deepseek: "https://api.deepseek.com/v1",
  qwen: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  zhipu: "https://api.z.ai/api/paas/v4",
  moonshot: "https://api.moonshot.ai/v1",
  mistral: "https://api.mistral.ai/v1",
};
export interface EmbedConfig { provider: "google" | "openai"; model: string; apiKey: string }

interface SettingRow { purpose: string; tier: string; provider: ChatProvider; model: string; enabled: boolean }
const cache: { at: number; settings: SettingRow[] | null; keys: Record<string, string | null> } = { at: 0, settings: null, keys: {} };

async function loadSettings(): Promise<SettingRow[]> {
  if (cache.settings && Date.now() - cache.at < 60_000) return cache.settings;
  const { data, error } = await sb().from("ai_settings").select("*").eq("enabled", true);
  if (error) console.error("ai_settings load", error.message);
  cache.settings = (data ?? []) as SettingRow[];
  cache.at = Date.now();
  cache.keys = {};
  return cache.settings;
}

async function keyFor(provider: string): Promise<string | null> {
  if (provider in cache.keys) return cache.keys[provider];
  const { data, error } = await sb().rpc("get_ai_key", { p_provider: provider });
  if (error) console.error("get_ai_key", error.message);
  cache.keys[provider] = (data as string | null) ?? null;
  return cache.keys[provider];
}

export async function resolveChatConfig(tier: string): Promise<ChatConfig> {
  const rows = await loadSettings();
  const row = rows.find((r) => r.purpose === "chat" && r.tier === tier)
    ?? rows.find((r) => r.purpose === "chat" && r.tier === "standard");
  if (row) {
    const k = await keyFor(row.provider);
    if (k) return { provider: row.provider, model: row.model, apiKey: k };
    // แถวถูกตั้งไว้แต่ยังไม่มี key ของค่ายนั้น -> ลอง env ของค่ายเดียวกัน
    const envMap: Record<string, string | undefined> = {
      anthropic: Deno.env.get("ANTHROPIC_API_KEY"),
      google: Deno.env.get("GEMINI_API_KEY"),
      openai: Deno.env.get("OPENAI_API_KEY"),
    };
    if (envMap[row.provider]) return { provider: row.provider, model: row.model, apiKey: envMap[row.provider]! };
  }
  // fallback สุดท้าย: Anthropic จาก env
  const envKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (envKey) {
    const m: Record<string, string> = {
      economy: Deno.env.get("MODEL_ECONOMY") ?? "claude-haiku-4-5-20251001",
      standard: Deno.env.get("MODEL_STANDARD") ?? "claude-sonnet-5",
      premium: Deno.env.get("MODEL_PREMIUM") ?? "claude-sonnet-5",
    };
    return { provider: "anthropic", model: m[tier] ?? m.standard, apiKey: envKey };
  }
  throw new Error("ยังไม่ได้ตั้งค่า AI: เข้า Dashboard > Admin เพื่อใส่ API key และเลือกโมเดล");
}

export async function resolveEmbedConfig(): Promise<EmbedConfig> {
  const rows = await loadSettings();
  const row = rows.find((r) => r.purpose === "embedding");
  if (row && (row.provider === "google" || row.provider === "openai")) {
    const k = await keyFor(row.provider);
    if (k) return { provider: row.provider, model: row.model, apiKey: k };
  }
  const g = Deno.env.get("GEMINI_API_KEY");
  if (g) return { provider: "google", model: "gemini-embedding-001", apiKey: g };
  const o = Deno.env.get("OPENAI_API_KEY");
  if (o) return { provider: "openai", model: "text-embedding-3-small", apiKey: o };
  throw new Error("ยังไม่ได้ตั้งค่า embedding: เข้า Dashboard > Admin");
}
