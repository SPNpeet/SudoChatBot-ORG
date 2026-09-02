import type { SupabaseClient } from "@supabase/supabase-js";
import { docOutstanding } from "@/lib/finance";

// ============================================================
//  AI CFO — สรุปสุขภาพการเงินของกิจการ (31 ส.ค. 2569 ตามมอคอัพ Sudo Financial OS ข้อ 5/5)
//
//  หลักออกแบบที่ทำให้ฟีเจอร์นี้ "ปลอดภัย" ทั้งที่ชื่อว่า CFO:
//   · ตัวเลขและคำเตือนทุกตัว "คำนวณด้วยโค้ด" จากข้อมูลจริงในระบบ — โมเดลแค่เรียบเรียง
//   · ขอบเขตคำแนะนำ = เชิงปฏิบัติในระบบเท่านั้น (ทวงหนี้ · คุมค่าใช้จ่าย · เงินเข้า-ออก · ค้างจ่าย)
//     ห้ามแนะนำลงทุน กู้ยืม ผลิตภัณฑ์การเงิน หรือรับประกันผลลัพธ์ (บังคับที่ prompt + ไม่มี tool ให้ทำ)
//   · ทุก insight มี "ปุ่มไปต่อ" เป็นคำสั่งในระบบ ไม่ใช่คำแนะนำลอย ๆ
//   · ใช้กติกาเงินชุดเดียวกับแดชบอร์ด (docOutstanding · กรองเอกสารยกเลิก) ไม่สร้างกฎซ้ำที่สาม
// ============================================================

export interface CfoInsight {
  tone: "red" | "amber" | "green" | "neutral";
  title: string;
  detail: string;
  action?: { label: string; command: string };
}
export interface CfoBrief {
  headline: string;
  metrics: {
    month_in: number; month_out: number; net: number;
    prev_in: number; prev_out: number; income_change_pct: number | null;
    avg_monthly_out_3m: number;
    ar_total: number; ar_overdue: number; ar_overdue_count: number;
    ap_total: number; ap_due_7d: number; ap_due_7d_count: number;
    top_expense_category: { name: string; amount: number; share_pct: number } | null;
    top_debtor: { name: string; amount: number } | null;
  };
  insights: CfoInsight[];
  generated_at: string;
}

const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ฿";
const pct = (n: number) => `${Math.round(n)}%`;

export async function getCfoBrief(db: SupabaseClient, shopId: string): Promise<CfoBrief> {
  const now = new Date(Date.now() + 7 * 3600_000);
  const today = now.toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";
  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const since3m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1)).toISOString().slice(0, 10);
  const in7d = new Date(Date.now() + 7 * 3600_000 + 7 * 864e5).toISOString().slice(0, 10);

  const [{ data: pays }, { data: open }, { data: monthExp }, { data: cats }] = await Promise.all([
    // กรองเอกสารยกเลิกในโค้ด — ห้ามใช้ !inner (ตัดเงินที่ยังไม่ผูกเอกสารทิ้ง) เหมือนแดชบอร์ด
    db.from("fin_payments").select("direction,amount,paid_at,fin_docs(status)").eq("shop_id", shopId).gte("paid_at", since3m),
    db.from("fin_docs").select("doc_type,contact_name,due_date,total,wht_amount,paid_amount")
      .eq("shop_id", shopId).in("status", ["awaiting", "partial"]),
    db.from("fin_docs").select("category_id,total").eq("shop_id", shopId).eq("doc_type", "expense")
      .neq("status", "void").gte("issue_date", monthStart),
    db.from("expense_categories").select("id,name").eq("shop_id", shopId),
  ]);

  const live = (pays ?? []).filter((p) => (p.fin_docs as { status?: string } | null)?.status !== "void");
  const sum = (dir: "in" | "out", from: string, to?: string) =>
    live.filter((p) => p.direction === dir && p.paid_at >= from && (!to || p.paid_at < to)).reduce((a, p) => a + Number(p.amount), 0);
  const month_in = sum("in", monthStart), month_out = sum("out", monthStart);
  const prev_in = sum("in", prevMonthStart, monthStart), prev_out = sum("out", prevMonthStart, monthStart);
  // เฉลี่ยรายจ่าย 3 เดือนก่อนหน้า (ไม่รวมเดือนนี้ที่ยังไม่จบ)
  const out3m = sum("out", since3m, monthStart);
  const avg_monthly_out_3m = out3m / 3;

  const docs = open ?? [];
  const inv = docs.filter((d) => d.doc_type === "invoice");
  const exp = docs.filter((d) => d.doc_type === "expense");
  const ar_total = inv.reduce((a, d) => a + docOutstanding(d), 0);
  const overdueInv = inv.filter((d) => d.due_date && d.due_date < today);
  const ar_overdue = overdueInv.reduce((a, d) => a + docOutstanding(d), 0);
  const ap_total = exp.reduce((a, d) => a + docOutstanding(d), 0);
  const apSoon = exp.filter((d) => d.due_date && d.due_date <= in7d);
  const ap_due_7d = apSoon.reduce((a, d) => a + docOutstanding(d), 0);

  const debtors = new Map<string, number>();
  for (const d of overdueInv) debtors.set(d.contact_name || "ไม่ระบุลูกค้า", (debtors.get(d.contact_name || "ไม่ระบุลูกค้า") ?? 0) + docOutstanding(d));
  const top_debtor = [...debtors.entries()].sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({ name, amount }))[0] ?? null;

  const catName = new Map((cats ?? []).map((c) => [c.id as string, c.name as string]));
  const byCat = new Map<string, number>();
  let expTotal = 0;
  for (const e of monthExp ?? []) {
    const n = catName.get(e.category_id as string) ?? "ไม่ระบุหมวด";
    byCat.set(n, (byCat.get(n) ?? 0) + Number(e.total)); expTotal += Number(e.total);
  }
  const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  const top_expense_category = topCat && expTotal > 0 ? { name: topCat[0], amount: topCat[1], share_pct: (topCat[1] / expTotal) * 100 } : null;
  const income_change_pct = prev_in > 0 ? ((month_in - prev_in) / prev_in) * 100 : null;
  const net = month_in - month_out;

  // ---- insight ตามลำดับความเร่ง: เงินที่ต้องไปเก็บ > เงินที่กำลังไหลออก > เงินที่ต้องจ่าย > แนวโน้ม ----
  const insights: CfoInsight[] = [];
  if (ar_overdue > 0) {
    const share = ar_total > 0 ? (ar_overdue / ar_total) * 100 : 0;
    insights.push({
      tone: share >= 50 ? "red" : "amber",
      title: `ลูกหนี้เกินกำหนด ${money(ar_overdue)} (${overdueInv.length} ใบ)`,
      detail: `คิดเป็น ${pct(share)} ของยอดรอเก็บทั้งหมด${top_debtor ? ` — รายที่ค้างมากสุด: ${top_debtor.name} ${money(top_debtor.amount)}` : ""}`,
      action: { label: "ให้ Sudo ร่างข้อความทวง", command: "ช่วยร่างข้อความทวงถามยอดค้างแบบสุภาพ เรียงจากรายที่ค้างมากสุด" },
    });
  }
  if (month_out > month_in && month_out > 0) {
    insights.push({
      tone: month_out > month_in * 1.5 ? "red" : "amber",
      title: `เดือนนี้เงินออกมากกว่าเงินเข้า ${money(month_out - month_in)}`,
      detail: top_expense_category
        ? `หมวดที่ใช้มากสุด: ${top_expense_category.name} ${money(top_expense_category.amount)} (${pct(top_expense_category.share_pct)} ของรายจ่าย)`
        : "ยังไม่มีรายจ่ายแยกหมวดในเดือนนี้",
      action: { label: "ดูว่าจ่ายอะไรไปบ้าง", command: "เดือนนี้จ่ายอะไรไปบ้าง เรียงจากมากไปน้อย พร้อมบอกว่าหมวดไหนควรคุม" },
    });
  }
  if (ap_due_7d > 0) {
    insights.push({
      tone: net < ap_due_7d ? "amber" : "neutral",
      title: `ต้องจ่ายภายใน 7 วัน ${money(ap_due_7d)} (${apSoon.length} ใบ)`,
      detail: net < ap_due_7d ? "เงินเข้าสุทธิเดือนนี้ยังไม่พอจ่ายก้อนนี้ — เตรียมเงินไว้ก่อน" : "เงินเข้าสุทธิเดือนนี้ครอบคลุมแล้ว",
      action: { label: "ใบไหนบ้าง", command: "มีบิลไหนต้องจ่ายภายใน 7 วันนี้บ้าง เรียงตามวันครบกำหนด" },
    });
  }
  if (income_change_pct !== null && Math.abs(income_change_pct) >= 20) {
    insights.push({
      tone: income_change_pct < 0 ? "amber" : "green",
      title: `รายรับเดือนนี้${income_change_pct < 0 ? "ลดลง" : "เพิ่มขึ้น"} ${pct(Math.abs(income_change_pct))} จากเดือนก่อน`,
      detail: `${money(prev_in)} → ${money(month_in)}`,
      action: { label: "ดูรายละเอียด", command: "เทียบรายรับเดือนนี้กับเดือนก่อน มาจากลูกค้าไหนบ้าง" },
    });
  }
  if (!insights.length) {
    insights.push({ tone: "green", title: "การเงินเดือนนี้ไม่มีจุดต้องรีบจัดการ", detail: `เงินเข้า ${money(month_in)} · เงินออก ${money(month_out)} · รอเก็บ ${money(ar_total)}` });
  }

  const headline = ar_overdue > 0
    ? `มีเงินรอเก็บที่เกินกำหนดแล้ว ${money(ar_overdue)} — เรื่องแรกที่ควรทำวันนี้คือทวง`
    : net < 0 ? `เดือนนี้เงินออกมากกว่าเข้า ${money(-net)} — ดูหมวดรายจ่ายก่อน`
    : `เดือนนี้เงินสดเป็นบวก ${money(net)} — ไม่มีอะไรเร่ง`;

  return {
    headline,
    metrics: { month_in, month_out, net, prev_in, prev_out, income_change_pct, avg_monthly_out_3m, ar_total, ar_overdue,
      ar_overdue_count: overdueInv.length, ap_total, ap_due_7d, ap_due_7d_count: apSoon.length, top_expense_category, top_debtor },
    insights: insights.slice(0, 4),
    generated_at: new Date().toISOString(),
  };
}
