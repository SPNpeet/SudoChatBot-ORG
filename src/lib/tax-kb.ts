// ============================================================
//  คลังความรู้ภาษีไทยที่อ้างอิงได้ (RAG) — ฝั่ง server เท่านั้น
//
//  ต่างจาก src/lib/tax-th.ts อย่างไร (สำคัญ อย่าสับสน):
//    · tax-th.ts  = **กฎถาวร** ที่โค้ดต้องใช้คำนวณ (อัตรา VAT, ประเภทเงินได้ ม.40, กติกา ม.86/4)
//                   อยู่ในโค้ด แก้แล้ว deploy · typecheck ช่วยกันพัง
//    · ที่นี่      = **ความรู้ที่ตอบคำถามคน** ซึ่งเปลี่ยนตามประกาศและมีวันหมดอายุ
//                   อยู่ในตาราง แก้ได้โดยไม่ต้อง deploy · ต้องมีที่มาอ้างอิงเสมอ
//  นี่คือกติกาข้อ 7 ของโปรเจกต์: "กฎถาวร → โค้ด · ประกาศที่มีวันหมดอายุ → ตาราง"
//
//  ⚠️ ทิศที่ผิดแล้วอันตรายคือ "ผ่อนปรนเกินจริง"
//  ค้นไม่เจอต้องคืนว่าง เพื่อให้ผู้ช่วยบอกว่าไม่รู้และให้ไปปรึกษานักบัญชี
//  ห้ามคืน "อันที่ใกล้เคียงที่สุด" มาเสมอ — คำตอบผิดที่ฟังดูมั่นใจทำให้ผู้ใช้โดนเบี้ยปรับ
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePurposeKey, resolveDefaultAiConfig, type Provider } from "@/lib/ai-config";

/** ต้องตรงกับ vector(1536) ในตาราง — เปลี่ยนค่านี้ต้องแก้ migration และสร้าง embedding ใหม่ทั้งตาราง */
export const TAX_KB_DIMS = 1536;

/** ค่ายที่ทำ embedding ได้จริง — anthropic/mistral ไม่มี API นี้ ข้ามไปเลย */
const EMBED_MODEL: Partial<Record<Provider, string>> = {
  google: "gemini-embedding-001",
  openai: "text-embedding-3-small",
};

export interface TaxKbHit {
  topic: string; content: string; citation: string; source_url: string | null;
  effective_from: string; effective_to: string | null; similarity: number;
  /** 'vector' = ค้นด้วย embedding · 'text' = ตกมาใช้ trigram (คีย์ embedding ใช้ไม่ได้/ยังไม่ได้สร้างเวกเตอร์) */
  matched_by: "vector" | "text";
}

/**
 * แปลงข้อความเป็นเวกเตอร์ 1536 มิติ
 *
 * คืน null เมื่อทำไม่ได้ (ไม่มีคีย์ค่ายที่รองรับ / ค่ายล่ม) — **ไม่ throw**
 * เพราะฝั่งเรียกจะตกไปใช้การค้นแบบ trigram แทน ซึ่งยังตอบได้บ้าง
 * ดีกว่าให้ฟีเจอร์เงียบไปทั้งอันเพราะคีย์ตัวเดียวมีปัญหา
 */
export async function embedText(svc: SupabaseClient, text: string): Promise<number[] | null> {
  const clean = text.trim().slice(0, 8000);
  if (!clean) return null;

  const cfg = (await resolvePurposeKey(svc, "assistant")) ?? (await resolveDefaultAiConfig(svc).catch(() => null));
  // ค่ายที่ใช้อยู่ทำ embedding ไม่ได้ -> ลองหาคีย์ของค่ายที่ทำได้แทน
  const candidates: Provider[] = cfg && EMBED_MODEL[cfg.provider]
    ? [cfg.provider]
    : (["google", "openai"] as Provider[]);

  for (const provider of candidates) {
    const model = EMBED_MODEL[provider];
    if (!model) continue;
    const apiKey = cfg?.provider === provider
      ? cfg.apiKey
      : ((await svc.rpc("get_ai_key", { p_provider: provider })).data as string | null);
    if (!apiKey) continue;

    try {
      const vec = provider === "google"
        ? await embedGoogle(clean, model, apiKey)
        : await embedOpenAI(clean, model, apiKey);
      if (vec?.length === TAX_KB_DIMS) return vec;
      // มิติไม่ตรงคือปัญหาที่ต้องรู้ ไม่ใช่ปัญหาที่ควรเงียบ — เก็บลง log ให้เห็น
      console.error(`[tax-kb] ${provider} คืนเวกเตอร์ ${vec?.length} มิติ ต้องการ ${TAX_KB_DIMS}`);
    } catch (e) {
      console.error(`[tax-kb] embed ผ่าน ${provider} ไม่สำเร็จ:`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}

async function embedGoogle(text: string, model: string, apiKey: string): Promise<number[] | null> {
  // ⚠️ ต้องส่ง outputDimensionality — ค่าเริ่มต้นของ gemini-embedding-001 คือ 3072
  // ไม่ส่ง = ได้เวกเตอร์ที่ยัดลงคอลัมน์ vector(1536) ไม่ได้ แล้วจะ error ตอน insert
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
    {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        outputDimensionality: TAX_KB_DIMS,
      }),
    },
  );
  if (!res.ok) throw new Error(`google ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data?.embedding?.values ?? null) as number[] | null;
}

async function embedOpenAI(text: string, model: string, apiKey: string): Promise<number[] | null> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: text, dimensions: TAX_KB_DIMS }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data?.data?.[0]?.embedding ?? null) as number[] | null;
}

/**
 * ค้นความรู้ภาษี — กรองช่วงวันที่ที่ฐานข้อมูล ไม่ฝากให้โมเดลอ่านวันที่เอง
 *
 * `onDate` ใส่เมื่ออยากรู้กฎ ณ วันในอดีต (เช่น ตรวจเอกสารย้อนหลัง)
 * ไม่ใส่ = ใช้วันนี้ตามเวลาไทย
 */
export async function searchTaxKnowledge(
  svc: SupabaseClient,
  query: string,
  opts: { limit?: number; onDate?: string } = {},
): Promise<TaxKbHit[]> {
  const embedding = await embedText(svc, query);
  const { data, error } = await svc.rpc("search_tax_knowledge", {
    p_query: query,
    p_embedding: embedding ? JSON.stringify(embedding) : null,
    p_limit: opts.limit ?? 4,
    p_on_date: opts.onDate ?? null,
  });
  if (error) {
    console.error("[tax-kb] ค้นไม่สำเร็จ:", error.message);
    return [];
  }
  return (data ?? []) as TaxKbHit[];
}

/** ช่วงที่ใช้บังคับ เขียนให้คนอ่านรู้เรื่อง — ใช้ทั้งในคำตอบ AI และหน้าแอดมิน */
export function effectiveLabel(from: string, to: string | null): string {
  const th = (d: string) => {
    const [y, m, dd] = d.split("-");
    return `${Number(dd)}/${Number(m)}/${Number(y) + 543}`;
  };
  return to ? `ใช้บังคับ ${th(from)} – ${th(to)}` : `ใช้บังคับตั้งแต่ ${th(from)}`;
}
