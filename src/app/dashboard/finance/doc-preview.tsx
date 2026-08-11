"use client";
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
// ============================================================
import { X, Printer, TriangleAlert, CheckCircle2 } from "lucide-react";
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

/** วันที่แบบไทยบนเอกสาร (พ.ศ.) — ตรงกับหน้าพิมพ์จริง */
function thaiDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

export default function DocPreview({
  docType, seller, buyer, rows, totals, issueDate, dueDate, vatMode, whtRate, notes, onClose,
}: {
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-3 pb-10 pt-6 sm:items-start sm:px-4"
      onClick={onClose} role="dialog" aria-modal="true" aria-label="ตัวอย่างเอกสาร">
      <div className="w-full max-w-3xl space-y-3" onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
          <div>
            <h2 className="font-semibold">ตัวอย่างก่อนออกเอกสาร</h2>
            <p className="text-xs text-neutral-500">ยังไม่ได้บันทึก — ปิดหน้าต่างนี้แล้วแก้ต่อได้</p>
          </div>
          <button onClick={onClose} aria-label="ปิด"
            className="-m-2 rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
            <X className="h-5 w-5" />
          </button>
        </div>

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
                <p className="text-xs text-neutral-500">วันที่ {thaiDate(issueDate)}</p>
                {dueDate && <p className="text-xs text-neutral-500">ครบกำหนด {thaiDate(dueDate)}</p>}
              </div>
            </div>

            <div className="border-b border-neutral-200 py-3 text-sm">
              <p className="text-xs text-neutral-400">{docType === "quotation" ? "เสนอราคาให้" : "ลูกค้า"}</p>
              <p className="font-medium">{buyer.name || "(ยังไม่ได้เลือกลูกค้า)"}</p>
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
                {rows.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-neutral-400">ยังไม่ได้ใส่รายการ</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="py-2 pr-3">{r.name || <span className="text-neutral-400">(ยังไม่ได้ใส่ชื่อรายการ)</span>}</td>
                    <td className="py-2 text-right tabular-nums">{r.qty.toLocaleString("th-TH")}{r.unit ? ` ${r.unit}` : ""}</td>
                    <td className="py-2 text-right tabular-nums">{baht(r.unitPrice)}</td>
                    <td className="py-2 text-right tabular-nums">{baht(r.qty * r.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <div className="w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-neutral-500">รวมเป็นเงิน</span><span className="tabular-nums">{baht(totals.subtotal)}</span></div>
                {totals.discount > 0 && (
                  <div className="flex justify-between"><span className="text-neutral-500">ส่วนลด</span><span className="tabular-nums">-{baht(totals.discount)}</span></div>
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
                {totals.wht > 0 && (
                  <>
                    <div className="flex justify-between text-neutral-500"><span>หัก ณ ที่จ่าย {whtRate}%</span><span className="tabular-nums">-{baht(totals.wht)}</span></div>
                    <div className="flex justify-between font-semibold text-emerald-700"><span>ยอดชำระจริง</span><span className="tabular-nums">{baht(totals.cashDue)}</span></div>
                  </>
                )}
              </div>
            </div>

            {notes && (
              <div className="mt-4 border-t border-neutral-200 pt-3 text-xs text-neutral-600">
                <p className="text-neutral-400">หมายเหตุ</p>
                <p className="whitespace-pre-wrap">{notes}</p>
              </div>
            )}

            <p className="mt-6 text-center text-[11px] text-neutral-400">
              นี่คือตัวอย่างบนหน้าจอ — เอกสารจริงจะมีเลขที่ ลายเซ็น และ QR รับชำระเงิน หลังกดออกเอกสาร
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl bg-white px-4 py-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            <Printer className="mr-1.5 h-4 w-4" /> กลับไปแก้ไข
          </Button>
        </div>
      </div>
    </div>
  );
}
