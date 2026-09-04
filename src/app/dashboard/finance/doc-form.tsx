"use client";
import { compressImage } from "@/lib/compress-image";
// ============================================================
//  ฟอร์มเอกสารกลาง — ใบเสนอราคา/ใบแจ้งหนี้/ใบเสร็จ/ค่าใช้จ่าย
//  คำนวณ VAT (แยกนอก/รวมใน) + หัก ณ ที่จ่าย สดทุกครั้งที่พิมพ์
//  ค่าใช้จ่าย: แนบรูปบิลแล้วให้ AI อ่านกรอกให้ทั้งฟอร์มได้
// ============================================================
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ScanLine, Paperclip, TriangleAlert, History } from "lucide-react";
import { Button, Card, CardContent, Input, Label, Select, Textarea } from "@/components/ui";
import { baht, bahtDoc, cn } from "@/lib/utils";
import { calcDocTotals, DOC_TYPE_TH, WHT_RATES } from "@/lib/finance";
import DocPreview, { type PreviewSeller, type PreviewEdit } from "./doc-preview";
import { WHT_INCOME_TYPES, WHT_PRESETS, DEFAULT_WHT_INCOME, WHT_MIN_PAYMENT, belowWhtThreshold, whtRateMismatch } from "@/lib/tax-th";
import type { DocType, VatMode, ExpenseCategory, Contact, FinDoc } from "@/lib/types/finance";
import { saveDoc, uploadFinFile, type SaveDocInput } from "./actions";
import { VAT_LABEL, vatPercentLabelOf } from "@/lib/tax-th";
import DateField from "@/components/date-field";
import { useToast } from "@/components/toast";

interface ProductLite { id: string; name: string; price: number; stock: number; track_stock: boolean }
interface Row { name: string; qty: string; unit: string; unit_price: string; product_id: string | null }

export interface DocFormProps {
  shopId: string;
  /** ข้อมูลกิจการผู้ขาย — มีเมื่อไหร่ปุ่ม "ดูตัวอย่าง" จะโผล่ (ฝั่งขายเท่านั้น) */
  seller?: PreviewSeller;
  docType: DocType;
  contacts: Contact[];
  products?: ProductLite[];
  categories?: ExpenseCategory[];
  draft?: FinDoc;                 // แก้ไขร่าง
  initialContactId?: string;      // มาจากหน้าผู้ติดต่อ (ปุ่ม "ออกเอกสารให้รายนี้") — เติมคู่ค้าให้เลย
}

const emptyRow = (): Row => ({ name: "", qty: "1", unit: "", unit_price: "", product_id: null });

export default function DocForm({ shopId, seller, docType: initialDocType, contacts, products = [], categories = [], draft, initialContactId }: DocFormProps) {
  // ประเภทเอกสารสลับได้ในฟอร์ม (เฉพาะฝั่งขาย ไม่ใช่ตอนแก้ร่าง)
  // เดิมล็อกจาก ?type= ใน URL อย่างเดียว: เข้ามาแล้วไม่เห็นและเปลี่ยนไม่ได้ว่ากำลังออกใบอะไร
  // เจ้าของ + ลูกค้าจริงถามตรงกัน (2 ส.ค. 2569): "ใบเสนอราคากับใบแจ้งหนี้ทำไมต้องอันเดียวกัน"
  // ทุกเงื่อนไขในฟอร์มอ่านค่านี้ตอน render อยู่แล้ว (ป้ายวันครบกำหนด/จุดภาษี/ปุ่มบันทึก)
  // จึงสลับได้โดยไม่เสียข้อมูลที่พิมพ์ไว้
  const [docType, setDocType] = useState<DocType>(initialDocType);
  const isExpense = docType === "expense";
  const contactKind = isExpense ? "vendor" : "customer";
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // ตีกรอบแดงที่ช่องรายการที่ยังว่าง — โชว์หลังกดบันทึกครั้งแรกเท่านั้น
  // (ไม่ตีแดงตั้งแต่เปิดฟอร์ม ฟอร์มเปล่าที่แดงทั้งใบทำให้คนกลัวมากกว่าช่วย)
  const [showRowErrors, setShowRowErrors] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const rowsRef = useRef<HTMLDivElement>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiWarn, setAiWarn] = useState<string[]>([]);
  // ความมั่นใจ + เหตุผลของ AI — ผลตรวจ 28 ส.ค. 2569: บอกแค่ผลไม่พอ ต้องบอกว่ามั่นใจแค่ไหน
  // และตัดสินใจจากอะไร ผู้ใช้ถึงจะกล้ากด "บันทึก" กับเงินจริง
  const [aiMeta, setAiMeta] = useState<{ confidence?: number; reason?: string } | null>(null);   // จุดที่ AI อ่านไม่ชัด/ยอดไม่ลงตัว — ให้คนตรวจก่อนบันทึก
  const [ocrTotal, setOcrTotal] = useState<number | null>(null); // ยอดรวมที่ AI อ่านได้จากท้ายบิล

  const [rows, setRows] = useState<Row[]>(
    draft?.fin_doc_items?.length
      ? draft.fin_doc_items.map((it) => ({ name: it.name, qty: String(it.qty), unit: it.unit ?? "", unit_price: String(it.unit_price), product_id: it.product_id ?? null }))
      : [emptyRow()],
  );
  const [contactId, setContactId] = useState(draft?.contact_id ?? initialContactId ?? "");
  const [contactName, setContactName] = useState(draft?.contact_name ?? "");
  const [discount, setDiscount] = useState(draft ? String(draft.discount || "") : "");
  const [vatMode, setVatMode] = useState<VatMode>(draft?.vat_mode ?? "none");
  // จุดความรับผิด VAT — ใช้เฉพาะใบแจ้งหนี้ที่คิด VAT (ขายสดรับเงินแล้วจึงไม่มีอะไรให้พัก)
  const [taxPoint, setTaxPoint] = useState<"delivery" | "payment">(
    (draft?.tax_point as "delivery" | "payment" | undefined) ?? "delivery");
  const [whtRate, setWhtRate] = useState(draft ? String(draft.wht_rate || 0) : "0");
  const [incomeType, setIncomeType] = useState(draft?.wht_income_type ?? DEFAULT_WHT_INCOME);
  const [issueDate, setIssueDate] = useState(draft?.issue_date ?? new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(draft?.due_date ?? "");
  const [categoryId, setCategoryId] = useState(draft?.category_id ?? "");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [paidNow, setPaidNow] = useState(isExpense);
  const [payMethod, setPayMethod] = useState("transfer");
  // แนบได้หลายใบ (บิลหลายหน้า / บิล+สลิป) — ผู้ใช้แจ้งว่าเลือกได้ใบเดียวไม่พอ
  // ใบแรกเก็บลง fin_docs.file_path (ของเดิม) ที่เหลือลงตาราง fin_doc_files
  const [files, setFiles] = useState<{ path: string; name: string }[]>(
    draft?.file_path ? [{ path: draft.file_path, name: "ไฟล์แนบเดิม" }] : [],
  );
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- กู้งานที่พิมพ์ค้าง (draft recovery) ----------------------------------
  // ผลตรวจ 28 ส.ค. 2569: "ปิดแอปกลางคันกลับมาแล้วยังอยู่ที่เดิม" — ฟอร์มนี้คือจุดที่
  // คนพิมพ์นานที่สุด (หลายรายการ + เลขภาษี) ปิดแท็บทีเดียวหายหมดคือเหตุให้เลิกใช้จริง
  // เก็บใน localStorage ของเครื่องผู้ใช้เท่านั้น ไม่แตะ server และล้างทันทีที่บันทึกสำเร็จ
  // ใช้เฉพาะตอนสร้างใหม่ — แก้ร่างเดิมมีข้อมูลใน DB อยู่แล้ว ไม่ต้องซ้อน
  const draftKey = draft?.id ? null : `docdraft:${shopId}:${initialDocType}`;
  interface SavedDraft {
    docType: DocType; rows: Row[]; contactId: string; contactName: string; discount: string;
    vatMode: VatMode; whtRate: string; incomeType: string; issueDate: string; dueDate: string;
    categoryId: string; notes: string;
  }
  const [restoreOffer, setRestoreOffer] = useState<SavedDraft | null>(null);
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const sv = JSON.parse(raw) as SavedDraft;
      if (sv && Array.isArray(sv.rows) && (sv.rows.some((r) => r.name?.trim()) || sv.contactName)) setRestoreOffer(sv);
      else localStorage.removeItem(draftKey);
    } catch { /* อ่านไม่ได้ = ไม่มีอะไรให้กู้ ห้ามทำฟอร์มพัง */ }
    // ตั้งใจอ่านครั้งเดียวตอนเปิดฟอร์ม
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // หยุดเซฟระหว่างแถบกู้ยังเปิดอยู่ — ไม่งั้นการพิมพ์ใหม่จะทับของที่รอกู้ก่อนผู้ใช้ตัดสินใจ
    if (!draftKey || restoreOffer) return;
    const has = rows.some((r) => r.name.trim() || r.unit_price) || contactName.trim() || notes.trim();
    try {
      if (has) localStorage.setItem(draftKey, JSON.stringify({
        docType, rows, contactId, contactName, discount, vatMode, whtRate, incomeType,
        issueDate, dueDate, categoryId, notes,
      } satisfies SavedDraft));
      else localStorage.removeItem(draftKey);
    } catch { /* พื้นที่เต็ม/โหมดส่วนตัว — ยอมไม่เซฟ ดีกว่าโยน error ใส่ผู้ใช้ */ }
  }, [draftKey, restoreOffer, docType, rows, contactId, contactName, discount, vatMode, whtRate, incomeType, issueDate, dueDate, categoryId, notes]);
  function applyRestore(sv: SavedDraft) {
    setDocType(sv.docType); setRows(sv.rows.length ? sv.rows : [emptyRow()]);
    setContactId(sv.contactId); setContactName(sv.contactName); setDiscount(sv.discount);
    setVatMode(sv.vatMode); setWhtRate(sv.whtRate); setIncomeType(sv.incomeType);
    setIssueDate(sv.issueDate); setDueDate(sv.dueDate); setCategoryId(sv.categoryId); setNotes(sv.notes);
    setRestoreOffer(null);
  }

  const totals = useMemo(() => calcDocTotals(
    rows.map((r) => ({ qty: Number(r.qty) || 0, unit_price: Number(r.unit_price) || 0 })),
    Number(discount) || 0, vatMode, Number(whtRate) || 0,
  ), [rows, discount, vatMode, whtRate]);

  // ---- ตัวจับผิด OCR ----------------------------------------------------
  // ไม่มี OCR ตัวไหนในโลกอ่านกระดาษถูก 100% (บิลยับ ปากกาเขียนทับ กระดาษความร้อนจาง)
  // สิ่งที่ทำได้จริงคือ "จับให้เจอก่อนลงบัญชี": เอายอดท้ายบิลที่ AI อ่านได้
  // มาทานกับผลรวมที่ฟอร์มคำนวณเองจากรายการ ถ้าไม่ตรงเกิน 1 บาท = มีตัวเลขอ่านผิดแน่นอน
  // เกณฑ์ 0.05 บาท (5 สตางค์): เดิมตั้งไว้ 1 บาทซึ่งหลวมเกินไป — 1 บาทคือเงินจริง
  // ที่ยอมให้ต่างได้เล็กน้อยเพราะระบบของผู้ขายแต่ละเจ้าปัดเศษ VAT ไม่เหมือนกัน
  // ต่างได้ 1-2 สตางค์ถือปกติ เกินกว่านั้นแปลว่ามีตัวเลขอ่านผิดจริง
  const ocrMismatch = useMemo(() => {
    if (ocrTotal == null) return null;
    const diff = Math.round(Math.abs(totals.total - ocrTotal) * 100) / 100;
    return diff > 0.05 ? { diff, ocrTotal } : null;
  }, [ocrTotal, totals.total]);

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function pickProduct(i: number, name: string) {
    const p = products.find((x) => x.name === name);
    if (p) setRow(i, { name: p.name, unit_price: String(p.price), product_id: p.id });
    else setRow(i, { name, product_id: null });
  }

  /**
   * เลือกจากช่อง select — ยึด id ไม่ใช่ชื่อ
   *
   * ⚠️ ต้องตั้ง product_id ให้ถูก ไม่ใช่แค่เติมชื่อกับราคา
   * ฝั่งเซิร์ฟเวอร์ใช้ product_id ตัดสินว่าจะตัดสต๊อกและลงต้นทุนขายให้ไหม
   * (actions.ts: ถ้า product_id ว่างจะ continue ข้ามไปเลย)
   * เลือกสินค้าแล้วสต๊อกไม่ลด = ของในคลังไม่ตรงจริงและงบกำไรขาดทุนไม่มีต้นทุน
   */
  function pickProductById(i: number, id: string) {
    if (!id) { setRow(i, { product_id: null }); return; }
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setRow(i, { name: p.name, unit_price: String(p.price), product_id: p.id });
  }

  async function attachFile(fRaw: File, runAi: boolean) {
    setError(null);
    setAiBusy(true); // เปิด spinner ก่อนเริ่มบีบอัด — กันผู้ใช้คิดว่าเว็บค้าง
    const f = await compressImage(fRaw);
    const fd = new FormData();
    fd.append("file", f);
    if (runAi) {
      // ให้ AI อ่านบิล -> กรอกฟอร์ม (อัปโหลดเก็บไฟล์ด้วยในตัว)
      try {
        fd.append("shop_id", shopId);
        fd.append("kind", "expense");
        const res = await fetch("/api/finance/extract", { method: "POST", body: fd });
        const j = await res.json();
        if (!j.ok) { setError(j.error ?? "AI อ่านไฟล์ไม่สำเร็จ"); return; }
        const d = j.data as {
          vendor_name?: string; date?: string; items?: { name: string; qty?: number; unit_price?: number }[];
          subtotal?: number; discount?: number; vat_mode?: "none" | "exclusive" | "inclusive";
          vat_amount?: number; total?: number; wht_rate?: number; category?: string;
          category_reason?: string; confidence?: number;
          unclear?: string[]; issues?: string[];
        };
        setAiWarn([...(d.issues ?? []), ...(d.unclear ?? [])]);
        setAiMeta({ confidence: d.confidence, reason: d.category_reason });
        // ยอดที่ AI อ่านจากท้ายบิล เอาไว้ทานกับผลรวมที่ฟอร์มคำนวณเอง (ดู useEffect ด้านล่าง)
        setOcrTotal(typeof d.total === "number" && d.total > 0 ? d.total : null);
        if (j.file_path) setFiles((prev) => (prev.some((x) => x.path === j.file_path) ? prev : [...prev, { path: j.file_path as string, name: f.name }]));
        if (d.vendor_name) { setContactName(d.vendor_name); setContactId(""); }
        if (d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date)) setIssueDate(d.date);
        if (d.items?.length) {
          setRows(d.items.slice(0, 30).map((it) => ({
            name: String(it.name ?? "").slice(0, 200), qty: String(it.qty ?? 1), unit: "",
            unit_price: String(it.unit_price ?? 0), product_id: null,
          })));
        } else if (d.total) {
          setRows([{ name: d.vendor_name ? `ค่าใช้จ่าย — ${d.vendor_name}` : "ค่าใช้จ่ายตามบิล", qty: "1", unit: "", unit_price: String(d.total), product_id: null }]);
        }
        // ใช้โหมด VAT ที่อ่านได้จริงจากบิล (บิลบวก VAT ท้ายบิล = exclusive) — เดาผิดทำให้ยอดเพี้ยนทั้งใบ
        if (d.vat_mode) setVatMode(d.vat_mode);
        else if ((d.vat_amount ?? 0) > 0) setVatMode("inclusive");
        if ((d.discount ?? 0) > 0) setDiscount(String(d.discount));
        if (d.wht_rate) setWhtRate(String(d.wht_rate));
        if (d.category && categories.length) {
          const cat = categories.find((c) => c.name.includes(d.category!) || d.category!.includes(c.name));
          if (cat) setCategoryId(cat.id);
        }
      } finally {
        setAiBusy(false);
      }
    } else {
      try {
        const r = await uploadFinFile(shopId, fd);
        if (r.ok) setFiles((prev) => (prev.some((x) => x.path === r.path) ? prev : [...prev, { path: r.path, name: f.name }]));
        else setError(r.error);
      } finally {
        setAiBusy(false);
      }
    }
  }

  function submit(status: "draft" | "awaiting", forceDuplicate = false) {
    setError(null);
    setShowRowErrors(false);
    const items = rows
      .filter((r) => r.name.trim() && Number(r.qty) > 0)
      .map((r) => ({ name: r.name, qty: Number(r.qty), unit: r.unit || undefined, unit_price: Number(r.unit_price) || 0, product_id: r.product_id }));
    if (!items.length) {
      // ⚠️ เดิมขึ้นแค่ "ใส่รายการอย่างน้อย 1 บรรทัด" ไว้ท้ายฟอร์ม
      // ผู้ใช้ไม่รู้ว่าต้องกรอกช่องไหน ต้องไล่เดาเอง (เจ้าของแจ้งเอง)
      // ตอนนี้ตีกรอบแดงที่ช่องที่ยังว่างจริง + บอกตรง ๆ ว่าขาดอะไร
      setShowRowErrors(true);
      const need = rows.some((r) => !r.name.trim()) ? "ชื่อรายการ" : "จำนวน";
      setError(`ยังกรอกไม่ครบ — ต้องมี${need}อย่างน้อย 1 บรรทัด (ช่องที่ต้องกรอกขึ้นกรอบแดงไว้ให้แล้ว)`);
      rowsRef.current?.querySelector<HTMLInputElement>("input[aria-invalid='true']")?.focus();
      return;
    }

    // ⚠️ ยอดรวมต้องมากกว่า 0 — บั๊กจริง 4 ส.ค. 2569 ที่ทำข้อมูลบัญชีเสีย
    // เดิมตรวจแค่ "มีชื่อ + จำนวน > 0" ไม่ได้ตรวจราคา ลืมใส่ราคาแล้วกดบันทึกได้
    // -> เอกสารถูกสร้างจริง -> ตอนลงสมุดรายวันไม่มีบรรทัดให้ลง (ยอด 0) -> ลงบัญชีพัง
    // -> เหลือเอกสารยอด 0 ค้างในระบบที่ไม่มีคู่บัญชี ตัวตรวจความถูกต้องขึ้นธงแดง
    // เจ้าของกดซ้ำเพราะไม่เข้าใจข้อความ error เลยได้เอกสารเสีย 2 ใบติดกัน (EXP-0007/0008)
    // กันที่นี่ = ไม่มีทางสร้างเอกสารยอด 0 ได้อีก (ฝั่ง server กันซ้ำอีกชั้น)
    if (!(items.reduce((a, it) => a + it.qty * it.unit_price, 0) > 0)) {
      setShowRowErrors(true);
      setError("ยังไม่ได้ใส่ราคา — ยอดรวมเป็น 0 บันทึกไม่ได้ เพราะลงบัญชีไม่ได้ (ช่อง “ราคา/หน่วย” ขึ้นกรอบแดงไว้ให้แล้ว)");
      rowsRef.current?.querySelector<HTMLInputElement>("input[aria-invalid='true']")?.focus();
      return;
    }
    const input: SaveDocInput = {
      id: draft?.id,
      doc_type: docType,
      contact_id: contactId || null,
      contact_name: contactId ? undefined : contactName,
      issue_date: issueDate,
      due_date: dueDate || null,
      category_id: isExpense ? categoryId || null : null,
      items, discount: Number(discount) || 0,
      vat_mode: vatMode, wht_rate: Number(whtRate) || 0,
      wht_income_type: Number(whtRate) > 0 ? incomeType : null,
      notes, file_path: files[0]?.path ?? null, extra_files: files.slice(1).map((f) => f.path), status,
      paid_now: isExpense ? paidNow : undefined,
      tax_point: taxPoint,
      pay_method: payMethod,
      force_duplicate: forceDuplicate,
    };
    start(async () => {
      // ⚠️ ต้องมี catch เสมอ — saveDoc โยน exception ได้ตอนเน็ตหลุด
      // ไม่มี catch = กดบันทึกแล้วเงียบสนิท ซึ่งคืออาการ "กดแล้วไม่เกิดอะไร"
      // แบบเดียวกับบทเรียน 2 ส.ค. 2569 ข้างบนเป๊ะ แค่คนละเส้นทาง
      try {
      const r = await saveDoc(shopId, input);
      if (r.ok) {
        // บอกให้ชัดว่าสำเร็จก่อนพาไปหน้าใหม่ — หน้าใหม่โหลดช้าบนมือถือ
        // ช่วงรอยต่อนั้นถ้าไม่มีอะไรบอก ผู้ใช้เข้าใจว่ากดแล้วไม่เกิดอะไร (เกิดจริง 2 ส.ค. 2569)
        toast({ text: `บันทึก ${r.docNumber} แล้ว`, tone: "success" });
        // บันทึกสำเร็จ = งานค้างในเครื่องหมดหน้าที่ ต้องล้าง ไม่งั้นเปิดฟอร์มรอบหน้าจะเจอแถบกู้ผี
        if (draftKey) try { localStorage.removeItem(draftKey); } catch { /* ล้างไม่ได้ไม่เป็นไร */ }
        router.push(isExpense ? `/dashboard/expenses` : `/dashboard/sales/${r.docId}`);
      } else if (r.duplicate) {
        // ด่านกันออกซ้ำจากฝั่ง server — ให้ผู้ใช้ตัดสินใจเอง ไม่บล็อกถาวร
        if (window.confirm(`${r.error}

ยืนยันออกเอกสารซ้ำอีกใบ?`)) submit(status, true);
        else setError(r.error);
      } else setError(r.error);
      } catch {
        setError("เชื่อมต่อไม่สำเร็จ — ข้อมูลที่พิมพ์ยังอยู่ครบ กดบันทึกอีกครั้งได้เลย");
      }
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      {restoreOffer && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <History className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">พบงานที่พิมพ์ค้างไว้จากครั้งก่อน — เอากลับมาพิมพ์ต่อได้เลย</span>
          <button type="button" onClick={() => applyRestore(restoreOffer)}
            className="min-h-[36px] rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700">
            พิมพ์ต่อจากเดิม
          </button>
          <button type="button"
            onClick={() => { setRestoreOffer(null); if (draftKey) try { localStorage.removeItem(draftKey); } catch { /* noop */ } }}
            className="min-h-[36px] rounded-lg border border-amber-300 px-3 text-xs text-amber-800 hover:bg-amber-100">
            เริ่มใหม่
          </button>
        </div>
      )}
      {/* แถบสลับประเภท — โชว์เฉพาะเอกสารขายและไม่ใช่ตอนแก้ร่าง (ร่างต้องคงประเภทเดิม) */}
      {!isExpense && !draft && (
        <div role="tablist" aria-label="ประเภทเอกสาร" className="flex gap-1 rounded-xl border border-neutral-200 bg-neutral-100/70 p-1">
          {(["quotation", "invoice", "receipt"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={docType === t}
              onClick={() => setDocType(t)}
              className={cn(
                "min-h-10 flex-1 rounded-lg px-2 text-sm font-medium transition-colors",
                docType === t ? "border border-neutral-200 bg-white text-emerald-700 shadow-sm" : "text-neutral-500 hover:text-neutral-700",
              )}>
              {DOC_TYPE_TH[t]}
            </button>
          ))}
        </div>
      )}
      {/* ⚠️ เดิมมีคำอธิบายชนิดเอกสารตรงนี้อีกชุด ซึ่งพูดเรื่องเดียวกับบรรทัดใต้หัวข้อหน้า
          ("ขายเชื่อ — ระบบตั้งลูกหนี้...") ห่างกันแค่แถบแท็บเดียว = อ่านซ้ำสองรอบไม่ได้อะไรเพิ่ม
          ตัดออก 5 ก.ย. 2569 (เจ้าของบอกว่ารก) — คำอธิบายเหลือที่เดียวคือใต้หัวข้อหน้า */}
      {isExpense && (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center gap-3 pt-4">
            <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden"
              onChange={async (e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; for (const f of fs) await attachFile(f, true); }} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={aiBusy}>
              <ScanLine className="h-4 w-4 text-emerald-600" /> {aiBusy ? "AI กำลังอ่านบิล..." : "ถ่ายรูป/อัปโหลดบิล ให้ AI กรอกให้"}
            </Button>
            {/* ยืนยันสิทธิ์ ณ จุดอัปโหลด — ผลตรวจ PDPA 28 ส.ค. 2569 */}
            <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">การอัปโหลดถือเป็นการยืนยันว่าคุณมีสิทธิ์ในเอกสารนี้ และอนุญาตให้ระบบประมวลผลตามนโยบายความเป็นส่วนตัว</p>
            <p className="text-xs text-neutral-400">เลือกได้หลายใบพร้อมกัน (บิลหลายหน้า/บิล+สลิป) — AI อ่านใบล่าสุดมากรอกฟอร์มให้ ตรวจก่อนบันทึกได้</p>
            {files.length > 0 && (
              <div className="w-full space-y-1">
                {files.map((f, i) => (
                  <div key={f.path} className="flex items-center gap-2 text-xs text-emerald-700">
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{f.name}{i === 0 && files.length > 1 ? " (ไฟล์หลัก)" : ""}</span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((x) => x.path !== f.path))}
                      className="shrink-0 text-neutral-400 hover:text-red-600">เอาออก</button>
                  </div>
                ))}
              </div>
            )}
            {/* ยอดไม่ตรงกับท้ายบิล = อ่านผิดแน่ๆ เตือนแรงกว่ากรณีอ่านไม่ชัดทั่วไป */}
            {ocrMismatch && (
              <div className="w-full rounded-xl border border-red-300 bg-red-50 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />ยอดไม่ตรงกับที่พิมพ์ไว้ท้ายบิล — มีตัวเลขอ่านผิดแน่นอน
                </p>
                <p className="mt-1 text-xs leading-relaxed text-red-600">
                  ท้ายบิลเขียนว่า <b>{baht(ocrMismatch.ocrTotal)}</b> แต่รวมจากรายการด้านล่างได้ <b>{baht(totals.total)}</b>
                  {" "}(ต่างกัน {baht(ocrMismatch.diff)}) — เทียบกับบิลจริงแล้วแก้ราคา/จำนวนให้ตรงก่อนบันทึก
                </p>
              </div>
            )}
            {/* แถบความมั่นใจของ AI — สีตามระดับ เขียว >=90 เหลือง >=70 แดงต่ำกว่านั้น */}
            {aiMeta?.confidence != null && (
              <div className={cn("flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs",
                aiMeta.confidence >= 90 ? "bg-emerald-50 text-emerald-800"
                  : aiMeta.confidence >= 70 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700")}>
                <span className="font-semibold">AI อ่านบิลนี้ด้วยความมั่นใจ {aiMeta.confidence}%</span>
                {aiMeta.confidence < 90 && <span>— ตรวจตัวเลขเทียบบิลจริงก่อนบันทึก</span>}
                {aiMeta.reason && <span className="basis-full text-[11px] opacity-80">เหตุผลการจัดหมวด: {aiMeta.reason} (แก้ได้ที่ช่องหมวดด้านล่าง)</span>}
              </div>
            )}
            {aiWarn.length > 0 && (
              <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />ตรวจตัวเลขก่อนบันทึกนะ — บิลนี้อ่านได้ไม่ชัดทั้งหมด
                </p>
                <ul className="mt-1 space-y-0.5">
                  {aiWarn.map((w, i) => <li key={i} className="text-xs leading-relaxed text-amber-700">• {w}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{isExpense ? "ผู้ขาย/ซัพพลายเออร์" : "ลูกค้า"}</Label>
              <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">{isExpense ? "ผู้ขายรายใหม่ — พิมพ์ชื่อในช่องด้านล่าง" : "ลูกค้าใหม่ — พิมพ์ชื่อในช่องด้านล่าง"}</option>
                {contacts.filter((c) => c.kind === contactKind || c.kind === "both").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              {!contactId && (
                <Input className="mt-2" placeholder={isExpense ? "พิมพ์ชื่อผู้ขาย" : "พิมพ์ชื่อลูกค้า"}
                  value={contactName} onChange={(e) => setContactName(e.target.value)} />
              )}
            </div>
            {/* ⚠️ ห้ามบังคับ 2 คอลัมน์บนจอแคบ — เจ้าของเจอจริงว่าช่อง "ยืนราคาถึง" ล้นออกนอกจอ
                ช่องวันที่มีทั้งข้อความ + ไอคอนปฏิทิน + บรรทัดอ่านค่าเป็นภาษาไทยใต้ช่อง
                ยัดสองช่องในแถวเดียวบนจอ 375px = อันขวาโดนดันพ้นขอบ กดไม่ได้เลย
                จอแคบเรียงลงมา · จอ 400px ขึ้นไปค่อยแบ่งสองคอลัมน์ */}
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
              <DateField label="วันที่เอกสาร" value={issueDate} onChange={setIssueDate} />
              <DateField label={docType === "quotation" ? "ยืนราคาถึง" : "ครบกำหนด"}
                value={dueDate} onChange={setDueDate} min={issueDate} hideToday />
            </div>
            {isExpense && (
              <div className="sm:col-span-2">
                <Label>หมวดค่าใช้จ่าย</Label>
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">— เลือกหมวด —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
            )}
          </div>

          {/* รายการ */}
          <div>
            <Label>รายการสินค้า/บริการ</Label>
            <div ref={rowsRef} className="space-y-2">
              {/*
                ⚠️ เดิมบรรทัดนี้มี sm:grid-cols- ซ้ำสองอันในคลาสเดียวกัน (4 ช่อง กับ 5 ช่อง)
                CSS ตัดสินคลาสน้ำหนักเท่ากันจากลำดับในไฟล์สไตล์ ไม่ใช่ลำดับที่เขียน
                จอ sm+ มีลูก 5 ตัวแต่บางครั้งได้กริด 4 ช่อง ปุ่มลบจึงตกบรรทัดและช่องเบียดกัน
                นี่คือ "ช่องกรอกเตลิดออกนอกกรอบ" ที่เจ้าของเจอ — เหลือชุดเดียวแล้ว

                ⚠️ มือถือห้ามยัด ชื่อ+จำนวน+ราคา+ปุ่มลบ ไว้แถวเดียว
                จอ 390px แบ่ง 4 ช่องทำให้ช่องชื่อเหลือ ~150px อ่าน placeholder ไม่จบ
                ("ชื่อรายการ/สินค" · "ราคา/ห") เจ้าของบอกว่า "ใช้งานยากมากในมือถือ"
                มือถือจึงแยกเป็น 2 ชั้น · sm+ ใช้ sm:contents ให้ลูกไหลกลับเข้ากริดแถวเดียวเหมือนเดิม
              */}
              {rows.map((r, i) => (
                <div key={i} className={cn(
                  "rounded-xl border border-neutral-200 bg-neutral-50/60 p-2.5",
                  "sm:grid sm:grid-cols-[1fr_5rem_4rem_7rem_2rem] sm:items-center sm:gap-2",
                  "sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0",
                )}>
                  {/* ชื่อ + ตัวเลือกสินค้า */}
                  <div className="min-w-0">
                    {products.length > 0 && (
                      /*
                        ⚠️ ห้ามพึ่ง <datalist> อย่างเดียว
                        Safari บน iOS ไม่แสดงรายการของ datalist เลย ผู้ใช้ iPhone จึงไม่มีทาง
                        เลือกสินค้าได้ -> product_id เป็น null ทุกใบ -> ระบบไม่ตัดสต๊อกและไม่ลง
                        ต้นทุนขายให้ ซึ่งเป็นปัญหาบัญชี ไม่ใช่แค่ความสะดวก
                        select ธรรมดาใช้ได้ทุกเบราว์เซอร์ ส่วนช่องพิมพ์ยังพิมพ์เองได้ถ้าไม่มีในรายการ
                      */
                      <Select className="mb-2 w-full" value={r.product_id ?? ""}
                        aria-label="เลือกสินค้า/บริการที่บันทึกไว้"
                        onChange={(e) => pickProductById(i, e.target.value)}>
                        <option value="">— เลือกสินค้า/บริการ หรือพิมพ์เองด้านล่าง —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {baht(p.price)}{p.track_stock ? ` · เหลือ ${p.stock}` : ""}
                          </option>
                        ))}
                      </Select>
                    )}
                    <Input list={products.length ? "product-list" : undefined} placeholder="ชื่อรายการ/สินค้า"
                      aria-invalid={showRowErrors && !r.name.trim() ? true : undefined}
                      className={cn("w-full", showRowErrors && !r.name.trim() && "border-red-400 bg-red-50/40 focus:border-red-500")}
                      value={r.name} onChange={(e) => pickProduct(i, e.target.value)} />
                  </div>

                  {/* จำนวน · หน่วย · ราคา · ลบ — sm:contents ทำให้ลูกกลายเป็นช่องของกริดแม่ */}
                  <div className="mt-2 grid grid-cols-[1fr_1fr_2rem] items-center gap-2 sm:mt-0 sm:contents">
                    <Input inputMode="decimal" placeholder="จำนวน" value={r.qty}
                      aria-invalid={showRowErrors && !(Number(r.qty) > 0) ? true : undefined}
                      className={cn("min-w-0", showRowErrors && !(Number(r.qty) > 0) && "border-red-400 bg-red-50/40 focus:border-red-500")}
                      onChange={(e) => setRow(i, { qty: e.target.value })} />
                    <Input className="hidden min-w-0 sm:block" placeholder="หน่วย" value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} />
                    {/* ราคาว่าง = ยอดรวม 0 = ลงบัญชีไม่ได้ ต้องเห็นตั้งแต่ตอนกรอก ไม่ใช่ไปตายตอนกดบันทึก */}
                    <Input inputMode="decimal" placeholder="ราคา/หน่วย" value={r.unit_price}
                      aria-invalid={showRowErrors && !(Number(r.unit_price) > 0) ? true : undefined}
                      className={cn("min-w-0", showRowErrors && !(Number(r.unit_price) > 0) && "border-red-400 bg-red-50/40 focus:border-red-500")}
                      onChange={(e) => setRow(i, { unit_price: e.target.value })}
                      // Enter ที่ช่องสุดท้ายของแถวสุดท้าย = เพิ่มแถวใหม่แล้วโฟกัสชื่อรายการ
                      // (ผลตรวจ 28 ส.ค. 2569: คนคีย์บิลหลายรายการต้องไม่หยิบเมาส์ทุกบรรทัด)
                      // ห้ามปล่อยให้ Enter submit ฟอร์ม — บิลยังคีย์ไม่จบแล้วโดนบันทึกคือหายนะ
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        if (i === rows.length - 1 && (r.name.trim() || r.unit_price)) {
                          setRows((rs) => [...rs, emptyRow()]);
                          requestAnimationFrame(() => {
                            const inputs = rowsRef.current?.querySelectorAll<HTMLInputElement>("input[placeholder='ชื่อรายการ/สินค้า']");
                            inputs?.[inputs.length - 1]?.focus();
                          });
                        }
                      }} />
                    <button type="button" aria-label="ลบบรรทัดนี้"
                      onClick={() => setRows((rs) => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)}
                      className="grid h-9 w-8 place-items-center text-neutral-400 hover:text-red-500"><Trash2 className="h-4 w-4 shrink-0" /></button>
                  </div>
                </div>
              ))}
            </div>
            {products.length > 0 && (
              <datalist id="product-list">
                {products.map((p) => <option key={p.id} value={p.name}>{`${baht(p.price)}${p.track_stock ? ` · เหลือ ${p.stock}` : ""}`}</option>)}
              </datalist>
            )}
            {/* คำกำกับใต้ช่อง — บอกกติกาไว้ก่อนที่ผู้ใช้จะกดบันทึกแล้วเจอ error
                ข้อความสั้นตรงจุดที่กรอก ได้ผลกว่าข้อความยาวท้ายฟอร์มที่คนไม่อ่าน */}
            {/* ⚠️ ขึ้นเฉพาะตอนกรอกไม่ครบจริง (แก้ 5 ก.ย. 2569)
                เดิมโชว์ตลอดเวลาเป็นตัวเทา 2 บรรทัด = สอนกติกาก่อนที่คนจะทำอะไรผิด
                ซึ่งคนอ่านครั้งเดียวแล้วไม่อ่านอีก แต่กินที่ทุกครั้งที่เปิดฟอร์ม
                ช่องที่ขาดขึ้นกรอบแดงอยู่แล้ว ข้อความจึงจำเป็นเฉพาะตอนนั้น */}
            {showRowErrors && (
              <p className="mt-1.5 text-xs font-medium leading-relaxed text-red-600">
                ต้องกรอก <b>ชื่อรายการ · จำนวน · ราคา/หน่วย</b> ให้ครบอย่างน้อย 1 บรรทัด — ยอดรวมต้องมากกว่า 0 ระบบถึงลงบัญชีให้ได้
              </p>
            )}

            <button type="button" onClick={() => setRows((rs) => [...rs, emptyRow()])}
              className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-800">
              <Plus className="h-4 w-4" /> เพิ่มบรรทัด
            </button>
          </div>

          {/* VAT / WHT / ส่วนลด */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>ส่วนลดท้ายบิล (บาท)</Label>
              <Input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>{VAT_LABEL}</Label>
              <Select value={vatMode} onChange={(e) => setVatMode(e.target.value as VatMode)}>
                <option value="none">ไม่มี VAT</option>
                <option value="exclusive">บวก VAT เพิ่มจากราคา</option>
                <option value="inclusive">ราคาที่ใส่รวม VAT แล้ว</option>
              </Select>
            </div>
            <div>
              <Label>หัก ณ ที่จ่าย</Label>
              <Select value={whtRate} onChange={(e) => setWhtRate(e.target.value)}>
                {WHT_RATES.map((w) => <option key={w} value={w}>{w === 0 ? "ไม่หัก" : `${w}%`}</option>)}
              </Select>
            </div>
          </div>

          {/* ประเภทเงินได้ตาม ม.40 — จำเป็นบนหนังสือรับรอง 50 ทวิ และไฟล์ยื่น ภ.ง.ด.3/53
              ไม่มีข้อมูลนี้ นักบัญชีต้องมานั่งจัดประเภทเองทุกใบตอนสิ้นเดือน */}
          {/* ปุ่มลัดงานที่เจอบ่อย — กดปุ๊บเติมทั้งอัตราและประเภทเงินได้ให้เลย
              ผู้ใช้ไม่ต้องจำว่าค่าขนส่งหัก 1% ค่าเช่าหัก 5% */}
          {isExpense && (
            <div>
              <Label>งานนี้เป็นค่าอะไร (กดแล้วเติมอัตราหัก ณ ที่จ่ายให้อัตโนมัติ)</Label>
              <div className="flex flex-wrap gap-1.5">
                {WHT_PRESETS.map((p) => {
                  const on = incomeType === p.income && Number(whtRate) === p.rate;
                  return (
                    <button key={p.key} type="button" title={p.note}
                      onClick={() => { setIncomeType(p.income); setWhtRate(String(p.rate)); }}
                      className={cn(
                        "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
                        on ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-700"
                           : "border-neutral-200 bg-white text-neutral-600 hover:border-emerald-300 hover:text-emerald-700",
                      )}>
                      {p.label}<span className="tabular-nums opacity-70">{p.rate}%</span>
                    </button>
                  );
                })}
                <button type="button" onClick={() => { setWhtRate("0"); }}
                  className={cn(
                    "inline-flex min-h-[44px] items-center rounded-full border px-3 text-xs transition-colors",
                    Number(whtRate) === 0 ? "border-neutral-900 bg-neutral-900 font-semibold text-white"
                                          : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                  )}>
                  ไม่ต้องหัก
                </button>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                อัตราพวกนี้เป็น <b>ตัวช่วยกรอกสำหรับกรณีที่เจอบ่อย</b> — อัตราจริงขึ้นกับว่าผู้รับเงินเป็นบุคคลธรรมดาหรือนิติบุคคลด้วย
                ปรับเองได้ที่ช่อง &ldquo;หัก ณ ที่จ่าย&rdquo; และควรให้ผู้ทำบัญชียืนยันก่อนยื่น
              </p>
            </div>
          )}

          {Number(whtRate) > 0 && (
            <div>
              <Label>ประเภทเงินได้ตามมาตรา 40 (พิมพ์บน 50 ทวิ และไฟล์ยื่น ภ.ง.ด.)</Label>
              <Select value={incomeType} onChange={(e) => setIncomeType(e.target.value)}>
                {WHT_INCOME_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </Select>
              <p className="mt-1 text-xs text-neutral-400">
                ไม่แน่ใจให้เลือก <b>40(8)</b> — ค่าบริการทั่วไปของธุรกิจเข้าหมวดนี้เกือบทั้งหมด
              </p>
            </div>
          )}

          {/* เกณฑ์ขั้นต่ำ 1,000 บาท — เตือนอย่างเดียว ไม่บล็อก
              เพราะถ้าเป็นการจ่ายตามสัญญาต่อเนื่องที่รวมทั้งสัญญาแล้วถึงเกณฑ์ ก็ยังต้องหัก
              ระบบไม่รู้เรื่องสัญญา จึงต้องให้คนตัดสิน ไม่ใช่ตัดสินแทนแล้วผิด */}
          {/* จุดความรับผิด VAT — เลือกได้เฉพาะใบแจ้งหนี้ที่คิด VAT
              ม.78 สินค้า = เกิดตอนส่งมอบ · ม.78/1 บริการ = เกิดตอนรับเงิน
              เลือกผิดแล้ว ภ.พ.30 จะตกเดือน ซึ่งเป็นความผิดที่สรรพากรตรวจเจอบ่อย */}
          {docType === "invoice" && vatMode !== "none" && (
            <div>
              <Label>งานนี้เป็นสินค้าหรือบริการ (มีผลต่อเดือนที่ต้องยื่นภาษีขาย)</Label>
              <Select value={taxPoint} onChange={(e) => setTaxPoint(e.target.value as "delivery" | "payment")}>
                <option value="delivery">ขายสินค้า / ส่งมอบแล้ว — ยื่นภาษีขายเดือนที่ออกใบนี้ (ม.78)</option>
                <option value="payment">งานบริการ ขายเชื่อ — ยื่นภาษีขายเดือนที่ลูกค้าจ่ายเงิน (ม.78/1)</option>
              </Select>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                {taxPoint === "delivery"
                  ? "ใบนี้เป็นใบกำกับภาษีทันที ภาษีขายเข้า ภ.พ.30 ของเดือนนี้เลย · ใบที่มีทั้งสินค้าและบริการให้ใช้ตัวเลือกนี้ (กฎหมายรองรับ เพราะออกใบกำกับภาษีก่อน = ความรับผิดเกิดทันที)"
                  : "ใบนี้เป็นใบแจ้งหนี้เฉย ๆ ยังไม่ใช่ใบกำกับภาษี · ระบบพักภาษีขายไว้ที่บัญชี 2035 แล้วย้ายเข้าภาษีขายจริงตอนรับเงิน ใบกำกับภาษีออกตอนออกใบเสร็จ"}
              </p>
            </div>
          )}

          {/* อัตราไม่เข้าคู่กับประเภทเงินได้ — เตือนอย่างเดียว ไม่บล็อก
              เพราะมีกรณีเฉพาะที่อัตราต่างจากปกติได้จริง ให้ผู้ทำบัญชีตัดสิน */}
          {Number(whtRate) > 0 && whtRateMismatch(incomeType, Number(whtRate)) && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
              {whtRateMismatch(incomeType, Number(whtRate))}
            </p>
          )}

          {Number(whtRate) > 0 && belowWhtThreshold(totals.exVat) && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
              ยอดก่อน VAT {bahtDoc(totals.exVat)} ต่ำกว่า {WHT_MIN_PAYMENT.toLocaleString()} บาท —
              การจ่ายครั้งเดียวต่ำกว่าเกณฑ์นี้ <b>ไม่ต้องหัก ณ ที่จ่าย</b> (ท.ป.4/2528)
              ยกเว้นเป็นการจ่ายตามสัญญาต่อเนื่องที่รวมทั้งสัญญาแล้วถึงเกณฑ์ ถ้าไม่เข้าข้อยกเว้นให้เลือก &ldquo;ไม่ต้องหัก&rdquo;
            </p>
          )}

          {isExpense && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-neutral-50 px-3 py-2.5">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                จ่ายเงินแล้ว
              </label>
              {paidNow && (
                <Select className="w-36" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="transfer">โอนเงิน</option>
                  <option value="cash">เงินสด</option>
                  <option value="promptpay">พร้อมเพย์</option>
                  <option value="card">บัตร</option>
                </Select>
              )}
              {!paidNow && <span className="text-xs text-neutral-400">ยังไม่จ่าย = ตั้งหนี้ไว้ ระบบเตือนวันครบกำหนด และไปทำจ่ายที่หน้าการเงิน</span>}
            </div>
          )}

          {docType === "receipt" && !draft?.ref_doc_id && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-neutral-50 px-3 py-2.5">
              <span className="text-sm">รับเงินผ่าน</span>
              <Select className="w-36" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="transfer">โอนเงิน</option>
                <option value="cash">เงินสด</option>
                <option value="promptpay">พร้อมเพย์</option>
                <option value="card">บัตร</option>
              </Select>
              <span className="text-xs text-neutral-400">ใบเสร็จ (ขายสด) = บันทึกเงินเข้าและตัดสต๊อกทันที</span>
            </div>
          )}

          <div>
            <Label>หมายเหตุ (ขึ้นบนเอกสาร)</Label>
            <Textarea className="min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* สรุปยอด */}
          <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-neutral-400">รวมเป็นเงิน</span><span>{baht(totals.base + (Number(discount) || 0))}</span></div>
            {(Number(discount) || 0) > 0 && <div className="flex justify-between"><span className="text-neutral-400">ส่วนลด</span><span>-{baht(Number(discount))}</span></div>}
            {vatMode !== "none" && (
              <>
                <div className="flex justify-between"><span className="text-neutral-400">มูลค่าก่อน VAT</span><span>{baht(totals.exVat)}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400">VAT {vatPercentLabelOf({ total: totals.total, vat_amount: totals.vat })}</span><span>{baht(totals.vat)}</span></div>
              </>
            )}
            <div className="flex justify-between border-t border-neutral-200 pt-1 font-semibold"><span>ยอดเอกสาร</span><span>{baht(totals.total)}</span></div>
            {totals.wht > 0 && (
              <>
                <div className="flex justify-between text-neutral-500"><span>หัก ณ ที่จ่าย {whtRate}%</span><span>-{baht(totals.wht)}</span></div>
                <div className="flex justify-between font-semibold text-emerald-700"><span>{isExpense ? "ยอดจ่ายจริง" : "ยอดรับจริง"}</span><span>{baht(totals.cashDue)}</span></div>
              </>
            )}
          </div>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {/* ดูตัวอย่างก่อนออก — ปุ่มนี้ไม่แตะข้อมูลใด ๆ เปิดหน้าต่างอ่านอย่างเดียว
                วางไว้ซ้ายสุดของแถวปุ่ม เพราะเป็นขั้นที่ควรทำ "ก่อน" บันทึกเสมอ */}
            {seller && (
              <Button type="button" variant="outline" onClick={() => setShowPreview(true)}>
                ดูตัวอย่างเอกสาร
              </Button>
            )}
            <Button variant="outline" disabled={pending} onClick={() => submit("draft")}>บันทึกร่าง</Button>
            <Button disabled={pending} onClick={() => submit("awaiting")} className="min-w-40">
              {pending ? "กำลังบันทึก..." : `ออก${DOC_TYPE_TH[docType]}`}
            </Button>
          </div>
          <p className="text-right text-xs text-neutral-400">
            ออกเอกสารแล้วระบบลงสมุดรายวัน (เดบิต/เครดิต){docType !== "quotation" ? " และอัปเดตลูกหนี้/เจ้าหนี้/สต๊อก" : ""} ให้อัตโนมัติ
          </p>
        </CardContent>
      </Card>

      {showPreview && seller && (
        <DocPreview
          docType={docType}
          seller={seller}
          buyer={{
            // ผู้ติดต่อที่เลือกจากรายการมีที่อยู่/เลขภาษีครบ ส่วนที่พิมพ์ชื่อเองมีแค่ชื่อ
            // ตรงนี้แหละที่ทำให้ใบกำกับภาษีไม่ครบโดยไม่มีใครรู้ตัว — พรีวิวจะฟ้องให้เห็น
            name: contacts.find((c) => c.id === contactId)?.name ?? contactName,
            address: contacts.find((c) => c.id === contactId)?.address ?? null,
            taxId: contacts.find((c) => c.id === contactId)?.tax_id ?? null,
          }}
          rows={rows
            .filter((r) => r.name.trim() || Number(r.unit_price) > 0)
            .map((r) => ({
              name: r.name.trim(), qty: Number(r.qty) || 0,
              unit: r.unit ?? "", unitPrice: Number(r.unit_price) || 0,
            }))}
          totals={{
            // DocTotals ไม่มี subtotal (มีแต่ base = หลังหักส่วนลดแล้ว)
            // บวกกลับจาก base ไม่ได้ เพราะ base ถูก clamp ที่ 0 เมื่อส่วนลดมากกว่ายอด
            subtotal: rows.reduce((a, r) => a + (Number(r.qty) || 0) * (Number(r.unit_price) || 0), 0),
            discount: Number(discount) || 0,
            exVat: totals.exVat, vat: totals.vat, total: totals.total,
            wht: totals.wht, cashDue: totals.cashDue,
          }}
          issueDate={issueDate}
          dueDate={dueDate}
          vatMode={vatMode}
          whtRate={Number(whtRate) || 0}
          notes={notes}
          onClose={() => setShowPreview(false)}
          edit={{
            // ⚠️ ทุกตัวชี้กลับมาที่ state ของฟอร์ม — พรีวิวไม่เก็บ state เอง
            // ปิดป๊อปอัปแล้วสิ่งที่แก้ยังอยู่ในฟอร์มครบ และยอดคำนวณด้วย calcDocTotals ตัวเดียวกัน
            setRow: (i, patch) => setRow(i, {
              ...(patch.name !== undefined ? { name: patch.name } : {}),
              ...(patch.qty !== undefined ? { qty: String(patch.qty) } : {}),
              ...(patch.unitPrice !== undefined ? { unit_price: String(patch.unitPrice) } : {}),
            }),
            addRow: () => setRows((rs) => [...rs, { name: "", qty: "1", unit: "", unit_price: "", product_id: null }]),
            removeRow: (i) => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)),
            setBuyerName: (v) => { setContactId(""); setContactName(v); },
            setDiscount: (v) => setDiscount(v ? String(v) : ""),
            setVatMode: (v) => setVatMode(v),
            setWhtRate: (v) => setWhtRate(String(v)),
            setIssueDate: (v) => setIssueDate(v),
            setDueDate: (v) => setDueDate(v),
            setNotes: (v) => setNotes(v),
            // ออกเอกสารจากในป๊อปอัปได้เลย — เส้นทางเดียวกับปุ่มข้างนอกทุกประการ
            // (ไม่ปิดป๊อปอัปเอง เพราะถ้า submit ตีกลับเพราะข้อมูลไม่ครบ ผู้ใช้ต้องเห็น error บนใบที่กำลังดูอยู่)
            onIssue: () => submit("awaiting"),
            issuing: pending,
            issueLabel: `ออก${DOC_TYPE_TH[docType]}`,
            // เลือกลูกค้าจากรายชื่อแล้ว = ชื่อมาจากผู้ติดต่อ แก้บนใบไม่ได้ ต้องไปแก้ที่ผู้ติดต่อ
            // ไม่งั้นชื่อบนใบกับที่อยู่/เลขภาษีจะเป็นคนละคนโดยที่ไม่มีใครรู้
            buyerLocked: !!contactId,
          } satisfies PreviewEdit}
        />
      )}
    </div>
  );
}
