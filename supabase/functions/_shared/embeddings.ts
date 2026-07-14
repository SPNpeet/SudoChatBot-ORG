// ==== Embeddings 1536 มิติ — Google หรือ OpenAI (เลือกจากหน้า Admin) ====
import { resolveEmbedConfig } from "./providers.ts";

const DIM = 1536;

function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

export async function embedTexts(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
  const cfg = await resolveEmbedConfig();
  const out: number[][] = [];
  if (cfg.provider === "google") {
    for (let i = 0; i < texts.length; i += 20) {
      const batch = texts.slice(i, i + 20);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:batchEmbedContents?key=${cfg.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: batch.map((t) => ({
              model: `models/${cfg.model}`,
              content: { parts: [{ text: t.slice(0, 8000) }] },
              taskType,
              outputDimensionality: DIM,
            })),
          }),
        },
      );
      if (!res.ok) throw new Error(`google embed ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      for (const e of j.embeddings ?? []) out.push(normalize(e.values));
    }
  } else {
    for (let i = 0; i < texts.length; i += 100) {
      const batch = texts.slice(i, i + 100).map((t) => t.slice(0, 8000));
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({ model: cfg.model, input: batch, dimensions: DIM }),
      });
      if (!res.ok) throw new Error(`openai embed ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      for (const e of j.data ?? []) out.push(normalize(e.embedding));
    }
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text], "RETRIEVAL_QUERY");
  return v;
}
