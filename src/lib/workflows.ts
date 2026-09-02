import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyShop } from "@/lib/notify";
import type { SaveDocInput } from "@/app/dashboard/finance/actions";
import { WORKFLOW_MAX_PER_SHOP, type AiWorkflow, type RunContext, type OverdueConfig, type RecurringConfig, type LowStockConfig } from "@/lib/workflow-defs";
export * from "@/lib/workflow-defs";

// ============================================================
//  AI Auto Workflow — งานอัตโนมัติที่กิจการตั้งไว้ (31 ส.ค. 2569)
//
//  กติกาเหล็กที่บังคับด้วยโค้ดในไฟล์นี้ (ไม่ใช่ prompt):
//   1. ทำได้แค่ "เตรียมร่าง + แจ้งเตือน" — ร่างใบแจ้งหนี้ status=draft เสมอ ไม่ลงสมุดรายวัน
//      ไม่มี workflow ไหนออกเอกสารจริง จ่ายเงิน หรือส่งข้อความหาลูกค้าของร้านเอง
//   2. รันซ้ำไม่ได้: ทุกผลลัพธ์มี dedupe_key unique ต่อ workflow (งวด/วัน/ใบ) ใน ai_workflow_runs
//   3. เพดาน: 20 workflow/กิจการ · รันได้วันละครั้งต่อ workflow (เว้นแต่กด "รันเดี๋ยวนี้")
//   4. ล้มหนึ่งตัวห้ามพาตัวอื่นล้ม · ทุกรอบเขียน log ที่ผู้ใช้เปิดดูได้
//   5. เส้น cron ไม่มี session จึงสร้างเอกสารไม่ได้ (saveDoc ต้อง assertMember) —
//      ร่างใบแจ้งหนี้จะถูกสร้างตอนสมาชิกเปิดแดชบอร์ดครั้งแรกของวัน (มี session จริง)
//      จงใจไม่แยกแกน saveDoc ออกจากไฟล์ "use server" เพราะ export = endpoint สาธารณะไร้ด่าน
// ============================================================

const RUN_COOLDOWN_MS = 20 * 3600_000;   // "วันละครั้ง" แบบยืดหยุ่นกับเวลาเปิดแอปที่ไม่ตรงกันทุกวัน
const bkkDate = (offsetDays = 0) => new Date(Date.now() + 7 * 3600_000 + offsetDays * 864e5).toISOString().slice(0, 10);
const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** บันทึกผลรอบนี้ — unique (workflow, dedupe_key) คือด่าน idempotent · ชนกัน = เคยทำแล้ว */
async function claimRun(svc: SupabaseClient, wf: AiWorkflow, key: string): Promise<boolean> {
  const { error } = await svc.from("ai_workflow_runs").insert({ workflow_id: wf.id, shop_id: wf.shop_id, dedupe_key: key, status: "ok", summary: null });
  return !error;
}
async function finishRun(svc: SupabaseClient, wf: AiWorkflow, key: string, status: "ok" | "skipped" | "error", summary: string) {
  await svc.from("ai_workflow_runs").update({ status, summary: summary.slice(0, 500) }).eq("workflow_id", wf.id).eq("dedupe_key", key);
}

async function runOverdue(svc: SupabaseClient, wf: AiWorkflow): Promise<string> {
  const cfg = wf.config as unknown as OverdueConfig;
  const cutoff = bkkDate(-(cfg.days_after_due ?? 3));
  const { data } = await svc.from("fin_docs")
    .select("id,doc_number,contact_name,due_date,total,wht_amount,paid_amount,share_key")
    .eq("shop_id", wf.shop_id).eq("doc_type", "invoice").in("status", ["awaiting", "partial"])
    .lte("due_date", cutoff).order("due_date").limit(20);
  const docs = data ?? [];
  let sent = 0;
  for (const d of docs) {
    // เตือนซ้ำใบเดิมได้ทุก 7 วัน — บ่อยกว่านั้นคือรบกวน
    const week = Math.floor(Date.parse(bkkDate()) / (7 * 864e5));
    const key = `overdue:${d.id}:${week}`;
    if (!(await claimRun(svc, wf, key))) continue;
    const owe = Number(d.total) - Number(d.wht_amount ?? 0) - Number(d.paid_amount ?? 0);
    const days = Math.round((Date.parse(bkkDate()) - Date.parse(d.due_date)) / 864e5);
    const payUrl = d.share_key ? `https://sudochatbot.online/doc/${d.share_key}` : "";
    const draft = `เรียน ${d.contact_name || "ลูกค้า"} ขอแจ้งยอดค้างชำระตามใบแจ้งหนี้ ${d.doc_number} จำนวน ${money(owe)} บาท ครบกำหนดแล้ว ${days} วัน${payUrl ? ` ชำระได้ที่ ${payUrl}` : ""} ขอบคุณครับ/ค่ะ`;
    await notifyShop(svc, wf.shop_id, {
      title: `ทวงหนี้: ${d.doc_number} เกินกำหนด ${days} วัน`,
      body: `ค้าง ${money(owe)} บาท — ข้อความพร้อมส่ง: ${draft}`,
      url: `/dashboard/sales/${d.id}`, tag: `wf-overdue-${d.id}`,
    });
    await finishRun(svc, wf, key, "ok", `เตรียมข้อความทวง ${d.doc_number}`);
    sent++;
  }
  return docs.length ? `เกินกำหนด ${docs.length} ใบ · แจ้งใหม่ ${sent} ใบ` : "ไม่มีใบเกินกำหนด";
}

async function runRecurring(svc: SupabaseClient, wf: AiWorkflow, ctx: RunContext): Promise<string> {
  const cfg = wf.config as unknown as RecurringConfig;
  const today = bkkDate();
  const dayNow = Number(today.slice(8, 10));
  if (dayNow < (cfg.day_of_month ?? 1)) return `ยังไม่ถึงวันที่ ${cfg.day_of_month} ของเดือน`;
  const key = `recurring:${today.slice(0, 7)}`;
  if (!ctx.createDoc) return "รอสร้างร่างตอนสมาชิกเปิดแดชบอร์ด (เส้นอัตโนมัติสร้างเอกสารเองไม่ได้)";
  if (!(await claimRun(svc, wf, key))) return `ร่างของเดือน ${today.slice(0, 7)} ทำไปแล้ว`;
  const r = await ctx.createDoc({
    doc_type: "invoice", status: "draft", source: "ai",
    contact_id: cfg.contact_id ?? null, contact_name: cfg.contact_name,
    issue_date: today, items: cfg.items.map((it) => ({ name: it.name, qty: it.qty, unit_price: it.unit_price })),
    vat_mode: (cfg.vat_mode ?? "none") as SaveDocInput["vat_mode"], wht_rate: cfg.wht_rate ?? 0,
    notes: `[ร่างอัตโนมัติจาก "${wf.name}"] ${cfg.notes ?? ""}`.trim(),
  });
  if (!r.ok) { await finishRun(svc, wf, key, "error", r.error); return `สร้างร่างไม่สำเร็จ: ${r.error}`; }
  await notifyShop(svc, wf.shop_id, {
    title: `ร่างใบแจ้งหนี้ประจำเดือนพร้อมแล้ว: ${r.docNumber}`,
    body: `${wf.name} — ตรวจรายการแล้วกด "ออกจริง" ระบบถึงจะลงบัญชี`,
    url: `/dashboard/sales/${r.docId}`, tag: `wf-recurring-${wf.id}`,
  });
  await finishRun(svc, wf, key, "ok", `ร่าง ${r.docNumber}`);
  return `ร่าง ${r.docNumber} แล้ว (รอออกจริง)`;
}

async function runLowStock(svc: SupabaseClient, wf: AiWorkflow): Promise<string> {
  const cfg = wf.config as unknown as LowStockConfig;
  const key = `lowstock:${bkkDate()}`;
  const { data } = await svc.from("products").select("name,stock").eq("shop_id", wf.shop_id)
    .not("stock", "is", null).lte("stock", cfg.threshold ?? 3).order("stock").limit(10);
  const low = (data ?? []) as { name: string; stock: number }[];
  if (!low.length) return "สต๊อกทุกตัวยังเกินเกณฑ์";
  if (!(await claimRun(svc, wf, key))) return "แจ้งวันนี้ไปแล้ว";
  await notifyShop(svc, wf.shop_id, {
    title: `สต๊อกใกล้หมด ${low.length} รายการ`,
    body: low.map((p) => `${p.name} เหลือ ${p.stock}`).join(" · "),
    url: "/dashboard/products", tag: `wf-lowstock-${wf.id}`,
  });
  await finishRun(svc, wf, key, "ok", `แจ้ง ${low.length} รายการ`);
  return `แจ้ง ${low.length} รายการ`;
}

export async function runWorkflow(svc: SupabaseClient, wf: AiWorkflow, ctx: RunContext): Promise<{ status: "ok" | "error"; summary: string }> {
  try {
    const summary = wf.kind === "overdue_reminder" ? await runOverdue(svc, wf)
      : wf.kind === "recurring_invoice" ? await runRecurring(svc, wf, ctx)
      : await runLowStock(svc, wf);
    // บันทึกเวลารันแม้ไม่มีอะไรทำ — หน้า UI ต้องบอกได้ว่า "ตรวจล่าสุดเมื่อไหร่"
    await svc.from("ai_workflows").update({ last_run_at: new Date().toISOString(), last_status: "ok", last_summary: summary.slice(0, 500) }).eq("id", wf.id);
    return { status: "ok", summary };
  } catch (e) {
    const msg = (e as Error).message?.slice(0, 300) || "ผิดพลาดไม่ทราบสาเหตุ";
    await svc.from("ai_workflows").update({ last_run_at: new Date().toISOString(), last_status: "error", last_summary: msg }).eq("id", wf.id).then(() => {}, () => {});
    return { status: "error", summary: msg };
  }
}

/** รันทุก workflow ที่ active ของกิจการ — ข้ามตัวที่เพิ่งรันไป (คูลดาวน์) เว้นแต่ force */
export async function runShopWorkflows(svc: SupabaseClient, shopId: string, ctx: RunContext = {}): Promise<{ ran: number; results: { id: string; name: string; status: string; summary: string }[] }> {
  const { data } = await svc.from("ai_workflows").select("*").eq("shop_id", shopId).eq("active", true).limit(WORKFLOW_MAX_PER_SHOP);
  const list = (data ?? []) as AiWorkflow[];
  const results: { id: string; name: string; status: string; summary: string }[] = [];
  for (const wf of list) {
    if (!ctx.force && wf.last_run_at && Date.now() - Date.parse(wf.last_run_at) < RUN_COOLDOWN_MS) continue;
    const r = await runWorkflow(svc, wf, ctx);
    results.push({ id: wf.id, name: wf.name, ...r });
  }
  return { ran: results.length, results };
}

/** มี workflow ไหนถึงเวลารันไหม — ใช้ตัดสินใจก่อนจุดชนวนตอนเปิดแดชบอร์ด (ถูกกว่าโหลดทั้งหมด) */
export async function hasDueWorkflows(svc: SupabaseClient, shopId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - RUN_COOLDOWN_MS).toISOString();
  const { count } = await svc.from("ai_workflows").select("id", { count: "exact", head: true })
    .eq("shop_id", shopId).eq("active", true).or(`last_run_at.is.null,last_run_at.lt.${cutoff}`);
  return (count ?? 0) > 0;
}
