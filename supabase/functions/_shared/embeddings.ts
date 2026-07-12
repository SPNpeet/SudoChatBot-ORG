// ==== Google Gemini Embeddings (1536 มิติ ตรงกับ schema) ====
const EMBED_MODEL = "gemini-embedding-001";
const DIM = 1536;

export async function embedTexts(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const out: number[][] = [];
  // batch ทีละ 20 กันเกิน payload limit
  for (let i = 0; i < texts.length; i += 20) {
    const batch = texts.slice(i, i + 20);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: batch.map((t) => ({
            model: `models/${EMBED_MODEL}`,
            content: { parts: [{ text: t.slice(0, 8000) }] },
            taskType,
            outputDimensionality: DIM,
          })),
        }),
      },
    );
    if (!res.ok) throw new Error(`embed failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = await res.json();
    for (const e of j.embeddings ?? []) {
      // normalize (จำเป็นเมื่อตัดมิติด้วย MRL) เพื่อให้ cosine ถูกต้อง
      const v: number[] = e.values;
      const norm = Math.sqrt(v.reduce((s: number, x: number) => s + x * x, 0)) || 1;
      out.push(v.map((x: number) => x / norm));
    }
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text], "RETRIEVAL_QUERY");
  return v;
}
