// ============================================================
//  /api/cron/workflows — รันงานอัตโนมัติของทุกกิจการวันละครั้ง (Vercel Cron)
//
//  ⚠️ fail-closed ด้วย CRON_SECRET เหมือน backup/weekly-digest — ยังไม่ตั้ง = 503 ทุกคืน
//  (ตรวจ 31 ส.ค. 2569: production ยังตอบ 503 อยู่ — งานเจ้าของ)
//  ระหว่างนั้นระบบยังทำงานได้ผ่านจุดชนวนตอนสมาชิกเปิดแดชบอร์ด (dashboard/page.tsx)
//
//  เส้นนี้ไม่มี session จึง "สร้างร่างเอกสาร" ไม่ได้ (createDoc ไม่ถูกส่ง) — ทำได้เฉพาะ
//  เตือนทวงหนี้/สต๊อก · ร่างใบแจ้งหนี้จะถูกสร้างตอนมีคนเปิดแดชบอร์ด (ดู src/lib/workflows.ts ข้อ 5)
// ============================================================
import { NextResponse } from "next/server";
import { cronRequestAllowed } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { runShopWorkflows } from "@/lib/workflows";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!(await cronRequestAllowed(request))) {
    return NextResponse.json({ ok: false, error: "cron not authorized" }, { status: 503 });
  }
  const svc = createServiceClient();
  // เฉพาะกิจการที่มี workflow เปิดอยู่ — ไม่ไล่ทุกร้านในระบบ
  const { data } = await svc.from("ai_workflows").select("shop_id").eq("active", true);
  const shopIds = [...new Set((data ?? []).map((r) => r.shop_id as string))].slice(0, 500);
  let ran = 0; const errors: string[] = [];
  for (const shopId of shopIds) {
    try { ran += (await runShopWorkflows(svc, shopId)).ran; }
    catch (e) { errors.push(`${shopId.slice(0, 8)}: ${(e as Error).message?.slice(0, 80)}`); }
  }
  return NextResponse.json({ ok: true, shops: shopIds.length, ran, errors });
}
