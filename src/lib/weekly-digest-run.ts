// ============================================================
//  สรุปประจำสัปดาห์ — ตรรกะจริง ใช้ร่วมกัน 2 ทางเข้า
//    1) /api/cron/weekly-digest — Vercel Cron รายวัน (ต้องมี CRON_SECRET)
//    2) ปุ่มในหน้าแอดมิน         — แอดมินแพลตฟอร์มกดเองได้ทุกเมื่อ
//
//  ⚠️ ทำไมต้องมีทางที่ 2 (12 ส.ค. 2569) — เหตุผลเดียวกับ lib/backup-run.ts:
//  `CRON_SECRET` ยังไม่ได้ตั้งใน Vercel → เส้น cron ตอบ 503 ทุกคืน
//  แปลว่าฟีเจอร์นี้ **ยังไม่เคยส่งถึงใครเลยสักครั้ง** ทั้งที่มันถูกเขียนขึ้นมาแก้ปัญหา
//  ที่วัดได้จริง 5 ส.ค. 2569: 22 จาก 24 กิจการเข้ามาวันเดียวแล้วไม่กลับมาอีกเลย
//  ของที่แก้ปัญหาใหญ่ที่สุดกลับเป็นของที่ตายเงียบที่สุด เพราะผูกกับ env ที่ยังไม่มีใครตั้ง
//
//  กติกาที่ยึด (บทเรียนจากกล่องจดหมาย):
//  · ส่งเฉพาะเมื่อ "มีเรื่องจริงให้ทำ" — สัปดาห์ไหนไม่มีอะไร ไม่ส่ง
//    เตือนเปล่า ๆ ทำให้คนเลิกอ่านทุกข้อความที่เหลือ รวมถึงข้อความที่สำคัญจริง
//  · เคารพสวิตช์แจ้งเตือนของร้าน (notify_approval) ทั้งสองช่องทาง
//  · กฎภาษีใช้ของเดิมที่เดียว (selectWhtPayableDocs + wht_due_dates)
//    ห้ามคำนวณเองในนี้ ไม่งั้นเลขในแจ้งเตือนกับในรายงานจะเพี้ยนกันเมื่อกฎเปลี่ยน
//  · ส่งซ้ำสัปดาห์เดิมไม่ได้ (บันทึกใน audit_logs) — ทั้ง cron ที่ยิงซ้ำ
//    และแอดมินที่กดปุ่มซ้ำ ต้องไม่สแปมผู้ใช้
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyShop } from "@/lib/notify";
import { docOutstanding } from "@/lib/finance";
import { selectWhtPayableDocs } from "@/lib/vat-docs";

const BKK = 7 * 3600_000;
const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface DigestResult {
  ok: true;
  week: string;
  /** ไม่ถึงขั้นส่ง เพราะยังไม่ถึงวันจันทร์และไม่ได้สั่ง force */
  skippedAll?: string;
  targets: number;
  sent: number;
  skipped: number;
}

/**
 * กุญแจกันส่งซ้ำ — ต้องผูกกับ "สัปดาห์" ไม่ใช่ "วันที่ยิง"
 *
 * ⚠️ เดิมใช้วันที่ของวันนั้นตรง ๆ ซึ่งถูกพอดีตราบใดที่ยิงเฉพาะวันจันทร์
 * แต่พอมีปุ่มให้กดเองวันไหนก็ได้ กุญแจจะเปลี่ยนทุกวัน = กดทุกวันก็ส่งได้ทุกวัน
 * จึงต้องถอยไปหาวันจันทร์ของสัปดาห์นั้นเสมอ (วันจันทร์ถอย 0 วัน = ค่าเท่าเดิมทุกประการ
 * ทางเส้น cron จึงไม่เปลี่ยนพฤติกรรมเลย)
 */
export function weekKeyOf(bkk: Date): string {
  const back = (bkk.getUTCDay() + 6) % 7; // จันทร์=0 · อาทิตย์=6
  return new Date(bkk.getTime() - back * 86_400_000).toISOString().slice(0, 10);
}

export async function runWeeklyDigest(
  svc: SupabaseClient,
  opts: { force?: boolean } = {},
): Promise<DigestResult> {
  const bkk = new Date(Date.now() + BKK);
  const isMonday = bkk.getUTCDay() === 1;
  const weekKey = weekKeyOf(bkk);

  if (!isMonday && !opts.force) {
    return { ok: true, week: weekKey, skippedAll: "ส่งเฉพาะวันจันทร์", targets: 0, sent: 0, skipped: 0 };
  }

  const today = bkk.toISOString().slice(0, 10);
  const weekAgo = new Date(bkk.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);

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

  if (!targets.length) return { ok: true, week: weekKey, targets: 0, sent: 0, skipped: 0 };

  const { data: already } = await svc.from("audit_logs")
    .select("shop_id").eq("action", "weekly_digest_sent").eq("details->>week", weekKey);
  const done = new Set((already ?? []).map((a) => a.shop_id as string));

  let sent = 0;
  let skipped = 0;

  for (const shopId of targets) {
    if (done.has(shopId)) { skipped++; continue; }
    const { data: shop } = await svc.from("shops").select("name,status").eq("id", shopId).maybeSingle();
    if (!shop || shop.status !== "active") { skipped++; continue; }

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
    if (docCount === 0 && outstanding <= 0 && !taxLine) { skipped++; continue; }

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

  return { ok: true, week: weekKey, targets: targets.length, sent, skipped };
}
