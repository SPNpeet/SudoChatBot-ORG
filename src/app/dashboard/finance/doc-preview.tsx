"use client";
import { ThaiDateInline } from "@/components/date-field";
// ============================================================
//  ดูตัวอย่างเอกสารก่อนออกจริง
//
//  ทำไมต้องมี (11 ส.ค. 2569 — เจ้าของสั่งเอง):
//  เมื่อ 4 ส.ค. เราทำหน้า `/try` ให้คนที่ยังไม่สมัครได้ "เห็นเอกสารระหว่างพิมพ์"
//  แต่จงใจไม่แตะฟอร์มจริงเพื่อไม่ให้กระทบคนที่ใช้อยู่ ผลข้างเคียงคือ
//  **ลูกค้าที่จ่ายเงินแล้วยังต้องออกเอกสารแบบเดาหน้าตาอยู่** ซึ่งกลับหัวกลับหาง
//  หน้าต่างนี้ปิดช่องนั้นโดยไม่แตะตรรกะการบันทึกเลยสักบรรทัด
//
//  ⚠️ ตัวเลขทุกตัวรับมาจากฟอร์ม ซึ่งคำนวณด้วย calcDocTotals ตัวเดียวกับที่ server ใช้
//  ห้ามคำนวณเองซ้ำในไฟล์นี้เด็ดขาด — สองสูตรจะเพี้ยนจากกันวันใดวันหนึ่ง
//
//  คุณค่าที่มากกว่า "เห็นหน้าตา": ตรวจครบถ้วนตาม ม.86/4 ให้ตั้งแต่ยังไม่ออกใบ
//  เพราะใบกำกับภาษีที่ออกแล้วแก้ไม่ได้ ต้องยกเลิก+ออกใหม่ หรือออกใบลดหนี้เท่านั้น
//  จุดที่หายบ่อยสุดคือ "ที่อยู่/เลขผู้เสียภาษีผู้ซื้อ" ซึ่งฟอร์มเดิมไม่ได้บอกอะไรเลย
//
//  === แก้ได้สดบนใบ (19 ส.ค. 2569) ===
//  เดิมพรีวิวเป็นหน้าต่างอ่านอย่างเดียว เห็นว่าผิดแล้วต้องปิด -> เลื่อนหาช่องในฟอร์ม -> แก้ -> เปิดดูใหม่
//  วนแบบนี้ทุกครั้งที่แก้ตัวเลขหนึ่งตัว ซึ่งเป็นสิ่งที่คู่แข่งทำได้ดีกว่าเราชัดเจน
//
//  ⚠️ สถาปัตยกรรมที่ห้ามเปลี่ยน: ไฟล์นี้ **ไม่ถือ state และไม่คำนวณเอง**
//  ทุกการแก้ยิงกลับไปที่ฟอร์มผ่าน `edit.*` แล้วฟอร์มคำนวณด้วย calcDocTotals ตัวเดิม
//  แล้วส่ง props ชุดใหม่ลงมา -> ตัวเลขบนใบขยับตามทันที
//  ถ้าวันหนึ่งมีคนย้ายการคำนวณเข้ามาไว้ในนี้ จะได้สองสูตรที่เพี้ยนจากกันเมื่อไหร่ก็ได้
//  และสูตรที่ผิดจะไปโผล่บน "ใบที่ลูกค้าเห็น" ซึ่งแก้ย้อนหลังไม่ได้
// ============================================================
import { X, TriangleAlert, CheckCircle2, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui";
import { baht } from "@/lib/utils";
import { DOC_TYPE_TH } from "@/lib/finance";
import { checkTaxInvoice, formatTaxId } from "@/lib/tax-th";
import type { DocType, VatMode } from "@/lib/types/finance";

export interface PreviewSeller {
  name: string; address?: string | null; taxId?: string | null; branch?: string | null;
}
export interface PreviewBuyer {
  name: string; address?: string | null; taxId?: string | null;
}
export interface PreviewRow { name: string; qty: number; unit: string; unitPrice: number }
export interface PreviewTotals {
  subtotal: number; discount: number; exVat: number; vat: number; total: number; wht: number; cashDue: number;
}

/**
 * ชุดคำสั่งแก้ที่ฟอร์มส่งลงมา — ไม่ส่ง = พรีวิวเป็นแบบอ่านอย่างเดียวเหมือนเดิมทุกประการ
 * (หน้า /try ของคนที่ยังไม่สมัครยังใช้แบบอ่านอย่างเดียวอยู่ ห้ามบังคับให้ทุกที่แก้ได้)
 */
export interface PreviewEdit {
  setRow: (i: number, patch: { name?: string; qty?: number; unitPrice?: number }) => void;
  addRow: () => void;
  removeRow: (i: number) => void;
  setBuyerName: (v: string) => void;
  setDiscount: (v: number) => void;
  setVatMode: (v: VatMode) => void;
  setWhtRate: (v: number) => void;
  setIssueDate: (v: string) => void;
  setDueDate: (v: string) => void;
  setNotes: (v: string) => void;
  /** ออกเอกสารจากในป๊อปอัปเลย ไม่ต้องปิดไปกดข้างนอก */
  onIssue: () => void;
  issuing: boolean;
  issueLabel: string;
  /** แก้ชื่อลูกค้าไม่ได้เมื่อเลือกจากรายชื่อ (ต้องไปแก้ที่ผู้ติดต่อ) */
  buyerLocked: boolean;
}

/** วันที่แบบไทยบนเอกสาร (พ.ศ.) — ตรงกับหน้าพิมพ์จริง */
function thaiDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

/** ช่องกรอกที่ "อยู่บนใบ" — ไม่มีกรอบจนกว่าจะโฟกัส เพื่อให้ใบยังดูเหมือนเอกสารจริง */
const CELL =
  "w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 outline-none " +
  "hover:border-neutral-200 hover:bg-neutral-50 " +
  "focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15";

export default function DocPreview({
  docType, seller, buyer, rows, totals, issueDate, dueDate, vatMode, whtRate, notes, onClose, edit, variant = "modal", sample = false,
}: {
  /** โหมด "เอกสารตัวอย่าง" (ป๊อบอัพบนแดชบอร์ด): ไม่มีหัว/ท้ายของฟอร์ม เพราะไม่มีฟอร์มให้กลับไปแก้
   *  — ตัวเนื้อใบ (ด่าน ม.86/4 · สูตรยอด) เหมือนเดิมทุกบรรทัด นี่คือเหตุผลที่เป็น prop ไม่ใช่คอมโพเนนต์ใหม่ */
  sample?: boolean;
  docType: DocType;
  seller: PreviewSeller;
  buyer: PreviewBuyer;
  rows: PreviewRow[];
  totals: PreviewTotals;
  issueDate: string;
  dueDate: string;
  vatMode: VatMode;
  whtRate: number;
  notes: string;
  onClose: () => void;
  edit?: PreviewEdit;
  /**
   * "modal" = ทับทั้งจอ (ค่าเริ่มต้น ใช้ในหน้าฟอร์มออกเอกสาร)
   * "panel" = ฝังในคอลัมน์ ไม่มีฉากดำ ไม่ดักคลิกนอกกรอบ (แผงค้างข้างขวาในหน้าแชท)
   *
   * ⚠️ ต้องเป็น prop ไม่ใช่ก๊อปคอมโพเนนต์ไปทำอีกตัว
   * ตัวนี้มีทั้งด่านตรวจใบกำกับภาษีตาม ม.86/4 และสูตรยอดที่ต้องตรงกับฟอร์ม
   * แยกร่างเมื่อไหร่ วันหนึ่งจะแก้กฎภาษีที่ร่างเดียวแล้วอีกร่างเงียบ ๆ ผิดต่อไป
   */
  variant?: "modal" | "panel";
}) {
  // ใบกำกับภาษีเกิดขึ้นเมื่อมี VAT เท่านั้น — ใบเสนอราคาไม่ใช่ใบกำกับภาษีไม่ว่ากรณีใด
  const isTaxInvoice = vatMode !== "none" && docType !== "quotation";
  const issues = isTaxInvoice
    ? checkTaxInvoice({
        sellerName: seller.name, sellerAddress: seller.address, sellerTaxId: seller.taxId,
        buyerName: buyer.name, buyerAddress: buyer.address, buyerTaxId: buyer.taxId,
        // เลขที่เอกสารระบบออกให้ตอนบันทึก จึงถือว่าผ่านข้อนี้เสมอในขั้นพรีวิว
        docNumber: "(ระบบออกให้ตอนบันทึก)", issueDate, itemCount: rows.length,
      })
    : [];

  const title = isTaxInvoice ? `${DOC_TYPE_TH[docType]} / ใบกำกับภาษี` : DOC_TYPE_TH[docType];

  const panel = variant === "panel";

  const body = (
    <div className={panel ? "space-y-3" : "w-full max-w-3xl space-y-3"}
      onClick={panel ? undefined : (e) => e.stopPropagation()}>

        {!sample && <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
          <div>
            <h2 className="font-semibold">{edit ? "ตัวอย่างเอกสาร — แก้ได้บนใบเลย" : "ตัวอย่างก่อนออกเอกสาร"}</h2>
            <p className="flex items-center gap-1 text-xs text-neutral-500">
              {edit
                ? <><Pencil className="h-3 w-3" /> คลิกที่ตัวเลขหรือข้อความบนใบเพื่อแก้ ยอดคำนวณใหม่ทันที · ยังไม่บันทึกจนกว่าจะกดออกเอกสาร</>
                : "ยังไม่ได้บันทึก — ปิดหน้าต่างนี้แล้วแก้ต่อได้"}
            </p>
          </div>
          <button onClick={onClose} aria-label="ปิด"
            className="-m-2 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
            <X className="h-5 w-5" />
          </button>
        </div>}

        {/* ด่านความครบถ้วนตามกฎหมาย — ขึ้นก่อนตัวเอกสาร เพราะเป็นเหตุผลหลักที่ต้องดูก่อนออก */}
        {isTaxInvoice && (
          <div className={`rounded-2xl px-4 py-3 text-sm ${issues.length ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> ข้อมูลครบตามที่ใบกำกับภาษีต้องมี (ม.86/4)
              </p>
            ) : (
              <>
                <p className="flex items-center gap-2 font-medium">
                  <TriangleAlert className="h-4 w-4 shrink-0" /> ยังขาด {issues.length} จุดที่ใบกำกับภาษีต้องมีตามกฎหมาย
                </p>
                <ul className="mt-2 space-y-1">
                  {issues.map((i) => (
                    <li key={i.field} className="text-xs leading-relaxed">
                      <b>{i.field}</b> — {i.why}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">
                  ออกไปทั้งอย่างนี้ได้ แต่ใบกำกับภาษีที่ออกแล้วแก้ไม่ได้ ต้องยกเลิกแล้วออกใหม่ หรือออกใบลดหนี้ — เติมให้ครบก่อนจะง่ายกว่ามาก
                </p>
              </>
            )}
          </div>
        )}

        {/* ตัวเอกสาร — ใช้ภาษาภาพเดียวกับหน้าพิมพ์จริง */}
        <div className="overflow-x-auto rounded-2xl bg-white p-5 sm:p-8">
          <div className="min-w-[560px]">
            <div className="flex items-start justify-between gap-6 border-b border-neutral-200 pb-4">
              <div className="text-sm">
                <p className="text-base font-bold">{seller.name || "(ยังไม่ได้ตั้งชื่อกิจการ)"}</p>
                {seller.address && <p className="whitespace-pre-wrap text-neutral-600">{seller.address}</p>}
                {seller.taxId && (
                  <p className="text-neutral-600">
                    เลขประจำตัวผู้เสียภาษี {formatTaxId(seller.taxId)}
                    {isTaxInvoice && seller.branch && <span className="font-semibold"> ({seller.branch})</span>}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold">{title}</p>
                <p className="mt-1 text-xs text-neutral-500">เลขที่ — ระบบออกให้ตอนบันทึก</p>
                {edit ? (
                  <div className="mt-1 space-y-1">
                    <label className="flex items-center justify-end gap-1 text-xs text-neutral-500">
                      วันที่
                      <ThaiDateInline value={issueDate} onChange={edit.setIssueDate}
                        ariaLabel="วันที่ออกเอกสาร" className={`${CELL} w-[9.5rem] text-right`} />
                    </label>
                    {docType !== "receipt" && (
                      <label className="flex items-center justify-end gap-1 text-xs text-neutral-500">
                        ครบกำหนด
                        <ThaiDateInline value={dueDate} onChange={edit.setDueDate}
                          ariaLabel="วันครบกำหนดชำระ" className={`${CELL} w-[9.5rem] text-right`} />
                      </label>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-neutral-500">วันที่ {thaiDate(issueDate)}</p>
                    {dueDate && <p className="text-xs text-neutral-500">ครบกำหนด {thaiDate(dueDate)}</p>}
                  </>
                )}
              </div>
            </div>

            <div className="border-b border-neutral-200 py-3 text-sm">
              <p className="text-xs text-neutral-400">{docType === "quotation" ? "เสนอราคาให้" : "ลูกค้า"}</p>
              {edit && !edit.buyerLocked ? (
                <input value={buyer.name} onChange={(e) => edit.setBuyerName(e.target.value)}
                  placeholder="ชื่อลูกค้า" aria-label="ชื่อลูกค้า"
                  className={`${CELL} font-medium`} />
              ) : (
                <p className="font-medium">{buyer.name || "(ยังไม่ได้เลือกลูกค้า)"}</p>
              )}
              {buyer.address && <p className="whitespace-pre-wrap text-neutral-600">{buyer.address}</p>}
              {buyer.taxId && <p className="text-neutral-600">เลขประจำตัวผู้เสียภาษี {formatTaxId(buyer.taxId)}</p>}
            </div>

            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                  <th className="py-2 text-left font-medium">รายการ</th>
                  <th className="py-2 text-right font-medium">จำนวน</th>
                  <th className="py-2 text-right font-medium">ราคา/หน่วย</th>
                  <th className="py-2 text-right font-medium">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !edit ? (
                  <tr><td colSpan={4} className="py-6 text-center text-neutral-400">ยังไม่ได้ใส่รายการ</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={i} className="group border-b border-neutral-100">
                    <td className="py-1.5 pr-3">
                      {edit ? (
                        <input value={r.name} onChange={(e) => edit.setRow(i, { name: e.target.value })}
                          placeholder="ชื่อรายการ" aria-label={`ชื่อรายการบรรทัดที่ ${i + 1}`} className={CELL} />
                      ) : (r.name || <span className="text-neutral-400">(ยังไม่ได้ใส่ชื่อรายการ)</span>)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {edit ? (
                        <input type="number" inputMode="decimal" min="0" step="any" value={r.qty || ""}
                          onChange={(e) => edit.setRow(i, { qty: Number(e.target.value) || 0 })}
                          aria-label={`จำนวนบรรทัดที่ ${i + 1}`} className={`${CELL} text-right`} />
                      ) : <>{r.qty.toLocaleString("th-TH")}{r.unit ? ` ${r.unit}` : ""}</>}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {edit ? (
                        <input type="number" inputMode="decimal" min="0" step="any" value={r.unitPrice || ""}
                          onChange={(e) => edit.setRow(i, { unitPrice: Number(e.target.value) || 0 })}
                          aria-label={`ราคาต่อหน่วยบรรทัดที่ ${i + 1}`} className={`${CELL} text-right`} />
                      ) : baht(r.unitPrice)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        {baht(r.qty * r.unitPrice)}
                        {edit && rows.length > 1 && (
                          <button type="button" onClick={() => edit.removeRow(i)} aria-label={`ลบบรรทัดที่ ${i + 1}`}
                            className="rounded p-1 text-neutral-300 hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:text-neutral-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {edit && (
              <button type="button" onClick={edit.addRow}
                className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm text-emerald-700 hover:bg-emerald-50">
                <Plus className="h-4 w-4" /> เพิ่มรายการ
              </button>
            )}

            <div className="mt-4 flex justify-end">
              <div className="w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-neutral-500">รวมเป็นเงิน</span><span className="tabular-nums">{baht(totals.subtotal)}</span></div>
                {edit ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">ส่วนลด</span>
                    <input type="number" inputMode="decimal" min="0" step="any" value={totals.discount || ""}
                      onChange={(e) => edit.setDiscount(Number(e.target.value) || 0)}
                      placeholder="0" aria-label="ส่วนลด"
                      className={`${CELL} max-w-[7rem] text-right tabular-nums`} />
                  </div>
                ) : totals.discount > 0 && (
                  <div className="flex justify-between"><span className="text-neutral-500">ส่วนลด</span><span className="tabular-nums">-{baht(totals.discount)}</span></div>
                )}
                {edit && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-neutral-500">ภาษีมูลค่าเพิ่ม</span>
                    <select value={vatMode} onChange={(e) => edit.setVatMode(e.target.value as VatMode)}
                      aria-label="รูปแบบภาษีมูลค่าเพิ่ม"
                      className={`${CELL} max-w-[9rem] cursor-pointer text-right`}>
                      <option value="none">ไม่คิด VAT</option>
                      <option value="exclusive">VAT แยกนอก</option>
                      <option value="inclusive">VAT รวมใน</option>
                    </select>
                  </div>
                )}
                {vatMode !== "none" && (
                  <>
                    <div className="flex justify-between"><span className="text-neutral-500">มูลค่าก่อนภาษี</span><span className="tabular-nums">{baht(totals.exVat)}</span></div>
                    <div className="flex justify-between"><span className="text-neutral-500">ภาษีมูลค่าเพิ่ม</span><span className="tabular-nums">{baht(totals.vat)}</span></div>
                  </>
                )}
                <div className="flex justify-between border-t border-neutral-300 pt-1 text-base font-bold">
                  <span>ยอดรวมทั้งสิ้น</span><span className="tabular-nums">{baht(totals.total)}</span>
                </div>
                {edit && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">หัก ณ ที่จ่าย</span>
                    <select value={String(whtRate)} onChange={(e) => edit.setWhtRate(Number(e.target.value) || 0)}
                      aria-label="อัตราหักภาษี ณ ที่จ่าย"
                      className={`${CELL} max-w-[9rem] cursor-pointer text-right`}>
                      <option value="0">ไม่หัก</option>
                      <option value="1">1% ค่าขนส่ง</option>
                      <option value="2">2% ค่าโฆษณา</option>
                      <option value="3">3% ค่าบริการ/จ้างทำของ</option>
                      <option value="5">5% ค่าเช่า</option>
                    </select>
                  </div>
                )}
                {totals.wht > 0 && (
                  <>
                    <div className="flex justify-between text-neutral-500"><span>หัก ณ ที่จ่าย {whtRate}%</span><span className="tabular-nums">-{baht(totals.wht)}</span></div>
                    <div className="flex justify-between font-semibold text-emerald-700"><span>ยอดชำระจริง</span><span className="tabular-nums">{baht(totals.cashDue)}</span></div>
                  </>
                )}
              </div>
            </div>

            {edit ? (
              <div className="mt-4 border-t border-neutral-200 pt-3 text-xs text-neutral-600">
                <p className="text-neutral-400">หมายเหตุ</p>
                <textarea value={notes} onChange={(e) => edit.setNotes(e.target.value)}
                  rows={2} placeholder="เช่น เงื่อนไขการชำระเงิน หรือข้อความถึงลูกค้า" aria-label="หมายเหตุ"
                  className={`${CELL} mt-0.5 resize-y`} />
              </div>
            ) : notes ? (
              <div className="mt-4 border-t border-neutral-200 pt-3 text-xs text-neutral-600">
                <p className="text-neutral-400">หมายเหตุ</p>
                <p className="whitespace-pre-wrap">{notes}</p>
              </div>
            ) : null}

            <p className="mt-6 text-center text-[11px] text-neutral-400">
              นี่คือตัวอย่างบนหน้าจอ — เอกสารจริงจะมีเลขที่ ลายเซ็น และ QR รับชำระเงิน หลังกดออกเอกสาร
            </p>
          </div>
        </div>

        {!sample && <div className="sticky bottom-0 flex flex-col gap-2 rounded-2xl bg-white px-4 py-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-500">
            {edit ? <>ยอดที่ลูกค้าต้องจ่าย <b className="text-neutral-900 tabular-nums">{baht(totals.wht > 0 ? totals.cashDue : totals.total)}</b></> : "ปิดหน้าต่างเพื่อกลับไปแก้ในฟอร์ม"}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={onClose}>ปิด</Button>
            {edit && (
              <Button variant="brand" onClick={edit.onIssue} disabled={edit.issuing}>
                {edit.issuing ? "กำลังบันทึก..." : edit.issueLabel}
              </Button>
            )}
          </div>
        </div>}
      </div>
  );

  if (panel) return body;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-3 pb-10 pt-6 sm:items-start sm:px-4"
      onClick={onClose} role="dialog" aria-modal="true" aria-label="ตัวอย่างเอกสาร">
      {body}
    </div>
  );
}
