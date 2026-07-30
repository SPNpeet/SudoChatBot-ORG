"use client";
import { compressImage } from "@/lib/compress-image";
// ============================================================
//  ฟอร์มเอกสารกลาง — ใบเสนอราคา/ใบแจ้งหนี้/ใบเสร็จ/ค่าใช้จ่าย
//  คำนวณ VAT (แยกนอก/รวมใน) + หัก ณ ที่จ่าย สดทุกครั้งที่พิมพ์
//  ค่าใช้จ่าย: แนบรูปบิลแล้วให้ AI อ่านกรอกให้ทั้งฟอร์มได้
// ============================================================
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ScanLine, Paperclip, TriangleAlert } from "lucide-react";
import { Button, Card, CardContent, Input, Label, Select, Textarea } from "@/components/ui";
import { baht, bahtDoc, cn } from "@/lib/utils";
import { calcDocTotals, DOC_TYPE_TH, WHT_RATES } from "@/lib/finance";
import { WHT_INCOME_TYPES, WHT_PRESETS, DEFAULT_WHT_INCOME, WHT_MIN_PAYMENT, belowWhtThreshold, whtRateMismatch } from "@/lib/tax-th";
import type { DocType, VatMode, ExpenseCategory, Contact, FinDoc } from "@/lib/types/finance";
import { saveDoc, uploadFinFile, type SaveDocInput } from "./actions";
import { VAT_LABEL, VAT_PERCENT_LABEL } from "@/lib/tax-th";
import DateField from "@/components/date-field";

interface ProductLite { id: string; name: string; price: number; stock: number; track_stock: boolean }
interface Row { name: string; qty: string; unit: string; unit_price: string; product_id: string | null }

export interface DocFormProps {
  shopId: string;
  docType: DocType;
  contacts: Contact[];
  products?: ProductLite[];
  categories?: ExpenseCategory[];
  draft?: FinDoc;                 // แก้ไขร่าง
}

const emptyRow = (): Row => ({ name: "", qty: "1", unit: "", unit_price: "", product_id: null });

export default function DocForm({ shopId, docType, contacts, products = [], categories = [], draft }: DocFormProps) {
  const isExpense = docType === "expense";
  const contactKind = isExpense ? "vendor" : "customer";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // ตีกรอบแดงที่ช่องรายการที่ยังว่าง — โชว์หลังกดบันทึกครั้งแรกเท่านั้น
  // (ไม่ตีแดงตั้งแต่เปิดฟอร์ม ฟอร์มเปล่าที่แดงทั้งใบทำให้คนกลัวมากกว่าช่วย)
  const [showRowErrors, setShowRowErrors] = useState(false);
  const rowsRef = useRef<HTMLDivElement>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiWarn, setAiWarn] = useState<string[]>([]);   // จุดที่ AI อ่านไม่ชัด/ยอดไม่ลงตัว — ให้คนตรวจก่อนบันทึก
  const [ocrTotal, setOcrTotal] = useState<number | null>(null); // ยอดรวมที่ AI อ่านได้จากท้ายบิล

  const [rows, setRows] = useState<Row[]>(
    draft?.fin_doc_items?.length
      ? draft.fin_doc_items.map((it) => ({ name: it.name, qty: String(it.qty), unit: it.unit ?? "", unit_price: String(it.unit_price), product_id: it.product_id ?? null }))
      : [emptyRow()],
  );
  const [contactId, setContactId] = useState(draft?.contact_id ?? "");
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
          unclear?: string[]; issues?: string[];
        };
        setAiWarn([...(d.issues ?? []), ...(d.unclear ?? [])]);
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

  function submit(status: "draft" | "awaiting") {
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
    };
    start(async () => {
      const r = await saveDoc(shopId, input);
      if (r.ok) router.push(isExpense ? `/dashboard/expenses` : `/dashboard/sales/${r.docId}`);
      else setError(r.error);
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      {isExpense && (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center gap-3 pt-4">
            <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden"
              onChange={async (e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; for (const f of fs) await attachFile(f, true); }} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={aiBusy}>
              <ScanLine className="h-4 w-4 text-emerald-600" /> {aiBusy ? "AI กำลังอ่านบิล..." : "ถ่ายรูป/อัปโหลดบิล ให้ AI กรอกให้"}
            </Button>
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
                <p className="mt-1 text-[11px] leading-relaxed text-red-600">
                  ท้ายบิลเขียนว่า <b>{baht(ocrMismatch.ocrTotal)}</b> แต่รวมจากรายการด้านล่างได้ <b>{baht(totals.total)}</b>
                  {" "}(ต่างกัน {baht(ocrMismatch.diff)}) — เทียบกับบิลจริงแล้วแก้ราคา/จำนวนให้ตรงก่อนบันทึก
                </p>
              </div>
            )}
            {aiWarn.length > 0 && (
              <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />ตรวจตัวเลขก่อนบันทึกนะ — บิลนี้อ่านได้ไม่ชัดทั้งหมด
                </p>
                <ul className="mt-1 space-y-0.5">
                  {aiWarn.map((w, i) => <li key={i} className="text-[11px] leading-relaxed text-amber-700">• {w}</li>)}
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
                <option value="">— พิมพ์ชื่อเองด้านล่าง —</option>
                {contacts.filter((c) => c.kind === contactKind || c.kind === "both").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              {!contactId && (
                <Input className="mt-2" placeholder={isExpense ? "ชื่อผู้ขาย (ไม่บังคับ)" : "ชื่อลูกค้า (ไม่บังคับ)"}
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
            <Label>รายการ</Label>
            <div ref={rowsRef} className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_3.5rem_4.75rem_1.75rem] sm:grid-cols-[1fr_4.5rem_5.5rem_2rem] items-center gap-2 sm:grid-cols-[1fr_5rem_4rem_7rem_2rem]">
                  <Input list={products.length ? "product-list" : undefined} placeholder="ชื่อรายการ/สินค้า"
                    aria-invalid={showRowErrors && !r.name.trim() ? true : undefined}
                    className={showRowErrors && !r.name.trim() ? "border-red-400 bg-red-50/40 focus:border-red-500" : undefined}
                    value={r.name} onChange={(e) => pickProduct(i, e.target.value)} />
                  <Input inputMode="decimal" placeholder="จำนวน" value={r.qty}
                    aria-invalid={showRowErrors && !(Number(r.qty) > 0) ? true : undefined}
                    className={showRowErrors && !(Number(r.qty) > 0) ? "border-red-400 bg-red-50/40 focus:border-red-500" : undefined}
                    onChange={(e) => setRow(i, { qty: e.target.value })} />
                  <Input className="hidden sm:block" placeholder="หน่วย" value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} />
                  <Input inputMode="decimal" placeholder="ราคา/หน่วย" value={r.unit_price} onChange={(e) => setRow(i, { unit_price: e.target.value })} />
                  <button type="button" onClick={() => setRows((rs) => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)}
                    className="text-neutral-300 hover:text-red-500"><Trash2 className="h-4 w-4 shrink-0" /></button>
                </div>
              ))}
            </div>
            {products.length > 0 && (
              <datalist id="product-list">
                {products.map((p) => <option key={p.id} value={p.name}>{`${baht(p.price)}${p.track_stock ? ` · เหลือ ${p.stock}` : ""}`}</option>)}
              </datalist>
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
                        "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
                        on ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-700"
                           : "border-neutral-200 bg-white text-neutral-600 hover:border-emerald-300 hover:text-emerald-700",
                      )}>
                      {p.label}<span className="tabular-nums opacity-70">{p.rate}%</span>
                    </button>
                  );
                })}
                <button type="button" onClick={() => { setWhtRate("0"); }}
                  className={cn(
                    "inline-flex min-h-[36px] items-center rounded-full border px-3 text-xs transition-colors",
                    Number(whtRate) === 0 ? "border-neutral-900 bg-neutral-900 font-semibold text-white"
                                          : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                  )}>
                  ไม่ต้องหัก
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">
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
              <p className="mt-1 text-[11px] text-neutral-400">
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
              <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">
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
                <div className="flex justify-between"><span className="text-neutral-400">VAT {VAT_PERCENT_LABEL}</span><span>{baht(totals.vat)}</span></div>
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
            <Button variant="outline" disabled={pending} onClick={() => submit("draft")}>บันทึกร่าง</Button>
            <Button disabled={pending} onClick={() => submit("awaiting")} className="min-w-40">
              {pending ? "กำลังบันทึก..." : `ออก${DOC_TYPE_TH[docType]}`}
            </Button>
          </div>
          <p className="text-right text-[11px] text-neutral-400">
            ออกเอกสารแล้วระบบลงสมุดรายวัน (เดบิต/เครดิต){docType !== "quotation" ? " และอัปเดตลูกหนี้/เจ้าหนี้/สต๊อก" : ""} ให้อัตโนมัติ
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
