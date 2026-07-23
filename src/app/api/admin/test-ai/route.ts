import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { OPENAI_COMPAT_BASE, CHAT_MODELS, type Provider } from "@/lib/ai-catalog";
import { friendlyAiError } from "@/lib/ai-errors";

// ยิง request เล็กสุดไปแต่ละค่ายเพื่อยืนยันว่า key ใช้ได้จริง
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = await request.json();
  const svc = createServiceClient();

  // โหมด purpose: ทดสอบคีย์ของการ์ดงาน (ผู้ช่วยบัญชี/อ่านบิล) โดยตรง
  let provider: string = body.provider;
  let model: string = body.model;
  let key: string | null = null;
  if (body.purpose) {
    const { data: pk } = await svc.rpc("get_purpose_ai_key", { p_purpose: String(body.purpose) });
    const cfg = pk as { provider?: string; model?: string | null; key?: string } | null;
    if (!cfg?.key) return NextResponse.json({ ok: false, error: "ยังไม่ได้บันทึก API key ของงานนี้" });
    provider = cfg.provider ?? provider;
    model = body.model || cfg.model || "";
    key = cfg.key;
  } else {
    const { data } = await svc.rpc("get_ai_key", { p_provider: provider });
    key = data as string | null;
  }
  if (!key) return NextResponse.json({ ok: false, error: "ยังไม่ได้บันทึก API key ของค่ายนี้" });

  try {
    let ok = false; let detail = "";
    // โมเดล OCR ของ Mistral ทดสอบผ่าน chat ไม่ได้ — เช็คความถูกต้องของ key ด้วย endpoint รายชื่อโมเดลแทน
    if (provider === "mistral" && String(model).includes("ocr")) {
      const res = await fetch("https://api.mistral.ai/v1/models", { headers: { "Authorization": `Bearer ${key}` } });
      ok = res.ok; if (!ok) detail = (await res.text()).slice(0, 200);
      const friendlyOcr = ok ? "เชื่อมต่อสำเร็จ" : friendlyAiError(detail);
      return NextResponse.json({ ok, error: ok ? undefined : friendlyOcr });
    }
    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: model || "claude-haiku-4-5-20251001", max_tokens: 8, messages: [{ role: "user", content: "hi" }] }),
      });
      ok = res.ok; if (!ok) detail = (await res.text()).slice(0, 200);
    } else if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: model || "gpt-4o-mini", max_completion_tokens: 8, messages: [{ role: "user", content: "hi" }] }),
      });
      ok = res.ok; if (!ok) detail = (await res.text()).slice(0, 200);
    } else if (provider === "google") {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-2.5-flash"}:generateContent?key=${key}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 8 } }),
      });
      ok = res.ok; if (!ok) detail = (await res.text()).slice(0, 200);
    } else if (OPENAI_COMPAT_BASE[provider as Provider]) {
      // ค่าย OpenAI-compatible (DeepSeek/Qwen/GLM/Kimi) — ใช้ max_tokens ไม่ใช่ max_completion_tokens
      const base = OPENAI_COMPAT_BASE[provider as Provider]!;
      const defaultModel = CHAT_MODELS[provider as Provider]?.[0]?.id;
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: model || defaultModel, max_tokens: 8, messages: [{ role: "user", content: "hi" }] }),
      });
      ok = res.ok; if (!ok) detail = (await res.text()).slice(0, 200);
    } else {
      return NextResponse.json({ ok: false, error: "unknown provider" });
    }

    const friendly = ok ? "เชื่อมต่อสำเร็จ" : friendlyAiError(detail);
    if (!body.purpose) {
      await svc.from("ai_provider_keys").update({
        test_status: ok ? "ok" : "failed", test_message: friendly, tested_at: new Date().toISOString(),
      }).eq("provider", provider);
    }

    return NextResponse.json({ ok, error: ok ? undefined : friendly });
  } catch (e) {
    return NextResponse.json({ ok: false, error: friendlyAiError((e as Error).message) });
  }
}
