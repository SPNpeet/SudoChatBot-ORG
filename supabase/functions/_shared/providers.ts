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

/** โมเดลเริ่มต้นต่อค่าย — ใช้เมื่อ fallback ไปค่ายอื่นที่ไม่ใช่ค่ายใน routing */
export const DEFAULT_CHAT_MODEL: Record<ChatProvider, string> = {
  anthropic: "claude-haiku-4-5-20251001", google: "gemini-2.5-flash", openai: "gpt-4o-mini",
  deepseek: "deepseek-chat", qwen: "qwen-plus", zhipu: "glm-4.6", moonshot: "kimi-k2-0905-preview",
  mistral: "mistral-small-latest",
};

interface SettingRow { purpose: string; tier: string; provider: ChatProvider; model: string; enabled: boolean }
interface KeyRow { provider: string; test_status: string | null }
const cache: { at: number; settings: SettingRow[] | null; keyRows: KeyRow[] | null; keys: Record<string, string | null> } =
  { at: 0, settings: null, keyRows: null, keys: {} };

async function loadSettings(): Promise<SettingRow[]> {
  if (cache.settings && Date.now() - cache.at < 60_000) return cache.settings;
  const { data, error } = await sb().from("ai_settings").select("*").eq("enabled", true);
  if (error) console.error("ai_settings load", error.message);
  cache.settings = (data ?? []) as SettingRow[];
  cache.at = Date.now();
  cache.keyRows = null;
  cache.keys = {};
  return cache.settings;
}

async function loadKeyRows(): Promise<KeyRow[]> {
  if (cache.keyRows) return cache.keyRows;
  const { data, error } = await sb().from("ai_provider_keys").select("provider,test_status");
  if (error) console.error("ai_provider_keys load", error.message);
  cache.keyRows = (data ?? []) as KeyRow[];
  return cache.keyRows;
}

async function keyFor(provider: string): Promise<string | null> {
  if (provider in cache.keys) return cache.keys[provider];
  const { data, error } = await sb().rpc("get_ai_key", { p_provider: provider });
  if (error) console.error("get_ai_key", error.message);
  cache.keys[provider] = (data as string | null) ?? null;
  return cache.keys[provider];
}

/**
 * ลำดับค่ายที่จะลองใช้: ค่ายใน routing ก่อน (ถ้า key ไม่ถูกทดสอบว่าเสีย)
 * -> ค่ายที่ทดสอบผ่าน -> ค่ายที่ยังไม่ทดสอบ -> ค่ายที่ทดสอบไม่ผ่าน (ดีกว่าไม่มีเลย)
 * กันเคสจริง: admin ใส่ key ค่ายหนึ่งแต่ routing ยังชี้อีกค่าย -> บอทต้องไม่เงียบ
 */
async function candidateProviders(routed: ChatProvider | null): Promise<string[]> {
  const rows = await loadKeyRows();
  const rank = (p: string) => {
    const r = rows.find((x) => x.provider === p);
    if (!r) return 99;
    if (p === routed && r.test_status !== "failed") return 0;
    if (r.test_status === "ok") return 1;
    if (r.test_status === null) return 2;
    return 3; // failed
  };
  return rows.map((r) => r.provider).sort((a, b) => rank(a) - rank(b));
}

export async function resolveChatConfig(tier: string): Promise<ChatConfig> {
  // คีย์เฉพาะงาน 'chat' (แอดมินแยกคีย์บอทลูกค้าออกจากผู้จัดการร้าน AI) — ตั้งไว้ = ใช้ก่อนเสมอ
  try {
    const { data: pk } = await sb().rpc("get_purpose_ai_key", { p_purpose: "chat" });
    const pko = pk as { provider?: string; model?: string | null; key?: string } | null;
    if (pko?.key && pko.provider) {
      return {
        provider: pko.provider as ChatProvider,
        model: pko.model ?? DEFAULT_CHAT_MODEL[pko.provider as ChatProvider] ?? "gpt-4o-mini",
        apiKey: pko.key,
      };
    }
  } catch (e) { console.error("purpose key lookup", (e as Error).message); }

  const rows = await loadSettings();
  const row = rows.find((r) => r.purpose === "chat" && r.tier === tier)
    ?? rows.find((r) => r.purpose === "chat" && r.tier === "standard");
  const routed = row?.provider ?? null;

  for (const p of await candidateProviders(routed)) {
    const k = await keyFor(p);
    if (!k) continue;
    const model = p === routed && row ? row.model : DEFAULT_CHAT_MODEL[p as ChatProvider] ?? "gpt-4o-mini";
    return { provider: p as ChatProvider, model, apiKey: k };
  }

  // ไม่มี key ใน Vault เลย -> ลอง env ของค่ายใน routing แล้วค่อย Anthropic env
  const envMap: Record<string, string | undefined> = {
    anthropic: Deno.env.get("ANTHROPIC_API_KEY"),
    google: Deno.env.get("GEMINI_API_KEY"),
    openai: Deno.env.get("OPENAI_API_KEY"),
  };
  if (routed && row && envMap[routed]) return { provider: routed, model: row.model, apiKey: envMap[routed]! };
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
  const routed = row && (row.provider === "google" || row.provider === "openai") ? row.provider : null;
  // ลองค่ายใน routing ก่อน แล้ว fallback ไปอีกค่าย (embedding รองรับแค่ google/openai)
  const order: ("google" | "openai")[] = routed === "openai" ? ["openai", "google"] : ["google", "openai"];
  const keyRows = await loadKeyRows();
  for (const p of order) {
    const kr = keyRows.find((x) => x.provider === p);
    if (kr?.test_status === "failed" && p !== routed) continue;
    const k = await keyFor(p);
    if (k) {
      const model = p === routed && row ? row.model : (p === "google" ? "gemini-embedding-001" : "text-embedding-3-small");
      return { provider: p, model, apiKey: k };
    }
  }
  const g = Deno.env.get("GEMINI_API_KEY");
  if (g) return { provider: "google", model: "gemini-embedding-001", apiKey: g };
  const o = Deno.env.get("OPENAI_API_KEY");
  if (o) return { provider: "openai", model: "text-embedding-3-small", apiKey: o };
  throw new Error("ยังไม่ได้ตั้งค่า embedding: เข้า Dashboard > Admin");
}
