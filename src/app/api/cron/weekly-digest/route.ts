import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyShop } from "@/lib/notify";
import { docOutstanding } from "@/lib/finance";
import { selectWhtPayableDocs } from "@/lib/vat-docs";

// ============================================================
//  สรุปประจำสัปดาห์ส่งถึงผู้ใช้ (LINE + Web Push)
//
//  ทำไมต้องมี — วัดจริง 5 ส.ค. 2569: 22 จาก 24 กิจการเข้ามาวันเดียวแล้วไม่กลับมาอีกเลย
//  งานบัญชีเป็นงานสิ้นเดือน ถ้าไม่มีอะไรเรียกกลับ คนจะลืมไปจนถึงตอนที่สายไปแล้ว
//  ในแอปมีกล่องจดหมายเตือนครบอยู่แล้ว แต่มันเห็นได้ "ต่อเมื่อเข้ามา" ซึ่งคือปัญหาตั้งต้น
//  ตัวนี้คือช่องทางเดียวที่ไปหาเขาได้โดยไม่ต้องรอให้เขานึกถึงเรา
//
//  กติกาที่ยึด (บทเรียนจากกล่องจดหมาย):
//  · ส่งเฉพาะเมื่อ "มีเรื่องจริงให้ทำ" — สัปดาห์ไหนไม่มีอะไร ไม่ส่ง
//    เตือนเปล่า ๆ ทำให้คนเลิกอ่านทุกข้อความที่เหลือ รวมถึงข้อความที่สำคัญจริง
//  · เคารพสวิตช์แจ้งเตือนของร้าน (notify_approval) ทั้งสองช่องทาง
//  · กฎภาษีใช้ของเดิมที่เดียว (selectWhtPayableDocs + wht_due_dates)
//    ห้ามคำนวณเองในนี้ ไม่งั้นเลขในแจ้งเตือนกับในรายงานจะเพี้ยนกันเมื่อกฎเปลี่ยน
//  · ส่งซ้ำสัปดาห์เดิมไม่ได้ (บันทึกใน audit_logs) — cron ยิงซ้ำต้องไม่สแปมผู้ใช้
//
//  Vercel Cron ยิงทุกวัน แต่โค้ดทำงานเฉพาะ "วันจันทร์เวลาไทย" เท่านั้น
//  (ตั้ง schedule รายสัปดาห์ตรง ๆ ได้ แต่แพ็ก Hobby จำกัดความถี่ cron —
//   ยิงรายวันแล้วกรองวันในโค้ดจึงทนต่อการเปลี่ยนแพ็กมากกว่า)
// ============================================================

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BKK = 7 * 3600_000;
const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 503 });
  }

  const url = new URL(request.url);
  const bkk = new Date(Date.now() + BKK);
  const isMonday = bkk.getUTCDay() === 1;
  if (!isMonday && url.searchParams.get("force") !== "1") {
    return NextResponse.json({ ok: true, skipped: "ส่งเฉพาะวันจันทร์" });
  }

  const svc = createServiceClient();
  const today = bkk.toISOString().slice(0, 10);
  const weekAgo = new Date(bkk.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  // กุญแจกันส่งซ้ำ — ผูกกับสัปดาห์ ไม่ใช่เวลาที่ยิง
  const weekKey = today;

  // ส่งได้เฉพาะร้านที่มีช่องทางจริง — ไม่มีช่องทาง = ข้าม (ไม่ใช่ความผิดพลาด)
  const [{ data: notifyRows }, { data: pushRows }] = await Promise.all([
    svc.from("shop_notify_settings").select("shop_id,line_to_id,notify_approval"),
    svc.from("push_subscriptions").select("shop_id"),
  ]);
  const optedOut = new Set((notifyRows ?? []).filter((n) => n.notify_approval === false).map((n) => n.shop_id as string));
  const reachable = new Set<string>();
  for (const n of notifyRows ?? []) if (n.line_to_id) reachable.add(n.shop_id as string);
  for (const p of pushRows ?? []) reachable.add(p.shop_id as string);
  const targets = [...reachable].filter((id) => !optedOut.has(id));

  if (!targets.length) {
    return NextResponse.json({ ok: true, week: weekKey, sent: 0, note: "ยังไม่มีกิจการที่เชื่อมช่องทางแจ้งเตือน" });
  }

  // กันส่งซ้ำ "สัปดาห์เดียวกัน" — ต้องเทียบด้วยกุญแจสัปดาห์ ไม่ใช่ช่วงเวลา
  // (บั๊กที่เจอตอนตรวจซ้ำ: ใช้ created_at >= today-7d ซึ่งครอบการส่งของสัปดาห์ก่อนพอดี
  //  ทำให้ทุกกิจการติด "ส่งไปแล้ว" ตลอดกาล = สรุปรายสัปดาห์ส่งได้ครั้งเดียวในชีวิต แล้วเงียบ)
  const { data: already } = await svc.from("audit_logs")
    .select("shop_id").eq("action", "weekly_digest_sent").eq("details->>week", weekKey);
  const done = new Set((already ?? []).map((a) => a.shop_id as string));

  let sent = 0;
  const skipped: string[] = [];

  for (const shopId of targets) {
    if (done.has(shopId)) { skipped.push("ส่งไปแล้วสัปดาห์นี้"); continue; }
    const { data: shop } = await svc.from("shops").select("name,status").eq("id", shopId).maybeSingle();
    if (!shop || shop.status !== "active") { skipped.push("กิจการไม่ได้ใช้งาน"); continue; }

    // ---- กิจกรรมสัปดาห์ที่ผ่านมา + ยอดค้างรับ ----
    const [{ data: recent }, { data: openDocs }] = await Promise.all([
      svc.from("fin_docs").select("id").eq("shop_id", shopId)
        .not("status", "in", "(draft,void)").gte("issue_date", weekAgo).lt("issue_date", today),
      svc.from("fin_docs").select("total,wht_amount,paid_amount,due_date")
        .eq("shop_id", shopId).eq("doc_type", "invoice").in("status", ["awaiting", "partial"]),
    ]);

    const docCount = (recent ?? []).length;
    let outstanding = 0, overdueCount = 0, overdueAmount = 0;
    for (const d of openDocs ?? []) {
      const rest = docOutstanding(d);
      if (rest <= 0) continue;
      outstanding += rest;
      if (d.due_date && d.due_date < today) { overdueCount++; overdueAmount += rest; }
    }

    // ---- ภาษีหัก ณ ที่จ่ายที่ต้องนำส่ง (ใช้กฎเดิมที่เดียว ห้ามคำนวณเองที่นี่) ----
    let taxLine = "";
    try {
      const period = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
      const [y, m] = period.split("-").map(Number);
      const { data: whtDocs } = await svc.from("fin_docs")
        .select("doc_type,status,wht_amount,vat_amount,total,ref_doc_id")
        .eq("shop_id", shopId).gt("wht_amount", 0)
        .gte("issue_date", `${period}-01`).lt("issue_date", new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10));
      const payable = selectWhtPayableDocs((whtDocs ?? []) as never[]);
      if (payable.length) {
        const tax = payable.reduce((a, d) => a + Number((d as { wht_amount?: number }).wht_amount ?? 0), 0);
        const { data: due } = await svc.rpc("wht_due_dates", { p_period: period });
        const paper = (due as { paper?: string | null } | null)?.paper ?? null;
        if (paper && paper >= today) taxLine = `\n· ภ.ง.ด. งวด ${period} ต้องนำส่ง ${baht(tax)} บาท ภายใน ${paper}`;
      }
    } catch { /* ภาษีอ่านไม่ได้ ไม่ควรทำให้สรุปทั้งฉบับหาย */ }

    // ---- ไม่มีเรื่องจริงให้ทำ = ไม่ส่ง ----
    if (docCount === 0 && outstanding <= 0 && !taxLine) { skipped.push("ไม่มีเรื่องต้องแจ้ง"); continue; }

    const lines = [
      docCount > 0 ? `· สัปดาห์ที่ผ่านมาออกเอกสาร ${docCount} ใบ` : "· สัปดาห์ที่ผ่านมายังไม่ได้ออกเอกสาร",
      outstanding > 0 ? `· ยอดค้างรับรวม ${baht(outstanding)} บาท` : null,
      overdueCount > 0 ? `· เลยกำหนดชำระ ${overdueCount} ใบ (${baht(overdueAmount)} บาท) — ส่งลิงก์ทวงได้จากหน้าการเงิน` : null,
    ].filter(Boolean).join("\n");

    await notifyShop(svc, shopId, {
      title: `สรุปประจำสัปดาห์ — ${shop.name}`,
      body: `${lines}${taxLine}`,
      url: "/dashboard",
      tag: `digest:${weekKey}`,
    });
    await svc.from("audit_logs").insert({
      shop_id: shopId, actor_type: "system", action: "weekly_digest_sent",
      resource_type: "shops", resource_id: shopId,
      details: { week: weekKey, docs: docCount, outstanding, overdue: overdueCount },
    });
    sent++;
  }

  return NextResponse.json({ ok: true, week: weekKey, targets: targets.length, sent, skipped: skipped.length });
}
