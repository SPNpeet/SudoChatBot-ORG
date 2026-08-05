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
      const svc = createServiceClient();
      // จำกัดอัตราก่อนเขียนเสมอ — endpoint นี้ไม่ต้องล็อกอินและเขียน audit_logs ได้ ~3KB ต่อครั้ง
      // ถ้าไม่กัน: ยิงทิ้งไว้คืนเดียวได้ล้านแถว -> ค่าเก็บข้อมูลบวม หน้า logs ช้า
      // และที่แย่ที่สุดคือ "ร่องรอยบัญชีจริงถูกกลบ" ซึ่งเป็นหลักฐานที่ต้องใช้ตรวจย้อนหลัง
      // 20 ครั้ง/ชม./IP พอสำหรับคนที่เจอ error รัว ๆ จริง ๆ (หน้าเดียวเด้งไม่กี่ครั้ง)
      const ipRaw = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim().toLowerCase();
      const ipNorm = ipRaw.includes(":") ? ipRaw.split("%")[0].split(":").slice(0, 4).join(":") + "::/64" : ipRaw;
      const { createHmac } = await import("crypto");
      const ipHash = createHmac("sha256", process.env.RATE_LIMIT_IP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "sc-fallback")
        .update(ipNorm).digest("hex");   // ห้ามเก็บ IP ดิบ (PDPA)
      const { data: rate, error: rateErr } = await svc.rpc("consume_public_rate", {
        p_bucket: "client_error", p_ip_hash: ipHash, p_limit: 20, p_window_secs: 3600,
      });
      // ตัวนับใช้ไม่ได้ = ไม่เขียน (log ยังไปที่ Vercel Logs อยู่แล้วด้านบน ไม่มีอะไรหาย)
      if (!rateErr && (rate as { allowed?: boolean } | null)?.allowed === true) {
        await svc.from("audit_logs").insert({
          actor_type: "system", action: "client_error", resource_type: "frontend",
          details: entry,
        });
      }
    }
  } catch { /* ห้ามให้ endpoint นี้พังเอง */ }
  return NextResponse.json({ ok: true });
}
