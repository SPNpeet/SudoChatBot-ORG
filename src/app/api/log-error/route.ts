// รับรายงาน error จาก client (global-error.tsx) → console.error ให้เห็นใน Vercel Logs
// เก็บลง audit_logs ด้วยเพื่อย้อนดูได้จาก DB (best-effort ไม่มี PII)
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const b = await request.json();
    const entry = {
      message: String(b.message ?? "").slice(0, 500),
      digest: String(b.digest ?? "").slice(0, 100),
      url: String(b.url ?? "").slice(0, 300),
      stack: String(b.stack ?? "").slice(0, 2000),
    };
    console.error("[client-error]", JSON.stringify(entry));
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await createServiceClient().from("audit_logs").insert({
        actor_type: "system", action: "client_error", resource_type: "frontend",
        details: entry,
      });
    }
  } catch { /* ห้ามให้ endpoint นี้พังเอง */ }
  return NextResponse.json({ ok: true });
}
