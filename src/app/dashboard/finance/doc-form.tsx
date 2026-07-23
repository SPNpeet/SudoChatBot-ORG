"use client";
import { compressImage } from "@/lib/compress-image";
// ============================================================
//  ฟอร์มเอกสารกลาง — ใบเสนอราคา/ใบแจ้งหนี้/ใบเสร็จ/ค่าใช้จ่าย
//  คำนวณ VAT (แยกนอก/รวมใน) + หัก ณ ที่จ่าย สดทุกครั้งที่พิมพ์
//  ค่าใช้จ่าย: แนบรูปบิลแล้วให้ AI อ่านกรอกให้ทั้งฟอร์มได้
// ============================================================
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Sparkles, Paperclip } from "lucide-react";
import { Button, Card, CardContent, Input, Label, Select, Textarea } from "@/components/ui";
import { baht } from "@/lib/utils";
import { calcDocTotals, DOC_TYPE_TH, WHT_RATES } from "@/lib/finance";
import type { DocType, VatMode, ExpenseCategory, Contact, FinDoc } from "@/lib/types/finance";
import { saveDoc, uploadFinFile, type SaveDocInput } from "./actions";

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
  const [aiBusy, setAiBusy] = useState(false);

  const [rows, setRows] = useState<Row[]>(
    draft?.fin_doc_items?.length
      ? draft.fin_doc_items.map((it) => ({ name: it.name, qty: String(it.qty), unit: it.unit ?? "", unit_price: String(it.unit_price), product_id: it.product_id ?? null }))
      : [emptyRow()],
  );
  const [contactId, setContactId] = useState(draft?.contact_id ?? "");
  const [contactName, setContactName] = useState(draft?.contact_name ?? "");
  const [discount, setDiscount] = useState(draft ? String(draft.discount || "") : "");
  const [vatMode, setVatMode] = useState<VatMode>(draft?.vat_mode ?? "none");
  const [whtRate, setWhtRate] = useState(draft ? String(draft.wht_rate || 0) : "0");
  const [issueDate, setIssueDate] = useState(draft?.issue_date ?? new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(draft?.due_date ?? "");
  const [categoryId, setCategoryId] = useState(draft?.category_id ?? "");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [paidNow, setPaidNow] = useState(isExpense);
  const [payMethod, setPayMethod] = useState("transfer");
  const [filePath, setFilePath] = useState<string | null>(draft?.file_path ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => calcDocTotals(
    rows.map((r) => ({ qty: Number(r.qty) || 0, unit_price: Number(r.unit_price) || 0 })),
    Number(discount) || 0, vatMode, Number(whtRate) || 0,
  ), [rows, discount, vatMode, whtRate]);

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
          subtotal?: number; vat_amount?: number; total?: number; wht_rate?: number; category?: string;
        };
        if (j.file_path) { setFilePath(j.file_path); setFileName(f.name); }
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
        // มี VAT ในบิล -> ตีเป็นราคารวม VAT
        if ((d.vat_amount ?? 0) > 0) setVatMode("inclusive");
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
        if (r.ok) { setFilePath(r.path); setFileName(f.name); }
        else setError(r.error);
      } finally {
        setAiBusy(false);
      }
    }
  }

  function submit(status: "draft" | "awaiting") {
    setError(null);
    const items = rows
      .filter((r) => r.name.trim() && Number(r.qty) > 0)
      .map((r) => ({ name: r.name, qty: Number(r.qty), unit: r.unit || undefined, unit_price: Number(r.unit_price) || 0, product_id: r.product_id }));
    if (!items.length) { setError("ใส่รายการอย่างน้อย 1 บรรทัด"); return; }
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
      notes, file_path: filePath, status,
      paid_now: isExpense ? paidNow : undefined,
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
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) attachFile(f, true); e.target.value = ""; }} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={aiBusy}>
              <Sparkles className="h-4 w-4 text-emerald-600" /> {aiBusy ? "AI กำลังอ่านบิล..." : "ถ่ายรูป/อัปโหลดบิล ให้ AI กรอกให้"}
            </Button>
            <p className="text-xs text-neutral-400">รองรับรูปถ่ายบิล ใบเสร็จ ใบกำกับภาษี PDF — AI อ่านผู้ขาย ยอด VAT แล้วกรอกฟอร์มให้ ตรวจก่อนบันทึกได้</p>
            {fileName && <p className="w-full text-xs text-emerald-700"><Paperclip className="mr-1 inline h-3 w-3" />แนบไฟล์แล้ว: {fileName}</p>}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>วันที่เอกสาร</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div>
                <Label>{docType === "quotation" ? "ยืนราคาถึง" : "ครบกำหนด"}</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
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
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_4.5rem_5.5rem_2rem] items-center gap-2 sm:grid-cols-[1fr_5rem_4rem_7rem_2rem]">
                  <Input list={products.length ? "product-list" : undefined} placeholder="ชื่อรายการ/สินค้า"
                    value={r.name} onChange={(e) => pickProduct(i, e.target.value)} />
                  <Input inputMode="decimal" placeholder="จำนวน" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} />
                  <Input className="hidden sm:block" placeholder="หน่วย" value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} />
                  <Input inputMode="decimal" placeholder="ราคา/หน่วย" value={r.unit_price} onChange={(e) => setRow(i, { unit_price: e.target.value })} />
                  <button type="button" onClick={() => setRows((rs) => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)}
                    className="text-neutral-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
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
              <Label>ภาษีมูลค่าเพิ่ม (VAT 7%)</Label>
              <Select value={vatMode} onChange={(e) => setVatMode(e.target.value as VatMode)}>
                <option value="none">ไม่มี VAT</option>
                <option value="exclusive">บวก VAT เพิ่ม (แยกนอก)</option>
                <option value="inclusive">ราคารวม VAT แล้ว (รวมใน)</option>
              </Select>
            </div>
            <div>
              <Label>หัก ณ ที่จ่าย</Label>
              <Select value={whtRate} onChange={(e) => setWhtRate(e.target.value)}>
                {WHT_RATES.map((w) => <option key={w} value={w}>{w === 0 ? "ไม่หัก" : `${w}%`}</option>)}
              </Select>
            </div>
          </div>

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
                <div className="flex justify-between"><span className="text-neutral-400">VAT 7%</span><span>{baht(totals.vat)}</span></div>
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
