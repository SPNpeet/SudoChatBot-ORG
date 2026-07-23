"use server";
// ============================================================
//  Server Actions ระบบบัญชี — เอกสารขาย/ซื้อ · รับ-จ่ายเงิน · ตรวจสลิป ·
//  จับคู่อัตโนมัติ · ตัดสต๊อก · ลงสมุดรายวัน (GL) ทุกธุรกรรม
//  กติกา: เอกสารที่ออกแล้ว (ไม่ใช่ร่าง) ห้ามแก้ตัวเลข — ต้องยกเลิก (กลับรายการ GL
//  + คืนสต๊อกอัตโนมัติ) แล้วออกใหม่ เพื่อให้ตรวจย้อนหลังได้เสมอ (audit-safe)
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { revalidatePath } from "next/cache";
import { calcDocTotals, docOutstanding } from "@/lib/finance";
import { postJournal, reverseJournalOf, applyPaymentToDoc, bkkToday, ACC } from "@/lib/finance-server";
import { verifySlip, type SlipResult } from "@/lib/slip-verify";
import type { DocType, VatMode, FinDoc } from "@/lib/types/finance";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type DocResult = { ok: true; docId: string; docNumber: string } | { ok: false; error: string };

function friendly(e: unknown, fallback: string): string {
  const m = (e as Error).message ?? String(e);
  if (m.includes("forbidden")) return "คุณไม่มีสิทธิ์ทำรายการนี้";
  return m || fallback;
}

async function audit(svc: ReturnType<typeof createServiceClient>, shopId: string, userId: string, action: string, resourceType: string, resourceId: string | null, details?: Record<string, unknown>) {
  await svc.from("audit_logs").insert({
    shop_id: shopId, actor_type: "user", actor_id: userId,
    action, resource_type: resourceType, resource_id: resourceId, details: details ?? {},
  });
}

// ============================================================
//  ผู้ติดต่อ (ลูกค้า/ผู้ขาย)
// ============================================================
export async function upsertContact(shopId: string, formData: FormData): Promise<ActionResult> {
  try {
    const { user } = await assertMember(shopId, ["owner", "admin", "agent"]);
    const svc = createServiceClient();
    const id = String(formData.get("id") ?? "");
    const row = {
      shop_id: shopId,
      kind: ["customer", "vendor", "both"].includes(String(formData.get("kind"))) ? String(formData.get("kind")) : "customer",
      name: String(formData.get("name") ?? "").trim().slice(0, 200),
      tax_id: String(formData.get("tax_id") ?? "").replace(/[^0-9]/g, "") || null,
      branch: String(formData.get("branch") ?? "").trim().slice(0, 100) || null,
      address: String(formData.get("address") ?? "").trim().slice(0, 500) || null,
      email: String(formData.get("email") ?? "").trim().slice(0, 200) || null,
      phone: String(formData.get("phone") ?? "").trim().slice(0, 30) || null,
      notes: String(formData.get("notes") ?? "").trim().slice(0, 1000) || null,
      updated_at: new Date().toISOString(),
    };
    if (!row.name) return { ok: false, error: "ต้องมีชื่อผู้ติดต่อ" };
    if (id) {
      const { error } = await svc.from("contacts").update(row).eq("id", id).eq("shop_id", shopId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await svc.from("contacts").insert(row);
      if (error) return { ok: false, error: error.message };
    }
    await audit(svc, shopId, user.id, id ? "contact_updated" : "contact_created", "contact", id || null, { name: row.name });
    revalidatePath("/dashboard/contacts");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "บันทึกผู้ติดต่อไม่สำเร็จ") };
  }
}

export async function archiveContact(contactId: string, shopId: string): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    await svc.from("contacts").update({ status: "archived" }).eq("id", contactId).eq("shop_id", shopId);
    revalidatePath("/dashboard/contacts");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "เก็บผู้ติดต่อไม่สำเร็จ") };
  }
}

// ============================================================
//  ไฟล์แนบ (บิล/ใบเสร็จ/สลิป) — bucket slips (private) โฟลเดอร์ finance
// ============================================================
export async function uploadFinFile(shopId: string, formData: FormData): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  try {
    await assertMember(shopId, ["owner", "admin", "agent"]);
    const file = formData.get("file") as File | null;
    if (!file || !file.size) return { ok: false, error: "เลือกไฟล์ก่อน" };
    if (file.size > 8 * 1024 * 1024) return { ok: false, error: "ไฟล์ใหญ่เกิน 8MB" };
    const okTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!okTypes.includes(file.type)) return { ok: false, error: "รองรับเฉพาะรูปภาพและ PDF" };
    const svc = createServiceClient();
    const path = `${shopId}/finance/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-ก-๙]/g, "_")}`;
    const { error } = await svc.storage.from("slips").upload(path, file, { contentType: file.type });
    if (error) return { ok: false, error: error.message };
    return { ok: true, path };
  } catch (e) {
    return { ok: false, error: friendly(e, "อัปโหลดไฟล์ไม่สำเร็จ") };
  }
}

// ============================================================
//  เอกสาร (ใบเสนอราคา/ใบแจ้งหนี้/ใบเสร็จ/ค่าใช้จ่าย)
// ============================================================
interface DocItemInput { name: string; qty: number; unit?: string | null; unit_price: number; product_id?: string | null }
export interface SaveDocInput {
  id?: string;
  doc_type: DocType;
  contact_id?: string | null;
  contact_name?: string;         // กรอกเองได้โดยไม่ต้องสร้างผู้ติดต่อ
  issue_date?: string;
  due_date?: string | null;
  category_id?: string | null;   // เฉพาะ expense
  items: DocItemInput[];
  discount?: number;
  vat_mode?: VatMode;
  wht_rate?: number;
  notes?: string;
  file_path?: string | null;
  status?: "draft" | "awaiting";
  paid_now?: boolean;            // expense/receipt: เงินออก/เข้าแล้วทันที
  pay_method?: string;           // cash/transfer/promptpay/card/other
  source?: "manual" | "ai" | "import";
  ref_doc_id?: string | null;
}

/** ตัดสต๊อก + ลง COGS สำหรับเอกสารขายที่มีสินค้าผูก (invoice/receipt ที่ไม่อ้างใบแจ้งหนี้เดิม) */
async function cutStockAndCogs(
  svc: ReturnType<typeof createServiceClient>, shopId: string, userId: string,
  docId: string, docNumber: string, items: DocItemInput[], issueDate: string,
) {
  let cogs = 0;
  for (const it of items) {
    if (!it.product_id) continue;
    const { data: p } = await svc.from("products").select("id,track_stock,cost").eq("id", it.product_id).eq("shop_id", shopId).maybeSingle();
    if (!p) continue;
    if (p.track_stock) {
      await svc.rpc("decrement_stock", { p_product_id: p.id, p_variant_id: null, p_qty: Math.round(it.qty) }).then(() => {}, () => {});
    }
    if (p.cost != null) cogs += Number(p.cost) * it.qty;
  }
  if (cogs > 0) {
    await postJournal(svc, shopId, userId, {
      date: issueDate, memo: `ต้นทุนขายตามเอกสาร ${docNumber}`, sourceType: "stock", sourceId: docId,
      lines: [
        { code: ACC.COGS, debit: cogs },
        { code: ACC.INVENTORY, credit: cogs },
      ],
    });
  }
}

async function restoreStock(svc: ReturnType<typeof createServiceClient>, shopId: string, docId: string) {
  const { data: items } = await svc.from("fin_doc_items").select("product_id, qty").eq("doc_id", docId).not("product_id", "is", null);
  for (const it of items ?? []) {
    const { data: p } = await svc.from("products").select("id,track_stock").eq("id", it.product_id).eq("shop_id", shopId).maybeSingle();
    if (p?.track_stock) {
      await svc.rpc("decrement_stock", { p_product_id: p.id, p_variant_id: null, p_qty: -Math.round(Number(it.qty)) }).then(() => {}, () => {});
    }
  }
}

export async function saveDoc(shopId: string, input: SaveDocInput): Promise<DocResult> {
  try {
    const { user } = await assertMember(shopId, ["owner", "admin", "agent"]);
    const svc = createServiceClient();

    const items = (input.items ?? [])
      .filter((it) => it && String(it.name ?? "").trim() && Number(it.qty) > 0)
      .slice(0, 100)
      .map((it) => ({
        name: String(it.name).trim().slice(0, 300),
        qty: Math.max(0.01, Number(it.qty) || 1),
        unit: it.unit ? String(it.unit).slice(0, 30) : null,
        unit_price: Math.max(0, Number(it.unit_price) || 0),
        product_id: it.product_id || null,
      }));
    if (!items.length) return { ok: false, error: "ต้องมีรายการอย่างน้อย 1 บรรทัด" };

    const vatMode: VatMode = ["none", "exclusive", "inclusive"].includes(String(input.vat_mode)) ? input.vat_mode! : "none";
    const whtRate = Math.max(0, Math.min(15, Number(input.wht_rate) || 0));
    const t = calcDocTotals(items, Number(input.discount) || 0, vatMode, whtRate);
    const issueDate = input.issue_date || bkkToday();
    const status = input.status === "draft" ? "draft" : "awaiting";

    // snapshot ผู้ติดต่อ
    let contactName = String(input.contact_name ?? "").trim().slice(0, 200) || null;
    let contactTaxId: string | null = null, contactAddress: string | null = null;
    if (input.contact_id) {
      const { data: c } = await svc.from("contacts").select("name,tax_id,address,branch").eq("id", input.contact_id).eq("shop_id", shopId).maybeSingle();
      if (c) {
        contactName = c.name;
        contactTaxId = c.tax_id;
        contactAddress = [c.address, c.branch ? `(${c.branch})` : null].filter(Boolean).join(" ") || null;
      }
    }

    const baseRow = {
      shop_id: shopId,
      doc_type: input.doc_type,
      contact_id: input.contact_id || null,
      contact_name: contactName,
      contact_tax_id: contactTaxId,
      contact_address: contactAddress,
      issue_date: issueDate,
      due_date: input.due_date || null,
      category_id: input.doc_type === "expense" ? (input.category_id || null) : null,
      subtotal: t.base + (Number(input.discount) || 0),
      discount: Number(input.discount) || 0,
      vat_mode: vatMode, vat_amount: t.vat,
      wht_rate: whtRate, wht_amount: t.wht,
      total: t.total,
      status,
      source: input.source ?? "manual",
      file_path: input.file_path || null,
      ref_doc_id: input.ref_doc_id || null,
      notes: String(input.notes ?? "").trim().slice(0, 1000) || null,
      updated_at: new Date().toISOString(),
    };

    let docId = input.id ?? "";
    let docNumber = "";

    if (docId) {
      // แก้ได้เฉพาะร่าง — เอกสารที่ออกแล้วต้องยกเลิกแล้วออกใหม่
      const { data: old } = await svc.from("fin_docs").select("id,status,doc_number").eq("id", docId).eq("shop_id", shopId).maybeSingle();
      if (!old) return { ok: false, error: "ไม่พบเอกสารนี้" };
      if (old.status !== "draft") return { ok: false, error: "เอกสารที่ออกแล้วแก้ตัวเลขไม่ได้ — กด 'ยกเลิกเอกสาร' แล้วออกใหม่ (ระบบกลับรายการบัญชี/คืนสต๊อกให้เอง)" };
      docNumber = old.doc_number;
      const { error } = await svc.from("fin_docs").update(baseRow).eq("id", docId).eq("shop_id", shopId);
      if (error) return { ok: false, error: error.message };
      await svc.from("fin_doc_items").delete().eq("doc_id", docId);
    } else {
      const { data: num, error: numErr } = await svc.rpc("next_fin_doc_number", { p_shop_id: shopId, p_doc_type: input.doc_type });
      if (numErr || !num) return { ok: false, error: numErr?.message ?? "ออกเลขเอกสารไม่สำเร็จ" };
      docNumber = num as string;
      const { data: doc, error } = await svc.from("fin_docs").insert({ ...baseRow, doc_number: docNumber, created_by: user.id }).select("id").single();
      if (error || !doc) return { ok: false, error: error?.message ?? "สร้างเอกสารไม่สำเร็จ" };
      docId = doc.id;
    }

    const { error: itemErr } = await svc.from("fin_doc_items").insert(items.map((it, i) => ({
      doc_id: docId, shop_id: shopId, name: it.name, qty: it.qty, unit: it.unit,
      unit_price: it.unit_price, amount: Math.round(it.qty * it.unit_price * 100) / 100,
      product_id: it.product_id, sort: i,
    })));
    if (itemErr) return { ok: false, error: itemErr.message };

    // ---- ออกเอกสารจริง (ไม่ใช่ร่าง) -> ลงบัญชี + ตัดสต๊อก ----
    if (status === "awaiting") {
      const isConvertedReceipt = input.doc_type === "receipt" && !!input.ref_doc_id; // ใบเสร็จจากใบแจ้งหนี้ = เงินลงบัญชีตอนรับชำระแล้ว
      const cashAcc = input.pay_method === "cash" ? ACC.CASH : ACC.BANK;

      if (input.doc_type === "invoice") {
        await postJournal(svc, shopId, user.id, {
          date: issueDate, memo: `ขายเชื่อ ${docNumber}${contactName ? ` — ${contactName}` : ""}`,
          sourceType: "sale", sourceId: docId,
          lines: [
            { code: ACC.AR, debit: t.total },
            { code: ACC.SALES, credit: t.exVat },
            { code: ACC.VAT_OUT, credit: t.vat },
          ],
        });
        await cutStockAndCogs(svc, shopId, user.id, docId, docNumber, items, issueDate);
      } else if (input.doc_type === "receipt" && !isConvertedReceipt) {
        // ขายสด: เงินเข้าทันที
        await postJournal(svc, shopId, user.id, {
          date: issueDate, memo: `ขายสด ${docNumber}${contactName ? ` — ${contactName}` : ""}`,
          sourceType: "sale", sourceId: docId,
          lines: [
            { code: cashAcc, debit: t.cashDue },
            { code: ACC.WHT_ASSET, debit: t.wht },
            { code: ACC.SALES, credit: t.exVat },
            { code: ACC.VAT_OUT, credit: t.vat },
          ],
        });
        await cutStockAndCogs(svc, shopId, user.id, docId, docNumber, items, issueDate);
        await svc.from("fin_payments").insert({
          shop_id: shopId, doc_id: docId, direction: "in",
          method: input.pay_method ?? "transfer", amount: t.cashDue,
          paid_at: new Date(issueDate + "T12:00:00+07:00").toISOString(),
          verify_status: "manual", matched_by: "manual", created_by: user.id,
        });
        await svc.from("fin_docs").update({ paid_amount: t.cashDue, status: "paid" }).eq("id", docId);
      } else if (input.doc_type === "expense") {
        // หมวด -> รหัสบัญชีค่าใช้จ่าย
        let expAcc: string = ACC.OTHER_EXPENSE;
        if (input.category_id) {
          const { data: cat } = await svc.from("expense_categories").select("account_code").eq("id", input.category_id).eq("shop_id", shopId).maybeSingle();
          if (cat?.account_code) expAcc = cat.account_code;
        }
        if (input.paid_now) {
          await postJournal(svc, shopId, user.id, {
            date: issueDate, memo: `ค่าใช้จ่าย ${docNumber}${contactName ? ` — ${contactName}` : ""} (จ่ายแล้ว)`,
            sourceType: "expense", sourceId: docId,
            lines: [
              { code: expAcc, debit: t.exVat },
              { code: ACC.VAT_IN, debit: t.vat },
              { code: cashAcc, credit: t.cashDue },
              { code: ACC.WHT_PAYABLE, credit: t.wht },
            ],
          });
          await svc.from("fin_payments").insert({
            shop_id: shopId, doc_id: docId, direction: "out",
            method: input.pay_method ?? "transfer", amount: t.cashDue,
            paid_at: new Date(issueDate + "T12:00:00+07:00").toISOString(),
            verify_status: "manual", matched_by: "manual", created_by: user.id,
          });
          await svc.from("fin_docs").update({ paid_amount: t.cashDue, status: "paid" }).eq("id", docId);
        } else {
          await postJournal(svc, shopId, user.id, {
            date: issueDate, memo: `ตั้งหนี้ค่าใช้จ่าย ${docNumber}${contactName ? ` — ${contactName}` : ""}`,
            sourceType: "expense", sourceId: docId,
            lines: [
              { code: expAcc, debit: t.exVat },
              { code: ACC.VAT_IN, debit: t.vat },
              { code: ACC.AP, credit: t.total },
            ],
          });
        }
      }
      // quotation: ไม่ลงบัญชี ไม่ตัดสต๊อก
    }

    await audit(svc, shopId, user.id, input.id ? "fin_doc_updated" : "fin_doc_created", "fin_doc", docId, { doc_number: docNumber, doc_type: input.doc_type, total: t.total, status });
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard");
    return { ok: true, docId, docNumber };
  } catch (e) {
    return { ok: false, error: friendly(e, "บันทึกเอกสารไม่สำเร็จ") };
  }
}

/** ยกเลิกเอกสาร: กลับรายการ GL ทุกใบ + คืนสต๊อก + สถานะ void */
export async function voidDoc(shopId: string, docId: string, reason: string): Promise<ActionResult> {
  try {
    const { user } = await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    const { data: doc } = await svc.from("fin_docs").select("id,doc_number,doc_type,status").eq("id", docId).eq("shop_id", shopId).maybeSingle();
    if (!doc) return { ok: false, error: "ไม่พบเอกสาร" };
    if (doc.status === "void") return { ok: false, error: "เอกสารนี้ถูกยกเลิกไปแล้ว" };

    await reverseJournalOf(svc, shopId, user.id, docId, reason || `ยกเลิก ${doc.doc_number}`);
    if (doc.doc_type === "invoice" || doc.doc_type === "receipt") await restoreStock(svc, shopId, docId);
    await svc.from("fin_docs").update({ status: "void", notes: reason ? `ยกเลิก: ${reason}`.slice(0, 500) : undefined, updated_at: new Date().toISOString() }).eq("id", docId);
    await audit(svc, shopId, user.id, "fin_doc_voided", "fin_doc", docId, { doc_number: doc.doc_number, reason });
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/expenses");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "ยกเลิกเอกสารไม่สำเร็จ") };
  }
}

/** แปลงเอกสาร: ใบเสนอราคา -> ใบแจ้งหนี้ · ใบแจ้งหนี้ (จ่ายครบ) -> ใบเสร็จ */
export async function convertDoc(shopId: string, docId: string): Promise<DocResult> {
  try {
    await assertMember(shopId, ["owner", "admin", "agent"]);
    const svc = createServiceClient();
    const { data: doc } = await svc.from("fin_docs").select("*, fin_doc_items(*)").eq("id", docId).eq("shop_id", shopId).maybeSingle();
    if (!doc) return { ok: false, error: "ไม่พบเอกสาร" };
    const d = doc as unknown as FinDoc;
    if (d.status === "void") return { ok: false, error: "เอกสารถูกยกเลิกแล้ว แปลงไม่ได้" };

    let target: DocType;
    if (d.doc_type === "quotation") target = "invoice";
    else if (d.doc_type === "invoice") {
      if (d.status !== "paid") return { ok: false, error: "ออกใบเสร็จได้เมื่อใบแจ้งหนี้รับชำระครบแล้ว — บันทึกรับเงินที่หน้ารับชำระก่อน" };
      target = "receipt";
    } else return { ok: false, error: "เอกสารประเภทนี้แปลงต่อไม่ได้" };

    // กันออกซ้ำ
    const { data: dup } = await svc.from("fin_docs").select("id,doc_number").eq("shop_id", shopId).eq("ref_doc_id", docId).eq("doc_type", target).neq("status", "void").maybeSingle();
    if (dup) return { ok: false, error: `มี${target === "invoice" ? "ใบแจ้งหนี้" : "ใบเสร็จ"} ${dup.doc_number} ที่ออกจากเอกสารนี้อยู่แล้ว` };

    const r = await saveDoc(shopId, {
      doc_type: target,
      contact_id: d.contact_id,
      contact_name: d.contact_name ?? undefined,
      due_date: target === "invoice" ? d.due_date : null,
      items: (d.fin_doc_items ?? []).map((it) => ({ name: it.name, qty: Number(it.qty), unit: it.unit ?? undefined, unit_price: Number(it.unit_price), product_id: target === "invoice" ? it.product_id : null })),
      discount: Number(d.discount),
      vat_mode: d.vat_mode,
      wht_rate: Number(d.wht_rate),
      notes: d.notes ?? undefined,
      status: "awaiting",
      ref_doc_id: docId,
    });
    if (r.ok && d.doc_type === "quotation") {
      await svc.from("fin_docs").update({ status: "paid" }).eq("id", docId); // quotation: paid = ตอบรับแล้ว
    }
    return r;
  } catch (e) {
    return { ok: false, error: friendly(e, "แปลงเอกสารไม่สำเร็จ") };
  }
}

// ============================================================
//  รับ/จ่ายเงิน + ตรวจสลิป + จับคู่ (ตัวลงบัญชีอยู่ใน finance-server)
// ============================================================

export interface RecordPaymentInput {
  doc_id?: string | null;
  direction: "in" | "out";
  method?: string;
  amount: number;
  paid_at?: string;          // YYYY-MM-DD
  slip_path?: string | null; // จาก uploadFinFile
  statement_ref?: string | null;
}

export type PaymentResult =
  | { ok: true; paymentId: string; verify?: SlipResult | null; docStatus?: string }
  | { ok: false; error: string };

export async function recordPayment(shopId: string, input: RecordPaymentInput): Promise<PaymentResult> {
  try {
    const { user } = await assertMember(shopId, ["owner", "admin", "agent"]);
    const svc = createServiceClient();
    const amount = Math.round(Number(input.amount) * 100) / 100;
    if (!(amount > 0)) return { ok: false, error: "ยอดเงินต้องมากกว่า 0" };
    const method = ["transfer", "promptpay", "cash", "card", "other"].includes(String(input.method)) ? String(input.method) : "transfer";
    const paidAt = input.paid_at ? new Date(input.paid_at + "T12:00:00+07:00").toISOString() : new Date().toISOString();

    // ---- ตรวจสลิปอัตโนมัติ (ถ้าแนบสลิป + ร้านตั้ง provider) ----
    let verify: SlipResult | null = null;
    let verifyStatus: "unverified" | "verified" | "failed" | "manual" = input.slip_path ? "unverified" : "manual";
    if (input.slip_path && input.direction === "in") {
      const [{ data: pay }, { data: slipKey }] = await Promise.all([
        svc.from("shop_payment_settings").select("slip_provider").eq("shop_id", shopId).maybeSingle(),
        svc.rpc("get_shop_slip_key", { p_shop_id: shopId }),
      ]);
      if (pay?.slip_provider && pay.slip_provider !== "manual" && slipKey) {
        const { data: file } = await svc.storage.from("slips").download(input.slip_path);
        if (file) {
          verify = await verifySlip(pay.slip_provider, slipKey as string, new Uint8Array(await file.arrayBuffer()));
          if (verify?.verified) {
            verifyStatus = Math.abs((verify.amount ?? 0) - amount) <= 0.01 ? "verified" : "failed";
          } else if (verify) {
            verifyStatus = "failed";
          }
        }
      }
    }

    // ---- ผูกกับเอกสาร (ลง GL + อัปเดตสถานะ) ----
    let docStatus: string | undefined;
    let doc: { id: string; doc_number: string; doc_type: string; total: number; wht_amount: number; paid_amount: number; contact_name: string | null } | null = null;
    if (input.doc_id) {
      const { data } = await svc.from("fin_docs")
        .select("id,doc_number,doc_type,total,wht_amount,paid_amount,contact_name,status")
        .eq("id", input.doc_id).eq("shop_id", shopId).maybeSingle();
      if (!data) return { ok: false, error: "ไม่พบเอกสารที่จะผูกรายการเงิน" };
      if (data.status === "void") return { ok: false, error: "เอกสารถูกยกเลิกแล้ว" };
      if (data.status === "draft") return { ok: false, error: "เอกสารยังเป็นร่าง — ออกเอกสารก่อนจึงบันทึกเงินได้" };
      doc = data;
    }

    const { data: payment, error } = await svc.from("fin_payments").insert({
      shop_id: shopId, doc_id: doc?.id ?? null, direction: input.direction,
      method, amount, paid_at: paidAt,
      slip_storage_path: input.slip_path ?? null,
      slip_trans_ref: verify?.transRef ?? null,
      slip_data: verify?.raw ?? null,
      verify_status: verifyStatus,
      verify_note: verifyStatus === "failed"
        ? (verify?.verified ? `ยอดในสลิป ${verify.amount} ไม่ตรงกับที่บันทึก ${amount}` : verify?.error ?? null)
        : null,
      matched_by: doc ? "manual" : null,
      statement_ref: input.statement_ref ?? null,
      created_by: user.id,
    }).select("id").single();
    if (error || !payment) {
      if (error?.message.includes("fin_payments_transref_uniq")) return { ok: false, error: "สลิปใบนี้เคยบันทึกแล้ว (เลขอ้างอิงซ้ำ) — กันบันทึกเงินซ้ำให้อัตโนมัติ" };
      return { ok: false, error: error?.message ?? "บันทึกไม่สำเร็จ" };
    }

    if (doc) {
      docStatus = await applyPaymentToDoc(svc, shopId, user.id, doc, amount, method, paidAt);
    } else {
      // เงินเข้า/ออกลอย (ไม่ผูกเอกสาร) — ลงพักไว้ที่รายได้อื่น/ค่าใช้จ่ายอื่น
      const cashAcc = method === "cash" ? ACC.CASH : ACC.BANK;
      await postJournal(svc, shopId, user.id, {
        date: paidAt.slice(0, 10),
        memo: input.direction === "in" ? "เงินเข้า (ยังไม่ผูกเอกสาร)" : "เงินออก (ยังไม่ผูกเอกสาร)",
        sourceType: input.direction === "in" ? "receipt" : "payment", sourceId: payment.id,
        lines: input.direction === "in"
          ? [{ code: cashAcc, debit: amount }, { code: "4090", credit: amount }]
          : [{ code: "5990", debit: amount }, { code: cashAcc, credit: amount }],
      });
    }

    await audit(svc, shopId, user.id, "fin_payment_recorded", "fin_payment", payment.id, { amount, direction: input.direction, doc: doc?.doc_number });
    revalidatePath("/dashboard/money");
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard");
    return { ok: true, paymentId: payment.id, verify, docStatus };
  } catch (e) {
    return { ok: false, error: friendly(e, "บันทึกรายการเงินไม่สำเร็จ") };
  }
}

/** อัปโหลดสลิปแล้วให้ระบบตรวจ + หาใบแจ้งหนี้ที่ยอดตรงให้อัตโนมัติ */
export type SlipMatchResult =
  | { ok: true; verify: SlipResult | null; slipPath: string; amount: number | null;
      matched?: { docId: string; docNumber: string; contact: string | null; outstanding: number };
      candidates: { docId: string; docNumber: string; contact: string | null; outstanding: number; due: string | null }[] }
  | { ok: false; error: string };

export async function uploadAndMatchSlip(shopId: string, formData: FormData): Promise<SlipMatchResult> {
  try {
    await assertMember(shopId, ["owner", "admin", "agent"]);
    const up = await uploadFinFile(shopId, formData);
    if (!up.ok) return up;
    const svc = createServiceClient();

    // ตรวจสลิป
    let verify: SlipResult | null = null;
    const [{ data: pay }, { data: slipKey }] = await Promise.all([
      svc.from("shop_payment_settings").select("slip_provider").eq("shop_id", shopId).maybeSingle(),
      svc.rpc("get_shop_slip_key", { p_shop_id: shopId }),
    ]);
    if (pay?.slip_provider && pay.slip_provider !== "manual" && slipKey) {
      const { data: file } = await svc.storage.from("slips").download(up.path);
      if (file) verify = await verifySlip(pay.slip_provider, slipKey as string, new Uint8Array(await file.arrayBuffer()));
    }
    const amount = verify?.verified ? (verify.amount ?? null) : null;

    // หาใบแจ้งหนี้ค้างรับ
    const { data: docs } = await svc.from("fin_docs")
      .select("id,doc_number,contact_name,total,wht_amount,paid_amount,due_date")
      .eq("shop_id", shopId).eq("doc_type", "invoice").in("status", ["awaiting", "partial"])
      .order("issue_date", { ascending: false }).limit(100);
    const candidates = (docs ?? []).map((d) => ({
      docId: d.id, docNumber: d.doc_number, contact: d.contact_name,
      outstanding: docOutstanding(d), due: d.due_date,
    })).filter((c) => c.outstanding > 0);

    const exact = amount != null ? candidates.filter((c) => Math.abs(c.outstanding - amount) <= 0.01) : [];
    return {
      ok: true, verify, slipPath: up.path, amount,
      matched: exact.length === 1 ? exact[0] : undefined,
      candidates: candidates.slice(0, 30),
    };
  } catch (e) {
    return { ok: false, error: friendly(e, "ตรวจสลิปไม่สำเร็จ") };
  }
}

// ============================================================
//  หมวดค่าใช้จ่าย + สมุดรายวัน (บันทึกเอง)
// ============================================================
export async function addExpenseCategory(shopId: string, name: string, accountCode: string): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    const n = name.trim().slice(0, 100);
    if (!n) return { ok: false, error: "ตั้งชื่อหมวดก่อน" };
    const { error } = await svc.from("expense_categories").insert({
      shop_id: shopId, name: n, sort: 50, account_code: /^5\d{3}$/.test(accountCode) ? accountCode : "5990",
    });
    if (error) return { ok: false, error: error.message.includes("duplicate") ? "มีหมวดชื่อนี้อยู่แล้ว" : error.message };
    revalidatePath("/dashboard/expenses");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "เพิ่มหมวดไม่สำเร็จ") };
  }
}

export interface ManualJournalLine { code: string; debit: number; credit: number; memo?: string }
export async function addManualJournal(shopId: string, date: string, memo: string, lines: ManualJournalLine[]): Promise<ActionResult> {
  try {
    const { user } = await assertMember(shopId, ["owner", "admin", "agent"]);
    const svc = createServiceClient();
    const r = await postJournal(svc, shopId, user.id, {
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : bkkToday(),
      memo: memo.trim().slice(0, 500) || "บันทึกรายวันทั่วไป",
      sourceType: "manual",
      lines,
    });
    if (!r.ok) return r;
    await audit(svc, shopId, user.id, "journal_manual_added", "journal_entry", r.entryId, { entry_number: r.entryNumber });
    revalidatePath("/dashboard/journal");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "บันทึกสมุดรายวันไม่สำเร็จ") };
  }
}
