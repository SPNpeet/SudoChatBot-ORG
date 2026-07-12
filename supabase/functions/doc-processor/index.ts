// ============================================================
//  DOC PROCESSOR — OCR (Google Document AI) -> chunk -> embed -> pgvector
// ============================================================
import { sb, qRead, qDelete, qArchive, logAiUsage } from "../_shared/supabase.ts";
import { json } from "../_shared/utils.ts";
import { QueueDoc } from "../_shared/types.ts";
import { ocrDocument, chunkText } from "../_shared/ocr.ts";
import { embedTexts } from "../_shared/embeddings.ts";

async function processDoc(item: QueueDoc): Promise<void> {
  const s = sb();
  const { data: doc } = await s.from("knowledge_documents").select("*").eq("id", item.document_id).single();
  if (!doc) throw new Error("document not found");
  await s.from("knowledge_documents").update({ status: "processing", error: null }).eq("id", doc.id);

  try {
    // ---- 1) ดึงข้อความ ----
    let text = "";
    let pages = 1;
    if (doc.source_type === "text" || doc.source_type === "faq") {
      text = doc.raw_text ?? "";
    } else {
      if (!doc.storage_path) throw new Error("no storage_path");
      const { data: file, error } = await s.storage.from("knowledge").download(doc.storage_path);
      if (error || !file) throw new Error(`download failed: ${error?.message}`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = doc.mime_type ?? (doc.source_type === "pdf" ? "application/pdf" : "image/jpeg");
      const ocr = await ocrDocument(bytes, mime);
      text = ocr.text; pages = ocr.pages;
      await logAiUsage({ shop_id: doc.shop_id, purpose: "ocr", model: "google-document-ai", input_tokens: pages, cost_usd: pages * 0.0015 });
    }
    if (!text.trim()) throw new Error("ไม่พบข้อความในเอกสาร");

    // ---- 2) chunk + embed ----
    const chunks = chunkText(text);
    const vectors = await embedTexts(chunks, "RETRIEVAL_DOCUMENT");
    await logAiUsage({
      shop_id: doc.shop_id, purpose: "embedding", model: "gemini-embedding-001",
      input_tokens: Math.ceil(chunks.join("").length / 4), cost_usd: 0,
    });

    // ---- 3) replace chunks ----
    await s.from("knowledge_chunks").delete().eq("document_id", doc.id);
    for (let i = 0; i < chunks.length; i += 50) {
      const batch = chunks.slice(i, i + 50).map((c, j) => ({
        document_id: doc.id, shop_id: doc.shop_id, chunk_index: i + j,
        content: c, token_count: Math.ceil(c.length / 4),
        embedding: JSON.stringify(vectors[i + j]),
      }));
      const { error } = await s.from("knowledge_chunks").insert(batch);
      if (error) throw new Error(`chunk insert: ${error.message}`);
    }
    await s.from("knowledge_documents").update({
      status: "ready", page_count: pages, chunk_count: chunks.length, raw_text: text.slice(0, 100000),
    }).eq("id", doc.id);
  } catch (e) {
    await s.from("knowledge_documents").update({ status: "failed", error: (e as Error).message }).eq("id", doc.id);
    throw e;
  }
}

Deno.serve(async (_req: Request) => {
  let ok = 0, fail = 0;
  const rows = await qRead<QueueDoc>("document_processing", 300, 2);
  for (const row of rows) {
    try {
      await processDoc(row.message);
      await qDelete("document_processing", row.msg_id);
      ok++;
    } catch (e) {
      console.error("doc process error", (e as Error).message);
      fail++;
      if (row.read_ct >= 3) await qArchive("document_processing", row.msg_id);
    }
  }
  return json({ ok, fail });
});
