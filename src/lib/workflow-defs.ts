// ============================================================
//  นิยาม/ชนิด/ตัวตรวจ config ของ AI Auto Workflow — ไฟล์ข้อมูลล้วน ห้าม import อะไร
//
//  ⚠️ ทำไมต้องแยก (31 ส.ค. 2569): workflows.ts ดึง notify -> web-push (โมดูล Node ล้วน)
//  client component ที่ import แค่ชื่อชนิดงานทำ build ล้มทั้งระบบ ("Can't resolve 'net'")
//  บทเรียนเดียวกับ plan-names.ts — ของที่ client ต้องใช้ ต้องอยู่ไฟล์ที่สะอาดจาก dependency
// ============================================================
import type { SaveDocInput, DocResult } from "@/app/dashboard/finance/actions";

export const WORKFLOW_MAX_PER_SHOP = 20;

export type WorkflowKind = "overdue_reminder" | "recurring_invoice" | "low_stock";
export const WORKFLOW_KIND_TH: Record<WorkflowKind, { name: string; desc: string }> = {
  overdue_reminder: { name: "เตือนทวงหนี้ที่เกินกำหนด", desc: "ใบแจ้งหนี้เกินกำหนดครบ N วัน ระบบเตรียมข้อความทวง + ลิงก์ให้ลูกค้าจ่าย แจ้งคุณ — คุณเป็นคนส่งเอง" },
  recurring_invoice: { name: "ร่างใบแจ้งหนี้ประจำเดือน", desc: "ทุกวันที่กำหนด ระบบร่างใบแจ้งหนี้รายการเดิมให้ (สถานะร่าง) คุณตรวจแล้วกดออกจริง" },
  low_stock: { name: "แจ้งสต๊อกใกล้หมด", desc: "สินค้าตัวไหนเหลือไม่เกินที่ตั้งไว้ แจ้งเตือนวันละครั้ง" },
};

export interface OverdueConfig { days_after_due: number }
export interface RecurringConfig {
  day_of_month: number; contact_id?: string | null; contact_name?: string;
  items: { name: string; qty: number; unit_price: number }[];
  vat_mode?: "none" | "exclusive" | "inclusive"; wht_rate?: number; notes?: string;
}
export interface LowStockConfig { threshold: number }

export interface AiWorkflow {
  id: string; shop_id: string; kind: WorkflowKind; name: string; config: Record<string, unknown>;
  active: boolean; source: "user" | "ai"; last_run_at: string | null; last_status: string | null;
  last_summary: string | null; created_at: string; updated_at: string;
}
export interface WorkflowRun { id: string; workflow_id: string; dedupe_key: string; status: string; summary: string | null; ran_at: string }

export interface RunContext {
  /** สร้างเอกสาร (มีเฉพาะเส้นทางที่มี session) — ไม่มี = ข้ามงานที่ต้องสร้างร่าง */
  createDoc?: (input: SaveDocInput) => Promise<DocResult>;
  force?: boolean;
}


/** ตรวจ config ก่อนเก็บ — คืนข้อความไทยเมื่อผิด (ผู้ใช้/AI ส่งอะไรมาก็ได้ ห้ามเชื่อ) */
export function validateConfig(kind: WorkflowKind, raw: Record<string, unknown>): { ok: true; config: Record<string, unknown> } | { ok: false; error: string } {
  const num = (v: unknown, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
  if (kind === "overdue_reminder") {
    const d = num(raw.days_after_due ?? 3, 0, 90);
    if (d === null) return { ok: false, error: "จำนวนวันหลังครบกำหนดต้องอยู่ระหว่าง 0-90" };
    return { ok: true, config: { days_after_due: d } };
  }
  if (kind === "low_stock") {
    const t = num(raw.threshold ?? 3, 0, 100000);
    if (t === null) return { ok: false, error: "เกณฑ์สต๊อกต้องเป็นตัวเลข 0 ขึ้นไป" };
    return { ok: true, config: { threshold: t } };
  }
  const day = num(raw.day_of_month ?? 1, 1, 28);
  if (day === null) return { ok: false, error: "วันที่ของเดือนต้องอยู่ระหว่าง 1-28 (กันเดือนที่ไม่มีวันที่ 29-31)" };
  const items = Array.isArray(raw.items) ? raw.items : [];
  const clean = items.map((it) => {
    const o = (it ?? {}) as Record<string, unknown>;
    return { name: String(o.name ?? "").trim().slice(0, 200), qty: num(o.qty ?? 1, 0.01, 1e6) ?? 0, unit_price: num(o.unit_price, 0, 1e9) ?? -1 };
  }).filter((it) => it.name && it.qty > 0 && it.unit_price >= 0);
  if (!clean.length) return { ok: false, error: "ต้องมีรายการอย่างน้อย 1 บรรทัด (ชื่อ · จำนวน · ราคา/หน่วย)" };
  const vat = ["none", "exclusive", "inclusive"].includes(String(raw.vat_mode)) ? String(raw.vat_mode) : "none";
  const wht = num(raw.wht_rate ?? 0, 0, 15) ?? 0;
  return { ok: true, config: {
    day_of_month: day, contact_id: raw.contact_id ? String(raw.contact_id) : null,
    contact_name: String(raw.contact_name ?? "").trim().slice(0, 200), items: clean, vat_mode: vat, wht_rate: wht,
    notes: String(raw.notes ?? "").trim().slice(0, 500),
  } };
}
