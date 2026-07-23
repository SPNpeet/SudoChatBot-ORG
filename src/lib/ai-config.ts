// ============================================================
//  เลือกค่าย/โมเดล/key ของ AI ฝั่งเว็บ (ย้ายมาจาก playground เดิม)
//  ใช้กับผู้ช่วยบัญชี AI และงานอ่านเอกสารทั้งหมด
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Provider } from "@/lib/ai-catalog";

export type { Provider };
export interface ChatConfig { provider: Provider; model: string; apiKey: string }

/** โมเดลเริ่มต้นต่อค่าย — ใช้เมื่อ fallback ไปค่ายอื่นที่ไม่ใช่ค่ายใน routing */
export const DEFAULT_CHAT_MODEL: Record<Provider, string> = {
  anthropic: "claude-haiku-4-5-20251001", google: "gemini-2.5-flash", openai: "gpt-4o-mini",
  deepseek: "deepseek-chat", qwen: "qwen-plus", zhipu: "glm-4.6", moonshot: "kimi-k2-0905-preview",
  mistral: "mistral-small-latest",
};

/** คีย์เฉพาะงาน (ai_purpose_keys) — แอดมินตั้งไว้ = ใช้ก่อนคีย์รวมเสมอ · null = ไม่ได้ตั้ง */
export async function resolvePurposeKey(svc: SupabaseClient, purpose: "assistant" | "chat"): Promise<ChatConfig | null> {
  try {
    const { data } = await svc.rpc("get_purpose_ai_key", { p_purpose: purpose });
    const pk = data as { provider?: Provider; model?: string | null; key?: string } | null;
    if (pk?.key && pk.provider) {
      return { provider: pk.provider, model: pk.model ?? DEFAULT_CHAT_MODEL[pk.provider] ?? "gpt-4o-mini", apiKey: pk.key };
    }
  } catch { /* ตารางยังไม่มี/สิทธิ์ไม่ถึง = ข้ามไปใช้คีย์รวม */ }
  return null;
}

/** เลือกค่ายจาก routing กลาง (ai_settings purpose 'chat' = ค่า default ของระบบ) + คีย์ที่ใช้ได้จริง */
export async function resolveDefaultAiConfig(svc: SupabaseClient, tier = "standard"): Promise<ChatConfig> {
  const { data } = await svc.from("ai_settings").select("*").eq("enabled", true);
  const rows = (data ?? []) as { purpose: string; tier: string; provider: Provider; model: string }[];
  const row = rows.find((r) => r.purpose === "chat" && r.tier === tier)
    ?? rows.find((r) => r.purpose === "chat" && r.tier === "standard");
  const routed = row?.provider ?? null;

  // ลำดับ: ค่ายใน routing (ถ้า key ไม่ถูกทดสอบว่าเสีย) -> ทดสอบผ่าน -> ยังไม่ทดสอบ -> ทดสอบไม่ผ่าน
  const { data: keyRows } = await svc.from("ai_provider_keys").select("provider,test_status");
  const rank = (p: string) => {
    const r = (keyRows ?? []).find((x) => x.provider === p);
    if (!r) return 99;
    if (p === routed && r.test_status !== "failed") return 0;
    if (r.test_status === "ok") return 1;
    if (r.test_status === null) return 2;
    return 3;
  };
  const candidates = (keyRows ?? []).map((r) => r.provider as Provider).sort((a, b) => rank(a) - rank(b));
  for (const p of candidates) {
    const { data: key } = await svc.rpc("get_ai_key", { p_provider: p });
    if (!key) continue;
    const model = p === routed && row ? row.model : DEFAULT_CHAT_MODEL[p] ?? "gpt-4o-mini";
    return { provider: p, model, apiKey: key as string };
  }

  if (row) {
    const envMap: Partial<Record<Provider, string | undefined>> = {
      anthropic: process.env.ANTHROPIC_API_KEY, google: process.env.GEMINI_API_KEY, openai: process.env.OPENAI_API_KEY,
    };
    if (envMap[row.provider]) return { provider: row.provider, model: row.model, apiKey: envMap[row.provider]! };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: "anthropic", model: "claude-haiku-4-5-20251001", apiKey: process.env.ANTHROPIC_API_KEY };
  }
  throw new Error("AI_NOT_CONFIGURED");
}
