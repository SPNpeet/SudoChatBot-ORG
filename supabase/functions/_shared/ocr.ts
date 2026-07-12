// ==== Google Document AI (OCR ภาษาไทย/อังกฤษ สำหรับ PDF และรูป) ====
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

let cachedToken: { token: string; exp: number } | null = null;

async function googleAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() / 1000 + 60) return cachedToken.token;
  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const sa = JSON.parse(saJson);
  const pem: string = sa.private_key;
  const der = atob(pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, ""));
  const keyData = new Uint8Array([...der].map((c) => c.charCodeAt(0)));
  const key = await crypto.subtle.importKey(
    "pkcs8", keyData, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const now = getNumericDate(0);
  const jwt = await create({ alg: "RS256", typ: "JWT" }, {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: getNumericDate(3600),
  }, key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`google token failed: ${await res.text()}`);
  const j = await res.json();
  cachedToken = { token: j.access_token, exp: Date.now() / 1000 + j.expires_in };
  return j.access_token;
}

function b64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** OCR เอกสาร -> ข้อความล้วน (รองรับ pdf/รูป) */
export async function ocrDocument(bytes: Uint8Array, mimeType: string): Promise<{ text: string; pages: number }> {
  const processor = Deno.env.get("GOOGLE_DOCAI_PROCESSOR");
  if (!processor) throw new Error("GOOGLE_DOCAI_PROCESSOR not set");
  const token = await googleAccessToken();
  const location = processor.includes("/locations/eu/") ? "eu" : "us";
  const res = await fetch(`https://${location}-documentai.googleapis.com/v1/${processor}:process`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      rawDocument: { content: b64(bytes), mimeType },
      skipHumanReview: true,
    }),
  });
  if (!res.ok) throw new Error(`docai failed ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const j = await res.json();
  return { text: j.document?.text ?? "", pages: j.document?.pages?.length ?? 1 };
}

/** ตัดข้อความเป็นท่อนสำหรับ RAG (~1200 ตัวอักษร ทับซ้อน 150) */
export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      // พยายามตัดที่จุดจบย่อหน้า/ประโยค
      const slice = clean.slice(start, end);
      const cut = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
      if (cut > size * 0.5) end = start + cut;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks.filter((c) => c.length > 20);
}
