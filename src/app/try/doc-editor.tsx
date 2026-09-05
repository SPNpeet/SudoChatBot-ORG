"use client";
import { ThaiDateInline } from "@/components/date-field";
// ============================================================
//  โหมดแก้บนตัวเอกสาร (WYSIWYG) — พิมพ์ลงบนกระดาษที่ลูกค้าจะได้รับจริง
//
//  ทำไมทำแบบนี้: เจ้าของเทียบกับระบบคู่แข่งแล้วสรุปว่าเขา "ใช้ง่ายกว่า"
//  ต้นเหตุจริงคือ ของเรา = กรอกฟอร์ม -> กดบันทึก -> ค่อยกดพิมพ์ดู
//  ผู้ใช้ต้องจินตนาการเองว่าออกมาหน้าตายังไง ส่วนของเขาพิมพ์ลงบนกระดาษเลย
//
//  ⚠️ ทำที่หน้าสาธารณะก่อนโดยเจตนา ไม่ไปแก้ doc-form ที่ลูกค้าจริงใช้อยู่
//  ฟอร์มนั้นผูกกับสมุดรายวัน/สต๊อก/ภาษี พังแล้วกระทบบัญชีคนจ่ายเงิน
//  พิสูจน์แนวคิดที่นี่ก่อน แล้วค่อยยกเข้าระบบเป็นอีกโหมด
//
//  ⚠️ ช่องกรอกทำเป็น input โปร่งใสทับตำแหน่งจริงบนกระดาษ ไม่ใช่ contentEditable
//  contentEditable บนมือถือมีปัญหาเรื่องแป้นพิมพ์ ตำแหน่งเคอร์เซอร์ และ paste
//  input ธรรมดาได้ทั้งหมดนั้นฟรี แค่ถอดเส้นขอบกับพื้นหลังออก
// ============================================================
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Printer, Plus, Trash2, ArrowRight, Check } from "lucide-react";
import { calcDocTotals, bahtText, DOC_TYPE_TH } from "@/lib/finance";
import { VAT_LABEL } from "@/lib/tax-th";
import { bahtDoc, dateOnlyTH, cn } from "@/lib/utils";
import { ACTION_CHIP } from "@/components/ui";
import type { DocType, VatMode } from "@/lib/types/finance";

const DRAFT_KEY = "sc_try_draft";
const bkkToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

interface Row { name: string; qty: string; price: string }
interface Draft {
  docType: DocType; sellerName: string; sellerAddress: string; sellerTaxId: string;
  buyerName: string; buyerAddress: string; buyerTaxId: string;
  issueDate: string; docNumber: string; vatMode: VatMode; discount: string;
  notes: string; rows: Row[];
}

// ⚠️ issueDate ต้องว่างไว้ตรงนี้ ห้ามเรียก bkkToday() ตอนโหลดโมดูล
// หน้านี้เป็น static ล้วน Next.js จึง prerender ตอน build — ค่าที่คำนวณตอนโหลดโมดูล
// จะถูกอบติดไปกับ HTML แล้วค้างเป็น "วันที่ build" ตลอด ผู้ใช้เปิดอีก 3 สัปดาห์ก็ยังได้วันเก่า
// ซึ่งบนเอกสารบัญชีคือวันที่ผิด ไม่ใช่แค่ความไม่สวยงาม · เติมวันจริงในเอฟเฟกต์ฝั่ง client แทน
const EMPTY: Draft = {
  docType: "invoice", sellerName: "", sellerAddress: "", sellerTaxId: "",
  buyerName: "", buyerAddress: "", buyerTaxId: "",
  issueDate: "", docNumber: "INV-0001", vatMode: "none", discount: "",
  notes: "", rows: [{ name: "", qty: "1", price: "" }],
};

/** มีอะไรที่ผู้ใช้พิมพ์เองจริง ๆ ไหม — วันที่/เลขที่ที่ระบบเติมให้ไม่นับ */
function hasContent(d: Draft): boolean {
  return Boolean(
    d.sellerName.trim() || d.sellerAddress.trim() || d.sellerTaxId.trim() ||
    d.buyerName.trim() || d.buyerAddress.trim() || d.buyerTaxId.trim() ||
    d.notes.trim() || Number(d.discount) > 0 ||
    d.rows.some((r) => r.name.trim() || Number(r.price) > 0),
  );
}

/** ช่องกรอกที่อยู่บนกระดาษ — ปกติดูเหมือนข้อความ พอชี้/โฟกัสถึงจะเห็นว่าแก้ได้ */
function Field({ className, wide, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { wide?: boolean }) {
  return (
    <input {...p}
      className={cn(
        // ⚠️ เป้ากดบนมือถือ vs หน้าตาเอกสารจริง — วัดบนมือถือ 6 ส.ค. 2569 ได้ 24px (เกณฑ์ 44px)
        // ขยายความสูงตรง ๆ จะพังภาพ "กระดาษเอกสาร" ที่เป็นจุดขายของหน้านี้
        // จึงเพิ่มเฉพาะพื้นที่แตะบนจอเล็ก แล้วคืนค่าเดิมบนจอใหญ่และตอนสั่งพิมพ์
        "min-h-11 min-w-0 rounded-[3px] border-0 bg-transparent px-1 py-2 outline-none sm:min-h-0 sm:py-0.5 print:min-h-0 print:py-0.5",
        // placeholder เดิม neutral-300 คอนทราสต์ 1.48:1 — ฟอร์มที่ต้องกรอกทุกช่องแต่อ่านไม่ออกว่าช่องไหนคืออะไร
        "transition-colors placeholder:text-neutral-400",
        // เส้นใต้จาง ๆ คือสัญญาณเดียวที่บอกว่า "ตรงนี้พิมพ์ได้" — ถ้าไม่มีคนจะไม่กล้าแตะ
        "hover:bg-emerald-50/70 focus:bg-emerald-50 focus:ring-1 focus:ring-emerald-300",
        "print:bg-transparent print:ring-0",
        wide && "w-full",
        className,
      )} />
  );
}

export default function TryDocEditor() {
  const [d, setD] = useState<Draft>(EMPTY);
  const [restored, setRestored] = useState(false);

  // กู้ร่างที่ค้างไว้ — คนปิดแท็บแล้วกลับมาต้องไม่ต้องพิมพ์ใหม่
  // ไม่มีร่าง = เติมวันที่วันนี้ (เวลาไทย) ให้ ซึ่งต้องทำที่นี่เท่านั้น ดูเหตุผลที่ EMPTY
  useEffect(() => {
    let saved: Draft | null = null;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) saved = JSON.parse(raw) as Draft;
    } catch { /* ร่างเสียก็เริ่มใหม่ ไม่ต้องแจ้ง */ }
    if (saved && hasContent({ ...EMPTY, ...saved })) {
      setD({ ...EMPTY, ...saved, issueDate: saved.issueDate || bkkToday() });
      setRestored(true);
    } else {
      setD((c) => ({ ...c, issueDate: bkkToday() }));
    }
  }, []);

  // เก็บร่างทุกครั้งที่พิมพ์ (เฉพาะเครื่องนี้)
  // ⚠️ ต้องเช็คว่ามีเนื้อหาจริงก่อน ไม่งั้นแค่เอฟเฟกต์เติมวันที่ด้านบนก็เขียนร่างเปล่าลงไปแล้ว
  // ผลคือคนเปิดครั้งที่สองเจอแถบ "กู้ร่างที่ค้างไว้" ทั้งที่ไม่เคยพิมพ์อะไร = ระบบโกหก
  useEffect(() => {
    if (!hasContent(d)) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* เต็มก็ข้าม */ }
  }, [d]);

  const set = (patch: Partial<Draft>) => setD((c) => ({ ...c, ...patch }));
  const setRow = (i: number, patch: Partial<Row>) =>
    setD((c) => ({ ...c, rows: c.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  // ใช้ calcDocTotals ตัวเดียวกับที่ระบบจริงใช้ออกเอกสาร ไม่เขียนสูตรใหม่
  // ถ้าเขียนใหม่ เลขบนหน้าลองใช้จะเพี้ยนจากเลขที่ออกจริงเมื่อกฎการปัดเศษเปลี่ยน
  const items = useMemo(
    () => d.rows.map((r) => ({ qty: Number(r.qty) || 0, unit_price: Number(r.price) || 0 })),
    [d.rows],
  );
  const subtotal = useMemo(() => items.reduce((a, it) => a + it.qty * it.unit_price, 0), [items]);
  const totals = useMemo(
    () => calcDocTotals(items, Number(d.discount) || 0, d.vatMode, 0),
    [items, d.discount, d.vatMode],
  );

  return (
    <div className="min-h-screen bg-neutral-100 pb-16 print:min-h-0 print:bg-white print:pb-0">
      {/* ใช้ชุดกติกาเดียวกับหน้าพิมพ์จริง (dashboard/print) — อย่าเขียนใหม่
          สองข้อล่างคือตัวที่แก้อาการ "พิมพ์ออก 2 แผ่น + ชื่อเว็บติดหัวกระดาษ" ที่เจ้าของแคปมาจริง */}
      <style>{`
        .sheet { width: 100%; max-width: 210mm; padding: 1.15rem 1rem; font-size: 12px; }
        @media (min-width: 640px) { .sheet { padding: 15mm; font-size: 13px; min-height: 297mm; } }

        /* 1) @page margin: 0 — ชื่อเว็บ/URL/เลขหน้า ที่เบราว์เซอร์เติมเอง อยู่ใน "ขอบกระดาษ"
              ตัดขอบเป็นศูนย์ = ไม่มีที่ให้พิมพ์ = หาย (ขอบสวยใช้ padding 15mm ของ .sheet แทน)
           2) min-height ตอนพิมพ์ต้องเป็น auto — ถ้าตรึง 297mm เท่า A4 เป๊ะ แล้วเกินมาแม้พิกเซลเดียว
              จากการปัดเศษ เนื้อหาจะทะลักไปแผ่นสองทั้งที่ว่างเปล่า */
        @page { size: A4; margin: 0; }
        @media print {
          html, body { min-height: 0 !important; height: auto !important; background: #fff !important; }
          .sheet { width: 210mm !important; max-width: none !important; min-height: auto !important;
                   padding: 15mm !important; font-size: 13px !important; box-shadow: none !important;
                   page-break-after: avoid; }
          /* ช่องกรอกต้องกลายเป็นตัวหนังสือธรรมดาบนกระดาษ ไม่ใช่กล่องฟอร์ม */
          input { -webkit-appearance: none; appearance: none; color: #171717 !important; }
        }
      `}</style>

      {/* แถบเครื่องมือ — อยู่บนสุดเสมอ ไม่ต้องเลื่อนหา */}
      <div className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-2 px-3 py-2.5">
          <select value={d.docType} onChange={(e) => set({ docType: e.target.value as DocType })}
            className="h-11 rounded-xl border border-neutral-300 bg-white px-2.5 text-sm outline-none focus:border-emerald-500">
            <option value="quotation">ใบเสนอราคา</option>
            <option value="invoice">ใบแจ้งหนี้</option>
            <option value="receipt">ใบเสร็จรับเงิน</option>
          </select>
          <select value={d.vatMode} onChange={(e) => set({ vatMode: e.target.value as VatMode })}
            className="h-11 rounded-xl border border-neutral-300 bg-white px-2.5 text-sm outline-none focus:border-emerald-500">
            <option value="none">ไม่มี VAT</option>
            <option value="exclusive">VAT 7% แยกนอก</option>
            <option value="inclusive">VAT 7% รวมใน</option>
          </select>
          <div className="flex-1" />
          <button onClick={() => window.print()}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 text-sm font-medium hover:bg-neutral-50">
            <Printer className="h-4 w-4" /> พิมพ์ / PDF
          </button>
          <Link href="/signup?from=try"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500">
            สมัครฟรี <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {restored && (
          <p className="border-t border-neutral-100 bg-emerald-50/60 px-3 py-1.5 text-center text-xs text-emerald-800">
            กู้ร่างที่ค้างไว้ในเครื่องนี้ให้แล้ว — ร่างเก็บเฉพาะในเบราว์เซอร์ ล้างประวัติแล้วหาย
            {/* ปุ่มจริง — หน้าลองใช้คือด่านแรกที่คนยังไม่สมัครเจอ ปุ่มต้องดูเป็นปุ่ม */}
            <button onClick={() => { localStorage.removeItem(DRAFT_KEY); setD(EMPTY); setRestored(false); }}
              className={cn(ACTION_CHIP, "ml-2 border-emerald-300 text-emerald-800")}>เริ่มใหม่</button>
          </p>
        )}
      </div>

      {/* ⚠️ หน้านี้เคยไม่มี <h1> เลย (พบ 8 ส.ค. 2569 จากด่าน check:seo)
          Google ใช้ h1 เป็นตัวบอกว่าหน้านี้ "เกี่ยวกับอะไร" — ไม่มีเลยแปลว่า
          หน้าที่เป็นสินทรัพย์ SEO ดีที่สุดของเว็บ (ใช้ฟรีไม่ต้องสมัคร) ไม่มีหัวเรื่องให้จัดอันดับ
          วางไว้ตรงนี้เพราะเป็นข้อความแรกเหนือตัวเอกสาร และไม่รบกวนตอนสั่งพิมพ์ (print:hidden) */}
      <div className="mx-auto max-w-[210mm] px-3 pt-3 text-center print:hidden">
        <h1 className="text-[22px] font-bold tracking-tight text-neutral-900">
          ลองออกใบเสนอราคา ใบแจ้งหนี้ และใบเสร็จ ฟรี ไม่ต้องสมัคร
        </h1>
        <p className="mt-0.5 text-xs text-neutral-500">
          พิมพ์ลงบนตัวเอกสารได้เลย — ช่องที่แก้ได้จะขึ้นสีเขียวจาง ๆ ตอนชี้ · คำนวณ VAT และตัวอักษรจำนวนเงินให้อัตโนมัติ
        </p>
      </div>

      <div className="mx-auto px-3 py-3 sm:px-0 print:px-0 print:py-0">
        <div className="sheet mx-auto bg-white leading-relaxed text-neutral-900 shadow print:shadow-none">
          {/* หัวเอกสาร */}
          <div className="flex items-start justify-between gap-3 border-b-2 border-neutral-900 pb-3 sm:gap-6">
            <div className="min-w-0 flex-1">
              <Field wide value={d.sellerName} placeholder="ชื่อกิจการของคุณ"
                onChange={(e) => set({ sellerName: e.target.value })}
                className="text-base font-bold sm:text-lg" />
              <Field wide value={d.sellerAddress} placeholder="ที่อยู่"
                onChange={(e) => set({ sellerAddress: e.target.value })} className="text-neutral-600" />
              <Field wide value={d.sellerTaxId} placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก" inputMode="numeric"
                onChange={(e) => set({ sellerTaxId: e.target.value })} className="text-neutral-600" />
            </div>
            <div className="shrink-0 text-right">
              <p className="text-base font-bold sm:text-lg">{DOC_TYPE_TH[d.docType]}</p>
              <Field value={d.docNumber} placeholder="เลขที่" onChange={(e) => set({ docNumber: e.target.value })}
                className="w-32 text-right text-neutral-600" />
              {/* iOS Safari: input[type=date] จะกางตามเนื้อหาตัวเองและไม่สนใจ w-full
                  ต้อง appearance-none + min-w-0 max-w-full ไม่งั้นล้นออกนอกกระดาษ (เคยเกิดจริง) */}
              <ThaiDateInline value={d.issueDate} onChange={(v) => set({ issueDate: v })} ariaLabel="วันที่ออกเอกสาร"
                // min-h-11 = เป้ากด 44px บนจอ (วัดจริง 4 ส.ค. 2569 ได้แค่ 24px กดยากบนมือถือ)
                // ตอนพิมพ์ช่องนี้ถูกซ่อนอยู่แล้ว (print:hidden) จึงไม่กระทบหน้ากระดาษ
                className="ml-auto block min-h-11 min-w-0 max-w-full appearance-none rounded-[3px] border-0 bg-transparent px-1 py-0.5 text-right text-neutral-600 outline-none hover:bg-emerald-50/70 focus:bg-emerald-50 focus:ring-1 focus:ring-emerald-300 print:hidden" />
              <p className="hidden px-1 text-neutral-600 print:block">{dateOnlyTH(d.issueDate)}</p>
            </div>
          </div>

          {/* ผู้ซื้อ */}
          <div className="mt-3 border-b border-neutral-200 pb-3">
            <p className="text-xs text-neutral-400">ลูกค้า</p>
            <Field wide value={d.buyerName} placeholder="ชื่อลูกค้า / บริษัท"
              onChange={(e) => set({ buyerName: e.target.value })} className="font-semibold" />
            <Field wide value={d.buyerAddress} placeholder="ที่อยู่ลูกค้า"
              onChange={(e) => set({ buyerAddress: e.target.value })} className="text-neutral-600" />
            <Field wide value={d.buyerTaxId} placeholder="เลขผู้เสียภาษีลูกค้า (ถ้ามี)" inputMode="numeric"
              onChange={(e) => set({ buyerTaxId: e.target.value })} className="text-neutral-600" />
          </div>

          {/*
            รายการสินค้า — วัดจริงบนจอ 375px: ยัด ชื่อ+จำนวน+ราคา+รวม เป็นตารางแถวเดียว
            ทำให้ช่อง "รายการ" เหลือกว้าง 35px พิมพ์ชื่อสินค้าไม่ได้เลย
            (สี่คอลัมน์ที่ตรึงความกว้างไว้กินไป 284px จาก 351px)
            จึงใช้แบบเดียวกับฟอร์มจริง: มือถือแยก 2 ชั้น · sm+ และตอนพิมพ์ใช้ contents
            ให้ลูกไหลกลับเข้ากริดแถวเดียวเหมือนตารางบนกระดาษ A4
          */}
          <div className={cn(
            "mt-3 hidden border-b border-neutral-300 pb-1.5 text-xs text-neutral-500",
            "sm:grid sm:grid-cols-[minmax(0,1fr)_4rem_6rem_6rem_2rem] sm:gap-2",
            "print:grid print:grid-cols-[minmax(0,1fr)_4rem_6rem_6rem_2rem] print:gap-2",
          )}>
            <span>รายการ</span>
            <span className="text-right">จำนวน</span>
            <span className="text-right">ราคา/หน่วย</span>
            <span className="text-right">รวม</span>
            <span />
          </div>

          <div className="divide-y divide-neutral-100 border-t border-neutral-200 sm:border-t-0 print:border-t-0">
            {d.rows.map((r, i) => (
              <div key={i} className={cn(
                "py-1.5",
                "sm:grid sm:grid-cols-[minmax(0,1fr)_4rem_6rem_6rem_2rem] sm:items-center sm:gap-2 sm:py-0.5",
                "print:grid print:grid-cols-[minmax(0,1fr)_4rem_6rem_6rem_2rem] print:items-center print:gap-2 print:py-0.5",
              )}>
                <Field wide value={r.name} placeholder="ชื่อสินค้า/บริการ"
                  onChange={(e) => setRow(i, { name: e.target.value })} />
                {/* ชั้นล่างบนมือถือ · sm+/พิมพ์ กลายเป็นช่องของกริดแม่ด้วย contents
                    ป้าย "จำนวน" กับเครื่องหมาย × = มีเฉพาะมือถือ เพราะจอเล็กไม่มีหัวคอลัมน์ */}
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 sm:mt-0 sm:contents print:contents">
                  <span className="text-xs text-neutral-400 sm:hidden print:hidden">จำนวน</span>
                  <Field inputMode="decimal" value={r.qty} aria-label="จำนวน"
                    onChange={(e) => setRow(i, { qty: e.target.value })}
                    className="w-14 text-right sm:w-full" />
                  <span className="text-xs text-neutral-400 sm:hidden print:hidden">×</span>
                  <Field inputMode="decimal" value={r.price} placeholder="0.00" aria-label="ราคาต่อหน่วย"
                    onChange={(e) => setRow(i, { price: e.target.value })}
                    className="w-24 text-right sm:w-full" />
                  <span className="ml-auto pr-1 text-right tabular-nums sm:ml-0">
                    {bahtDoc((Number(r.qty) || 0) * (Number(r.price) || 0))}
                  </span>
                  <button aria-label={`ลบบรรทัดที่ ${i + 1}`} type="button"
                    disabled={d.rows.length === 1}
                    onClick={() => setD((c) => ({ ...c, rows: c.rows.filter((_, j) => j !== i) }))}
                    className="grid h-11 w-11 place-items-center rounded-lg text-neutral-300 enabled:hover:bg-red-50 enabled:hover:text-red-500 disabled:opacity-0 sm:h-8 sm:w-8 print:hidden">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setD((c) => ({ ...c, rows: [...c.rows, { name: "", qty: "1", price: "" }] }))}
            className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg pr-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 print:hidden">
            <Plus className="h-4 w-4" /> เพิ่มบรรทัด
          </button>

          {/* สรุปยอด
              ลำดับต้องบวกลบตามกันได้จริง: ยอดก่อนหักส่วนลด -> ลบส่วนลด -> ก่อนภาษี -> VAT -> สุทธิ
              ผู้สอบบัญชีอ่านเอกสารจากบนลงล่างแล้วต้องได้ยอดสุทธิเท่าที่พิมพ์ไว้ */}
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-[16rem] space-y-1 text-right tabular-nums">
              <div className="flex justify-between gap-4 text-neutral-600">
                <span>รวมเป็นเงิน</span><span>{bahtDoc(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-neutral-600 print:hidden">
                <span>ส่วนลด</span>
                <Field inputMode="decimal" value={d.discount} placeholder="0"
                  onChange={(e) => set({ discount: e.target.value })} className="w-20 text-right" />
              </div>
              {Number(d.discount) > 0 && (
                <div className="hidden justify-between gap-4 text-neutral-600 print:flex">
                  <span>ส่วนลด</span><span>-{bahtDoc(Number(d.discount))}</span>
                </div>
              )}
              {d.vatMode !== "none" && (
                <>
                  <div className="flex justify-between gap-4 text-neutral-600">
                    <span>มูลค่าก่อนภาษี</span><span>{bahtDoc(totals.exVat)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-neutral-600">
                    <span>{VAT_LABEL}</span><span>{bahtDoc(totals.vat)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between gap-4 border-t-2 border-neutral-900 pt-1 text-base font-bold">
                <span>ยอดรวมสุทธิ</span><span>{bahtDoc(totals.total)}</span>
              </div>
              <p className="text-xs text-neutral-500">({bahtText(totals.total)})</p>
            </div>
          </div>

          <div className="mt-4">
            <Field wide value={d.notes} placeholder="หมายเหตุ / เงื่อนไขการชำระเงิน (ไม่บังคับ)"
              onChange={(e) => set({ notes: e.target.value })} className="text-[12px] text-neutral-600" />
          </div>

          {/* ช่องเซ็น */}
          <div className="mt-10 grid grid-cols-2 gap-6 text-center text-xs sm:mt-14 sm:gap-10">
            <div>
              <div className="mx-auto w-full max-w-56 border-b border-dotted border-neutral-400 pb-7" />
              <p className="mt-2">ผู้รับเอกสาร / วันที่</p>
            </div>
            <div>
              <div className="mx-auto w-full max-w-56 border-b border-dotted border-neutral-400 pb-7" />
              <p className="mt-2 break-words">ผู้มีอำนาจลงนาม</p>
            </div>
          </div>
        </div>
      </div>

      {/* ชวนสมัคร — บอกตรง ๆ ว่าโหมดนี้ทำอะไรไม่ได้ ห้ามพูดเกินจริง
          โดยเฉพาะ "เก็บเข้าระบบ" ที่เคยเขียนไว้ตอนแรก: ร่างอยู่ในเบราว์เซอร์เท่านั้น
          ไม่ได้ถูกส่งเข้าบัญชีผู้ใช้หลังสมัคร เขียนแบบนั้นคือหลอกคนสมัคร */}
      <div className="mx-auto mt-4 max-w-[210mm] px-3 print:hidden">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5">
          <p className="text-sm font-semibold text-emerald-900">
            หน้านี้คือโหมดลองใช้ — พิมพ์เอกสารออกมาใช้ได้จริง แต่ยังไม่ได้ลงบัญชี
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-emerald-800/85">
            ร่างเก็บอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น กลับมาหน้านี้แล้วพิมพ์ต่อได้
            แต่ล้างประวัติหรือเปลี่ยนเครื่องแล้วหาย และจะไม่ตามไปอยู่ในบัญชีที่สมัคร
          </p>
          <ul className="mt-3 grid gap-1.5 text-xs text-emerald-900 sm:grid-cols-2">
            {[
              "เลขที่เอกสารรันต่อให้เอง ไม่ซ้ำ ไม่ข้าม",
              "ส่งลิงก์ให้ลูกค้าสแกน QR จ่ายได้ทันที",
              "ลงสมุดรายวันและตัดสต๊อกอัตโนมัติ",
              "สรุป ภ.พ.30 / ภ.ง.ด. พร้อมไฟล์ยื่นสรรพากร",
            ].map((t) => (
              <li key={t} className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{t}
              </li>
            ))}
          </ul>
          <Link href="/signup?from=try"
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-500">
            สมัครฟรี ไม่ต้องใส่บัตร <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

    </div>
  );
}
