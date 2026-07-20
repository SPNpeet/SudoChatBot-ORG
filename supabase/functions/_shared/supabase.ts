import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

let _sb: SupabaseClient | null = null;

/** Service-role client (bypasses RLS) — ใช้เฉพาะฝั่ง server เท่านั้น */
export function sb(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
  }
  return _sb;
}

// ==== pgmq wrappers (ผ่าน public RPC ที่ล็อกไว้ให้ service_role) ====
export async function qSend(queue: string, msg: unknown): Promise<number | null> {
  const { data, error } = await sb().rpc("queue_send", { p_queue: queue, p_msg: msg });
  if (error) { console.error(`qSend(${queue})`, error.message); return null; }
  return data as number;
}

export interface QueueRow<T> { msg_id: number; read_ct: number; message: T }

export async function qRead<T>(queue: string, vt = 60, qty = 5): Promise<QueueRow<T>[]> {
  const { data, error } = await sb().rpc("queue_read", { p_queue: queue, p_vt: vt, p_qty: qty });
  if (error) { console.error(`qRead(${queue})`, error.message); return []; }
  return (data ?? []) as QueueRow<T>[];
}

export async function qDelete(queue: string, msgId: number): Promise<void> {
  const { error } = await sb().rpc("queue_delete", { p_queue: queue, p_msg_id: msgId });
  if (error) console.error(`qDelete(${queue})`, error.message);
}

export async function qArchive(queue: string, msgId: number): Promise<void> {
  const { error } = await sb().rpc("queue_archive", { p_queue: queue, p_msg_id: msgId });
  if (error) console.error(`qArchive(${queue})`, error.message);
}

/** ดึง access token ของช่องทางจาก Vault */
export async function getChannelToken(channelId: string): Promise<string | null> {
  const { data, error } = await sb().rpc("get_channel_token", { p_channel_id: channelId });
  if (error) { console.error("getChannelToken", error.message); return null; }
  return data as string | null;
}

export async function auditLog(entry: {
  shop_id?: string; actor_type: "user" | "bot" | "system" | "webhook";
  actor_id?: string; action: string; resource_type?: string; resource_id?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await sb().from("audit_logs").insert(entry);
  if (error) console.error("auditLog", error.message);
}

export async function logAiUsage(entry: {
  shop_id: string; conversation_id?: string; message_id?: string;
  purpose: "reply" | "embedding" | "ocr" | "slip_verify" | "summarize" | "classify" | "ads" | "comment";
  model?: string; input_tokens?: number; output_tokens?: number; cost_usd?: number;
}): Promise<void> {
  const { error } = await sb().from("ai_usage_logs").insert(entry);
  if (error) console.error("logAiUsage", error.message);
}
