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
import { postJournalOrThrow, reverseJournalOf, applyPaymentToDoc, bkkToday, ACC } from "@/lib/finance-server";
import { verifySlip, type SlipResult } from "@/lib/slip-verify";
import { notifyShopLine } from "@/lib/line";
import type { DocType, VatMode, FinDoc } from "@/lib/types/finance";
import { WHT_INCOME_TYPES, DEFAULT_WHT_INCOME, guessRecipientKind, docDateTooFarFuture } from "@/lib/tax-th";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type DocResult = { ok: true; docId: string; docNumber: string; approvalPending?: boolean } | { ok: false; error: string };

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
      // ตัวตัดสินแบบยื่น ภ.ง.ด.3 / 53 — ถ้าไม่ส่งมาให้เดาจากเลขผู้เสียภาษีไว้ก่อน
      recipient_kind: ["individual", "juristic", "group"].includes(String(formData.get("recipient_kind")))
        ? String(formData.get("recipient_kind"))
        : guessRecipientKind(String(formData.get("tax_id") ?? "")),
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
  wht_income_type?: string | null;   // ประเภทเงินได้ ม.40 — ใช้ออก 50 ทวิ + ไฟล์ยื่น ภ.ง.ด.
  notes?: string;
  file_path?: string | null;
  extra_files?: string[];        // ไฟล์แนบใบที่ 2 ขึ้นไป (fin_doc_files)
  status?: "draft" | "awaiting";
  paid_now?: boolean;            // expense/receipt: เงินออก/เข้าแล้วทันที
  tax_point?: "delivery" | "payment";  // ม.78 vs ม.78/1 — ดูคำอธิบายใน saveDoc
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
    await postJournalOrThrow(svc, shopId, userId, {
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
    const { user, role } = await assertMember(shopId, ["owner", "admin", "agent"]);
    const svc = createServiceClient();

    // Approval Flow: พนักงาน (agent) บันทึกค่าใช้จ่าย -> เข้าคิวรออนุมัติ ยังไม่ลงบัญชี
    // owner/admin ทำเอง = ผ่านทันที (ธุรกิจคนเดียวไม่ต้องอนุมัติตัวเอง)
    const needsApproval = input.doc_type === "expense" && role === "agent" && input.status !== "draft";
    if (needsApproval) input = { ...input, status: "draft", paid_now: false };

    // qty ไม่ระบุ = 1 (AI/ฟอร์มบางทีส่งมาแค่ชื่อ+ราคา) — ตัดทิ้งเฉพาะที่ตั้งใจใส่ 0/ติดลบ
    const items = (input.items ?? [])
      .filter((it) => it && String(it.name ?? "").trim() && (it.qty == null || Number(it.qty) > 0))
      .slice(0, 100)
      .map((it) => ({
        name: String(it.name).trim().slice(0, 300),
        qty: Math.max(0.01, Number(it.qty) || 1),
        unit: it.unit ? String(it.unit).slice(0, 30) : null,
        unit_price: Math.max(0, Number(it.unit_price) || 0),
        product_id: it.product_id || null,
      }));
    if (!items.length) return { ok: false, error: "ต้องมีรายการอย่างน้อย 1 บรรทัด" };

    // ⚠️ ด่านกันเอกสารยอด 0 — ห้ามถอดออก (บั๊กจริง 4 ส.ค. 2569)
    // ฟอร์มเดิมตรวจแค่ชื่อ+จำนวน ไม่ตรวจราคา ผู้ใช้ลืมใส่ราคาแล้วกดบันทึกได้
    // เอกสารถูกสร้างสำเร็จ แต่ตอนลงสมุดรายวันไม่มีบรรทัดให้ลง (ทุกยอดเป็น 0) จึงพัง
    // ผลคือเหลือเอกสารที่ไม่มีคู่บัญชีค้างในระบบ ตัวตรวจความถูกต้องขึ้นธงแดง
    // และผู้ใช้กดซ้ำเพราะไม่เข้าใจข้อความ error เลยได้เอกสารเสียหลายใบติดกัน
    //
    // ต้องกันฝั่ง server ด้วย ไม่ใช่แค่ฝั่งฟอร์ม เพราะผู้ช่วย AI ก็เรียกทางนี้เหมือนกัน
    // กันแค่หน้าจอ = ยังสร้างเอกสารเสียผ่านแชทได้อยู่
    if (!(items.reduce((a, it) => a + it.qty * it.unit_price, 0) > 0)) {
      return { ok: false, error: "ยอดรวมเป็น 0 — ต้องใส่ราคาอย่างน้อย 1 รายการ ระบบถึงลงบัญชีให้ได้" };
    }

    const vatMode: VatMode = ["none", "exclusive", "inclusive"].includes(String(input.vat_mode)) ? input.vat_mode! : "none";
    // จุดความรับผิด VAT: delivery = ทันที (ม.78 สินค้า) · payment = เมื่อรับเงิน (ม.78/1 บริการ)
    // ใช้ได้กับใบแจ้งหนี้ที่คิด VAT เท่านั้น — ขายสดรับเงินแล้วจึงไม่มีอะไรให้พัก
    const taxPoint = (input.tax_point === "payment" && input.doc_type === "invoice" && vatMode !== "none")
      ? "payment" : "delivery";
    const whtRate = Math.max(0, Math.min(15, Number(input.wht_rate) || 0));
    const issueDate = input.issue_date || bkkToday();

    // กันวันที่พิมพ์ผิดตั้งแต่ต้นทาง — บังคับฝั่งเซิร์ฟเวอร์ ทุกทางเขียนต้องผ่านตรงนี้
    // รวมถึงตอนผู้ช่วย AI อ่านบิลแล้วบันทึกให้เอง ซึ่งเป็นทางที่พลาดง่ายที่สุด
    if (docDateTooFarFuture(issueDate, bkkToday())) {
      return { ok: false, error: `วันที่ ${issueDate} อยู่ในอนาคตไกลเกินไป — ตรวจอีกครั้งว่าพิมพ์ปีถูกไหม (พ.ศ. 2569 = ค.ศ. 2026)` };
    }

    // อัตรา VAT ต้องมาจากตาราง vat_rates ตามวันที่ออกเอกสาร ไม่ใช่เลขที่ฮาร์ดโค้ดตอน deploy
    // พ.ร.ฎ.ลดอัตราเป็น 7% ต่ออายุเป็นรายปี ถ้าอัตราเปลี่ยนแล้วโค้ดยังใช้ค่าเดิม
    // เอกสารทุกใบหลังจากนั้นจะคิดภาษีผิด และแก้ย้อนหลังไม่ได้เพราะส่งให้ลูกค้าไปแล้ว
    const { data: rateRow } = await svc.rpc("vat_rate_on", { p_date: issueDate });
    const vatRate = Number(rateRow ?? 0.07);
    const t = calcDocTotals(items, Number(input.discount) || 0, vatMode, whtRate, vatRate);
    const status = input.status === "draft" ? "draft" : "awaiting";

    // snapshot ผู้ติดต่อ
    let contactName = String(input.contact_name ?? "").trim().slice(0, 200) || null;
    let contactTaxId: string | null = null, contactAddress: string | null = null, contactBranch: string | null = null;
    let recipientKind: string | null = null;
    if (input.contact_id) {
      const { data: c } = await svc.from("contacts").select("name,tax_id,address,branch,recipient_kind").eq("id", input.contact_id).eq("shop_id", shopId).maybeSingle();
      if (c) {
        contactName = c.name;
        contactTaxId = c.tax_id;
        contactAddress = c.address || null;
        // สาขาเก็บแยกช่อง ไม่ยัดต่อท้ายที่อยู่ — ใบกำกับภาษีต้องพิมพ์ "สำนักงานใหญ่/สาขาที่ NNNNN"
        // ในรูปแบบมาตรฐาน ถ้าปนอยู่ในที่อยู่จะจัดรูปแบบให้ถูกกฎหมายไม่ได้
        contactBranch = c.branch || null;
        // snapshot ไว้กับเอกสาร ถ้าคู่ค้าเปลี่ยนประเภททีหลัง เอกสารเก่าที่ยื่นไปแล้วต้องไม่เปลี่ยนตาม
        recipientKind = c.recipient_kind || guessRecipientKind(c.tax_id);
      }
    }

    // ⚠️ พิมพ์ชื่อเองแล้วต้องถูกเก็บเป็นผู้ติดต่อด้วย — เกิดจริง 4 ส.ค. 2569
    // เดิมชื่อที่พิมพ์เองถูกเก็บเป็นข้อความบนเอกสารเท่านั้น ไม่ได้สร้างผู้ติดต่อ
    // ผลคือ: ออกบิลให้เจ้าเดิม 5 ครั้ง ต้องพิมพ์ชื่อใหม่ทั้ง 5 ครั้ง ช่องเลือกยังว่างเปล่า
    // ซึ่งเป็นบ่อเกิดของการพิมพ์ผิด (ชื่อเพี้ยนกันคนละใบ = ยอดลูกหนี้แตกเป็นหลายราย)
    // และทำให้ใบกำกับภาษีไม่มีเลขผู้เสียภาษี/ที่อยู่ ซึ่งผิด ม.86/4
    //
    // เก็บให้อัตโนมัติ: มีชื่อเดิมอยู่แล้วใช้ซ้ำ (เทียบแบบไม่สนตัวพิมพ์เล็กใหญ่) ไม่มีค่อยสร้างใหม่
    // ล้มเหลวก็ไม่ทำให้การออกเอกสารพัง — การออกเอกสารสำคัญกว่าการเก็บรายชื่อ
    let autoContactId: string | null = null;
    if (!input.contact_id && contactName && input.status !== "draft") {
      try {
        const kind = input.doc_type === "expense" ? "vendor" : "customer";
        const { data: found } = await svc.from("contacts")
          .select("id").eq("shop_id", shopId).eq("status", "active")
          .in("kind", [kind, "both"]).ilike("name", contactName).limit(1).maybeSingle();
        if (found?.id) {
          autoContactId = found.id;
        } else {
          const { data: made } = await svc.from("contacts")
            .insert({ shop_id: shopId, kind, name: contactName, recipient_kind: guessRecipientKind(null) })
            .select("id").single();
          autoContactId = made?.id ?? null;
        }
      } catch { /* เก็บรายชื่อไม่สำเร็จก็ปล่อยผ่าน ห้ามบล็อกการออกเอกสาร */ }
    }

    const baseRow = {
      shop_id: shopId,
      doc_type: input.doc_type,
      contact_id: input.contact_id || autoContactId || null,
      contact_name: contactName,
      contact_tax_id: contactTaxId,
      contact_address: contactAddress,
      contact_branch: contactBranch,
      recipient_kind: recipientKind,
      tax_point: taxPoint,
      issue_date: issueDate,
      due_date: input.due_date || null,
      category_id: input.doc_type === "expense" ? (input.category_id || null) : null,
      // ปัดเศษก่อนเก็บเสมอ — จำนวนเงินในระบบบัญชีต้องเป็นทศนิยม 2 ตำแหน่ง
      // ถ้าเก็บค่าดิบ (เช่น 3 x 33.333 = 99.999) รายงานที่บวกยอดหลายใบจะเพี้ยนสะสม
      subtotal: Math.round((t.base + (Number(input.discount) || 0)) * 100) / 100,
      discount: Number(input.discount) || 0,
      vat_mode: vatMode, vat_amount: t.vat,
      wht_rate: whtRate, wht_amount: t.wht,
      // รับเฉพาะรหัสที่รู้จักจริง กัน client ยัดค่ามั่วเข้าไฟล์ยื่นสรรพากร
      wht_income_type: whtRate > 0
        ? (WHT_INCOME_TYPES.some((x) => x.code === input.wht_income_type) ? input.wht_income_type! : DEFAULT_WHT_INCOME)
        : null,
      total: t.total,
      status,
      source: input.source ?? "manual",
      file_path: input.file_path || null,
      ref_doc_id: input.ref_doc_id || null,
      notes: String(input.notes ?? "").trim().slice(0, 1000) || null,
      approval_status: needsApproval ? "pending" : "none",
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

    // ไฟล์แนบทั้งหมด (ใบแรกอยู่ใน file_path อยู่แล้ว) — เขียนใหม่ทุกครั้งให้ตรงกับที่ผู้ใช้เห็นบนฟอร์ม
    const allFiles = [input.file_path, ...(input.extra_files ?? [])].filter((p): p is string => !!p);
    await svc.from("fin_doc_files").delete().eq("doc_id", docId);
    if (allFiles.length) {
      await svc.from("fin_doc_files").insert(allFiles.map((path) => ({ doc_id: docId, shop_id: shopId, path })));
    }

    // ---- ออกเอกสารจริง (ไม่ใช่ร่าง) -> ลงบัญชี + ตัดสต๊อก ----
    if (status === "awaiting") {
      const isConvertedReceipt = input.doc_type === "receipt" && !!input.ref_doc_id; // ใบเสร็จจากใบแจ้งหนี้ = เงินลงบัญชีตอนรับชำระแล้ว
      const cashAcc = input.pay_method === "cash" ? ACC.CASH : ACC.BANK;

      if (input.doc_type === "invoice") {
        // งานบริการที่ขายเชื่อ (tax_point = payment): ความรับผิด VAT ยังไม่เกิดตาม ม.78/1
        // จึงพักไว้ที่ 2035 ภาษีขายยังไม่ถึงกำหนด แล้วย้ายเข้า 2030 ตอนรับเงินจริง
        // รายได้ยังรับรู้ทันทีตามเกณฑ์คงค้าง — ผิดเฉพาะฝั่งภาษีขายเท่านั้นถ้าลง 2030 เลย
        const vatAcc = taxPoint === "payment" ? ACC.VAT_OUT_DEFERRED : ACC.VAT_OUT;
        await postJournalOrThrow(svc, shopId, user.id, {
          date: issueDate,
          memo: `ขายเชื่อ ${docNumber}${contactName ? ` — ${contactName}` : ""}${taxPoint === "payment" ? " (ภาษีขายรอรับชำระ)" : ""}`,
          sourceType: "sale", sourceId: docId,
          lines: [
            { code: ACC.AR, debit: t.total },
            { code: ACC.SALES, credit: t.exVat },
            { code: vatAcc, credit: t.vat },
          ],
        });
        await cutStockAndCogs(svc, shopId, user.id, docId, docNumber, items, issueDate);
      } else if (input.doc_type === "receipt" && !isConvertedReceipt) {
        // ขายสด: เงินเข้าทันที
        await postJournalOrThrow(svc, shopId, user.id, {
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
          await postJournalOrThrow(svc, shopId, user.id, {
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
          await postJournalOrThrow(svc, shopId, user.id, {
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

    await audit(svc, shopId, user.id, input.id ? "fin_doc_updated" : "fin_doc_created", "fin_doc", docId, { doc_number: docNumber, doc_type: input.doc_type, total: t.total, status, approval: needsApproval ? "pending" : undefined });
    if (needsApproval) {
      await notifyShopLine(svc, shopId,
        `🔔 มีค่าใช้จ่ายรออนุมัติ\n${docNumber}${contactName ? ` — ${contactName}` : ""}\nยอด ${t.total.toLocaleString()} บาท\nอนุมัติได้ที่ /dashboard/expenses/${docId}`);
    }
    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard");
    return { ok: true, docId, docNumber, approvalPending: needsApproval };
  } catch (e) {
    return { ok: false, error: friendly(e, "บันทึกเอกสารไม่สำเร็จ") };
  }
}

/** อนุมัติค่าใช้จ่ายที่พนักงานส่งมา -> ตั้งหนี้ลงสมุดรายวันตอนนี้ (อนุมัติก่อน ค่อยทำจ่าย) */
export async function approveExpense(shopId: string, docId: string): Promise<ActionResult> {
  try {
    const { user } = await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    const { data: doc } = await svc.from("fin_docs").select("*").eq("id", docId).eq("shop_id", shopId).eq("doc_type", "expense").maybeSingle();
    if (!doc) return { ok: false, error: "ไม่พบเอกสาร" };
    if (doc.approval_status !== "pending") return { ok: false, error: "เอกสารนี้ไม่ได้อยู่ในสถานะรออนุมัติ" };

    let expAcc: string = ACC.OTHER_EXPENSE;
    if (doc.category_id) {
      const { data: cat } = await svc.from("expense_categories").select("account_code").eq("id", doc.category_id).eq("shop_id", shopId).maybeSingle();
      if (cat?.account_code) expAcc = cat.account_code;
    }
    // ต้องใช้ total - vat เท่านั้น — subtotal-discount ถูกเฉพาะโหมด "บวก VAT"
    // โหมด "ราคารวม VAT แล้ว" (บิลร้านค้าไทยส่วนใหญ่) ค่านั้นจะเท่ากับ total พอดี
    // ทำให้เดบิต = total + VAT แต่เครดิต = total -> ไม่สมดุล -> ลงบัญชีไม่ผ่าน
    // เดิมทิ้งผลลัพธ์ทิ้ง จึงอนุมัติสำเร็จแต่ค่าใช้จ่ายหายจากบัญชีทั้งก้อน
    const exVat = Math.round((Number(doc.total) - Number(doc.vat_amount)) * 100) / 100;
    await postJournalOrThrow(svc, shopId, user.id, {
      date: doc.issue_date, memo: `ตั้งหนี้ค่าใช้จ่าย ${doc.doc_number}${doc.contact_name ? ` — ${doc.contact_name}` : ""} (อนุมัติแล้ว)`,
      sourceType: "expense", sourceId: docId,
      lines: [
        { code: expAcc, debit: exVat },
        { code: ACC.VAT_IN, debit: Number(doc.vat_amount) },
        { code: ACC.AP, credit: Number(doc.total) },
      ],
    });
    await svc.from("fin_docs").update({
      status: "awaiting", approval_status: "approved",
      approval_by: user.id, approval_at: new Date().toISOString(), approval_note: null,
      updated_at: new Date().toISOString(),
    }).eq("id", docId);
    await audit(svc, shopId, user.id, "expense_approved", "fin_doc", docId, { doc_number: doc.doc_number, total: doc.total });
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "อนุมัติไม่สำเร็จ") };
  }
}

/** ปฏิเสธค่าใช้จ่ายที่รออนุมัติ — เอกสารคงเป็นร่าง พนักงานแก้แล้วส่งใหม่ได้ */
export async function rejectExpense(shopId: string, docId: string, reason: string): Promise<ActionResult> {
  try {
    const { user } = await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    const { data: doc } = await svc.from("fin_docs").select("id,doc_number,approval_status").eq("id", docId).eq("shop_id", shopId).eq("doc_type", "expense").maybeSingle();
    if (!doc) return { ok: false, error: "ไม่พบเอกสาร" };
    if (doc.approval_status !== "pending") return { ok: false, error: "เอกสารนี้ไม่ได้อยู่ในสถานะรออนุมัติ" };
    await svc.from("fin_docs").update({
      approval_status: "rejected", approval_by: user.id, approval_at: new Date().toISOString(),
      approval_note: String(reason ?? "").trim().slice(0, 300) || null,
      updated_at: new Date().toISOString(),
    }).eq("id", docId);
    await audit(svc, shopId, user.id, "expense_rejected", "fin_doc", docId, { doc_number: doc.doc_number, reason });
    revalidatePath("/dashboard/expenses");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "ปฏิเสธไม่สำเร็จ") };
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

// ============================================================
//  ใบลดหนี้ (ม.86/10) · ใบเพิ่มหนี้ (ม.86/9)
//
//  ใช้เมื่อขายไปแล้วและออกใบกำกับภาษีให้ผู้ซื้อไปแล้ว แต่มูลค่าเปลี่ยน
//  (คืนของ ลดราคา คำนวณราคาผิด ส่งของเพิ่ม)
//
//  ทำไมต้องเป็นเอกสารใหม่ ไม่ใช่แก้ใบเดิม:
//  ใบเดิมอยู่ในมือผู้ซื้อและถูกยื่น ภ.พ.30 ไปแล้ว แก้ย้อนหลังไม่ได้ตามกฎหมาย
//  กฎหมายกำหนดให้ออกใบลดหนี้/ใบเพิ่มหนี้ "ในเดือนที่เหตุเกิด"
//  ซึ่งพอดีกับกติกาล็อกงวดของระบบ — ลงงวดปัจจุบันได้เสมอ ไม่ต้องปลดล็อก
// ============================================================
export interface NoteInput {
  origin_doc_id: string;
  kind: "credit_note" | "debit_note";
  reason: string;
  items: { name: string; qty: number; unit?: string; unit_price: number }[];
  /** ตัดกับลูกหนี้ (ปกติ) หรือคืนเงินให้ลูกค้าจริง */
  settle?: "ar" | "cash" | "bank";
  issue_date?: string;
  notes?: string;
}

export async function issueCreditDebitNote(shopId: string, input: NoteInput): Promise<DocResult> {
  try {
    const { user } = await assertMember(shopId, ["owner", "admin", "agent"]);
    const svc = createServiceClient();

    const { data: originRaw } = await svc.from("fin_docs")
      .select("*").eq("id", input.origin_doc_id).eq("shop_id", shopId).maybeSingle();
    if (!originRaw) return { ok: false, error: "ไม่พบใบกำกับภาษีต้นทาง" };
    const origin = originRaw as unknown as FinDoc;

    if (!["invoice", "receipt"].includes(origin.doc_type)) {
      return { ok: false, error: "ออกใบลดหนี้/ใบเพิ่มหนี้ได้จากใบแจ้งหนี้หรือใบเสร็จเท่านั้น" };
    }
    if (origin.status === "void") return { ok: false, error: "ใบต้นทางถูกยกเลิกไปแล้ว" };
    if (origin.status === "draft") return { ok: false, error: "ใบต้นทางยังเป็นร่าง ให้แก้ใบเดิมได้เลย ไม่ต้องออกใบลดหนี้" };
    if (origin.vat_mode === "none") {
      return { ok: false, error: "ใบต้นทางไม่ได้คิด VAT จึงไม่เข้าเงื่อนไขใบลดหนี้/ใบเพิ่มหนี้ตามกฎหมาย" };
    }

    const reason = String(input.reason ?? "").trim().slice(0, 300);
    if (reason.length < 5) return { ok: false, error: "ต้องระบุเหตุผล — กฎหมายบังคับให้พิมพ์เหตุผลบนเอกสาร" };

    const items = (input.items ?? [])
      .filter((it) => String(it.name ?? "").trim() && Number(it.unit_price) > 0)
      .map((it) => ({
        name: String(it.name).trim().slice(0, 300),
        qty: Math.max(0.01, Number(it.qty) || 1),
        unit: it.unit ? String(it.unit).slice(0, 30) : null,
        unit_price: Math.max(0, Number(it.unit_price) || 0),
      }));
    if (!items.length) return { ok: false, error: "ต้องมีรายการอย่างน้อย 1 บรรทัด" };

    // กันยอด 0 แบบเดียวกับ saveDoc — ใบลดหนี้/เพิ่มหนี้ยอด 0 ก็ลงบัญชีไม่ได้เหมือนกัน
    // และผิดกฎหมายด้วย เพราะ ม.86/9-86/10 บังคับให้ระบุ "มูลค่าที่ลด/เพิ่ม" ซึ่ง 0 ไม่ใช่การลด/เพิ่ม
    if (!(items.reduce((a, it) => a + it.qty * it.unit_price, 0) > 0)) {
      return { ok: false, error: "ยอดที่ลด/เพิ่มเป็น 0 — ต้องใส่ราคาอย่างน้อย 1 รายการ" };
    }

    // ⚠️ ต้องใช้อัตรา VAT ของ "ใบเดิม" ไม่ใช่อัตราวันนี้
    // ใบลดหนี้ไปหักยอดที่เคยเสียภาษีในอัตราเดิม ถ้าใช้อัตราใหม่ ภาษีที่หักออกจะไม่เท่าที่เคยเสีย
    // เรื่องนี้จะเห็นผลจริงถ้าอัตราเปลี่ยนหลัง 30 ก.ย. 2569
    const { data: rateRow } = await svc.rpc("vat_rate_on", { p_date: origin.issue_date });
    const vatRate = Number(rateRow ?? 0.07);
    const t = calcDocTotals(items, 0, origin.vat_mode, 0, vatRate);

    // ลดเกินยอดใบเดิมไม่ได้ — เป็นสัญญาณว่ากรอกผิด และจะทำให้ภาษีขายติดลบเกินจริง
    if (input.kind === "credit_note" && t.total > Number(origin.total) + 0.004) {
      return { ok: false, error: `ยอดใบลดหนี้ (${t.total.toLocaleString()}) เกินยอดใบเดิม (${Number(origin.total).toLocaleString()}) — ตรวจรายการอีกครั้ง` };
    }

    const issueDate = input.issue_date || bkkToday();

    // กันวันที่พิมพ์ผิดตั้งแต่ต้นทาง — บังคับฝั่งเซิร์ฟเวอร์ ทุกทางเขียนต้องผ่านตรงนี้
    // รวมถึงตอนผู้ช่วย AI อ่านบิลแล้วบันทึกให้เอง ซึ่งเป็นทางที่พลาดง่ายที่สุด
    if (docDateTooFarFuture(issueDate, bkkToday())) {
      return { ok: false, error: `วันที่ ${issueDate} อยู่ในอนาคตไกลเกินไป — ตรวจอีกครั้งว่าพิมพ์ปีถูกไหม (พ.ศ. 2569 = ค.ศ. 2026)` };
    }
    // ออกย้อนไปก่อนใบเดิมไม่ได้ เหตุต้องเกิดหลังการขาย
    if (issueDate < origin.issue_date) {
      return { ok: false, error: "วันที่ต้องไม่ก่อนวันที่ของใบกำกับภาษีเดิม" };
    }

    const { data: num, error: numErr } = await svc.rpc("next_fin_doc_number", { p_shop_id: shopId, p_doc_type: input.kind });
    if (numErr || !num) return { ok: false, error: numErr?.message ?? "ออกเลขเอกสารไม่สำเร็จ" };
    const docNumber = num as string;

    const { data: doc, error } = await svc.from("fin_docs").insert({
      shop_id: shopId, doc_type: input.kind, doc_number: docNumber,
      // สำเนาตัวตนผู้ซื้อจากใบเดิม กฎหมายบังคับให้ใบลดหนี้มีข้อมูลผู้ซื้อครบเหมือนใบกำกับภาษี
      contact_id: origin.contact_id, contact_name: origin.contact_name,
      contact_tax_id: origin.contact_tax_id, contact_address: origin.contact_address,
      contact_branch: origin.contact_branch, recipient_kind: origin.recipient_kind,
      issue_date: issueDate, due_date: null,
      subtotal: t.base, discount: 0,
      vat_mode: origin.vat_mode, vat_amount: t.vat,
      wht_rate: 0, wht_amount: 0,
      total: t.total, paid_amount: 0,
      status: "awaiting", source: "manual",
      ref_doc_id: origin.id,
      note_reason: reason,
      notes: String(input.notes ?? "").trim().slice(0, 1000) || null,
      created_by: user.id, updated_at: new Date().toISOString(),
    }).select("id").single();
    if (error || !doc) return { ok: false, error: error?.message ?? "สร้างเอกสารไม่สำเร็จ" };

    const { error: itemErr } = await svc.from("fin_doc_items").insert(items.map((it, i) => ({
      doc_id: doc.id, shop_id: shopId, name: it.name, qty: it.qty, unit: it.unit,
      unit_price: it.unit_price, amount: Math.round(it.qty * it.unit_price * 100) / 100, sort: i,
    })));
    if (itemErr) return { ok: false, error: itemErr.message };

    const settleAcc = input.settle === "cash" ? ACC.CASH : input.settle === "bank" ? ACC.BANK : ACC.AR;

    if (input.kind === "credit_note") {
      // ไม่หักออกจากบัญชีขาย (4010) ตรง ๆ แต่ลงบัญชีหักรายได้แยก (4090)
      // เพื่อให้งบกำไรขาดทุนเห็นว่ามีการรับคืน/ลดราคาเท่าไหร่ ซึ่งเป็นข้อมูลที่ผู้บริหารต้องเห็น
      await postJournalOrThrow(svc, shopId, user.id, {
        date: issueDate, memo: `ใบลดหนี้ ${docNumber} อ้าง ${origin.doc_number} — ${reason}`,
        sourceType: "sale", sourceId: doc.id,
        lines: [
          { code: ACC.SALES_RETURN, debit: t.exVat },
          { code: ACC.VAT_OUT, debit: t.vat },
          { code: settleAcc, credit: t.total },
        ],
      });
    } else {
      await postJournalOrThrow(svc, shopId, user.id, {
        date: issueDate, memo: `ใบเพิ่มหนี้ ${docNumber} อ้าง ${origin.doc_number} — ${reason}`,
        sourceType: "sale", sourceId: doc.id,
        lines: [
          { code: settleAcc === ACC.AR ? ACC.AR : settleAcc, debit: t.total },
          { code: ACC.SALES, credit: t.exVat },
          { code: ACC.VAT_OUT, credit: t.vat },
        ],
      });
    }

    await audit(svc, shopId, user.id, input.kind === "credit_note" ? "credit_note_issued" : "debit_note_issued",
      "fin_doc", doc.id, { doc_number: docNumber, origin: origin.doc_number, reason, total: t.total });

    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/journal");
    return { ok: true, docId: doc.id, docNumber };
  } catch (e) {
    return { ok: false, error: friendly(e, "ออกเอกสารไม่สำเร็จ") };
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
    let quotaNote: string | null = null;
    if (input.slip_path && input.direction === "in") {
      // ตรวจรวมศูนย์เหมือน route สาธารณะ: คีย์ร้านมาก่อน ไม่มีก็ใช้คีย์กลางแพลตฟอร์ม
      const [{ data: pay }, { data: shopSlipKey }, { data: slipQuota }, { data: pfRow }, { data: pfKey }] = await Promise.all([
        svc.from("shop_payment_settings").select("slip_provider").eq("shop_id", shopId).maybeSingle(),
        svc.rpc("get_shop_slip_key", { p_shop_id: shopId }),
        svc.rpc("check_slip_quota", { p_shop_id: shopId }),
        svc.from("platform_billing_settings").select("slip_provider").eq("id", true).maybeSingle(),
        svc.rpc("get_platform_slip_key"),
      ]);
      const shopReady = !!pay?.slip_provider && pay.slip_provider !== "manual" && !!shopSlipKey;
      const pfReady = !!pfRow?.slip_provider && pfRow.slip_provider !== "manual" && !!pfKey;
      const provider = shopReady ? pay!.slip_provider : pfReady ? pfRow!.slip_provider : null;
      const slipKey = shopReady ? shopSlipKey : pfReady ? pfKey : null;
      const sq = slipQuota as { allowed?: boolean; used?: number; cap?: number } | null;
      // fail-closed: เช็คโควตาไม่ได้ = ไม่เรียก API (การบันทึกรับเงินเดินต่อปกติ แค่ไม่ตรวจอัตโนมัติ)
      if (!sq || sq.allowed !== true) {
        quotaNote = sq && sq.allowed === false
          ? `โควตาตรวจสลิปอัตโนมัติเดือนนี้ครบแล้ว (${sq.used}/${sq.cap}) — บันทึกแบบตรวจเอง หรืออัปเกรดแพ็กเกจเพื่อตรวจอัตโนมัติต่อ`
          : "ระบบตรวจสลิปอัตโนมัติไม่พร้อมชั่วคราว — บันทึกแบบตรวจเอง";
      } else if (provider && slipKey) {
        const { data: file } = await svc.storage.from("slips").download(input.slip_path);
        if (file) {
          verify = await verifySlip(provider as string, slipKey as string, new Uint8Array(await file.arrayBuffer()));
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
        .select("id,doc_number,doc_type,total,wht_amount,paid_amount,contact_name,status,tax_point,vat_amount")
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
        : quotaNote,
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
      await postJournalOrThrow(svc, shopId, user.id, {
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

    // ตรวจสลิป (ภายใต้โควตาตรวจสลิปของแพ็กเกจ — นับรวมทุกกิจการของเจ้าของ)
    // รวมศูนย์เหมือน route สาธารณะ: คีย์ร้านมาก่อน ไม่มีก็ใช้คีย์กลางแพลตฟอร์ม
    let verify: SlipResult | null = null;
    const [{ data: pay }, { data: shopSlipKey }, { data: slipQuota }, { data: pfRow }, { data: pfKey }] = await Promise.all([
      svc.from("shop_payment_settings").select("slip_provider").eq("shop_id", shopId).maybeSingle(),
      svc.rpc("get_shop_slip_key", { p_shop_id: shopId }),
      svc.rpc("check_slip_quota", { p_shop_id: shopId }),
      svc.from("platform_billing_settings").select("slip_provider").eq("id", true).maybeSingle(),
      svc.rpc("get_platform_slip_key"),
    ]);
    const shopReady = !!pay?.slip_provider && pay.slip_provider !== "manual" && !!shopSlipKey;
    const pfReady = !!pfRow?.slip_provider && pfRow.slip_provider !== "manual" && !!pfKey;
    const provider = shopReady ? pay!.slip_provider : pfReady ? pfRow!.slip_provider : null;
    const slipKey = shopReady ? shopSlipKey : pfReady ? pfKey : null;
    const sq = slipQuota as { allowed?: boolean; used?: number; cap?: number } | null;
    // fail-closed: เช็คโควตาไม่ได้ = ไม่เรียก API — ผู้ใช้ยังเลือกจับคู่เอกสารเองได้เสมอ
    if (!sq || sq.allowed !== true) {
      verify = {
        ok: true, verified: false,
        error: sq && sq.allowed === false
          ? `โควตาตรวจสลิปเดือนนี้ครบแล้ว (${sq.used}/${sq.cap}) — เลือกเอกสารเองด้านล่าง หรืออัปเกรดแพ็กเกจ`
          : "ระบบตรวจสลิปอัตโนมัติไม่พร้อมชั่วคราว — เลือกเอกสารเองด้านล่าง",
      };
    } else if (provider && slipKey) {
      const { data: file } = await svc.storage.from("slips").download(up.path);
      if (file) verify = await verifySlip(provider as string, slipKey as string, new Uint8Array(await file.arrayBuffer()));
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
    const r = await postJournalOrThrow(svc, shopId, user.id, {
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : bkkToday(),
      memo: memo.trim().slice(0, 500) || "บันทึกรายวันทั่วไป",
      sourceType: "manual",
      lines,
    });
    // postJournalOrThrow โยน error เองถ้าไม่สำเร็จ — try/catch ด้านล่างแปลงเป็นข้อความให้ผู้ใช้
    await audit(svc, shopId, user.id, "journal_manual_added", "journal_entry", r.entryId, { entry_number: r.entryNumber });
    revalidatePath("/dashboard/journal");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "บันทึกสมุดรายวันไม่สำเร็จ") };
  }
}
