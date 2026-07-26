// ============================================================
//  หน้าพิมพ์เอกสาร A4 — ใบเสนอราคา/ใบแจ้งหนี้/ใบเสร็จ (+ใบกำกับภาษี)
//  ?form=wht = หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)
//  เปิดแล้วกด Ctrl+P / ปุ่มพิมพ์ -> Save as PDF ส่งลูกค้า/เก็บเข้าแฟ้มได้เลย
// ============================================================
import { getCurrentShop } from "@/lib/shop";
import { notFound } from "next/navigation";
import { bahtDoc, dateOnlyTH } from "@/lib/utils";
import { bahtText, DOC_TYPE_TH } from "@/lib/finance";
import { promptPayPayload } from "@/lib/promptpay";
import { docOutstanding } from "@/lib/finance";
import type { DocType, FinDoc } from "@/lib/types/finance";
import { branchLabel, shouldPrintBranch, checkTaxInvoice, formatTaxId, WHT_INCOME_TYPES } from "@/lib/tax-th";
import { TriangleAlert } from "lucide-react";
import PrintButton from "./print-button";
import { rdFormFor } from "@/lib/tax-th";
import { VAT_LABEL, VAT_PERCENT_LABEL } from "@/lib/tax-th";

export const dynamic = "force-dynamic";

export default async function PrintDocPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ form?: string }>;
}) {
  const { supabase, shop } = await getCurrentShop();
  const { id } = await params;
  const { form } = await searchParams;

  const [{ data }, { data: pay }] = await Promise.all([
    supabase.from("fin_docs").select("*, fin_doc_items(*)").eq("id", id).eq("shop_id", shop.id).maybeSingle(),
    supabase.from("shop_payment_settings").select("promptpay_id,account_name,bank_name").eq("shop_id", shop.id).maybeSingle(),
  ]);
  if (!data) notFound();
  const doc = data as unknown as FinDoc;

  const shopName = shop.billing_name || shop.name;
  const isWhtForm = form === "wht" && Number(doc.wht_amount) > 0;
  // "ใบกำกับภาษี" = ใบเสร็จที่คิด VAT เท่านั้น — ใบเสนอราคา/ใบแจ้งหนี้ไม่ใช่ใบกำกับภาษี
  const isTaxInvoice = !isWhtForm && doc.doc_type === "receipt" && doc.vat_mode !== "none";
  // ตรวจตาม ม.86/4 ก่อนพิมพ์ ขาดข้อไหนต้องบอกบนจอ ไม่ปล่อยให้พิมพ์ใบที่ใช้ไม่ได้ออกไปเงียบ ๆ
  const taxIssues = isTaxInvoice
    ? checkTaxInvoice({
        sellerName: shopName, sellerAddress: shop.billing_address, sellerTaxId: shop.tax_id,
        buyerName: doc.contact_name, buyerAddress: doc.contact_address, buyerTaxId: doc.contact_tax_id,
        docNumber: doc.doc_number, issueDate: doc.issue_date, itemCount: (doc.fin_doc_items ?? []).length,
      })
    : [];

  // QR พร้อมเพย์ยอดค้าง (เฉพาะใบแจ้งหนี้ที่ยังไม่จ่ายครบ)
  let qrDataUrl: string | null = null;
  const outstanding = docOutstanding(doc);
  if (!isWhtForm && doc.doc_type === "invoice" && outstanding > 0 && pay?.promptpay_id) {
    const QRCode = (await import("qrcode")).default;
    qrDataUrl = await QRCode.toDataURL(promptPayPayload(pay.promptpay_id, outstanding), { width: 240, margin: 1 });
  }

  const title = isWhtForm
    ? "หนังสือรับรองการหักภาษี ณ ที่จ่าย"
    : doc.doc_type === "receipt" && doc.vat_mode !== "none"
      ? "ใบเสร็จรับเงิน / ใบกำกับภาษี"
      : DOC_TYPE_TH[doc.doc_type as DocType];

  return (
    <div className="min-h-screen bg-neutral-100 py-4 sm:py-6 print:bg-white print:py-0">
      {/* บนจอ: กระดาษยืดตามความกว้างจอ (มือถืออ่านได้เต็มตา ไม่ต้องเลื่อนซ้าย-ขวา ตัวหนังสือไม่ถูกย่อจนมองไม่เห็น)
          ตอนพิมพ์/บันทึก PDF: บังคับกลับเป็น A4 210x297mm ขอบ 15mm เป๊ะเสมอ */}
      <style>{`
        .sheet { width: 100%; max-width: 210mm; padding: 1.15rem 1rem; font-size: 11.5px; }
        @media (min-width: 640px) { .sheet { padding: 15mm; font-size: 13px; min-height: 297mm; } }
        @media print {
          .sheet { width: 210mm !important; max-width: none !important; min-height: 297mm !important;
                   padding: 15mm !important; font-size: 13px !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="mx-auto mb-3 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-3 print:hidden">
        <p className="text-xs text-neutral-500 sm:text-sm">พรีวิวเอกสาร — กดพิมพ์แล้วเลือก Save as PDF ได้</p>
        <PrintButton />
      </div>

      {/* ใบกำกับภาษีที่ข้อมูลไม่ครบตาม ม.86/4 = ผู้ซื้อขอคืนภาษีซื้อไม่ได้ และผู้ขายเสี่ยงเบี้ยปรับ
          ต้องเตือนบนจอก่อนพิมพ์เสมอ (ไม่พิมพ์ลงกระดาษ เพราะเป็นคำเตือนถึงผู้ใช้ ไม่ใช่ส่วนของเอกสาร) */}
      {taxIssues.length > 0 && (
        <div className="mx-auto mb-3 max-w-[210mm] rounded-2xl border border-red-300 bg-red-50 px-4 py-3 print:hidden">
          <p className="flex items-center gap-2 text-sm font-bold text-red-700">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            ใบกำกับภาษีใบนี้ยังไม่ครบตามกฎหมาย — ลูกค้าเอาไปขอคืนภาษีซื้อไม่ได้
          </p>
          <ul className="mt-2 space-y-1">
            {taxIssues.map((x) => (
              <li key={x.field} className="text-[12px] leading-relaxed text-red-700">
                <b>ขาด{x.field}</b> — {x.why}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-red-600">
            เติมข้อมูลให้ครบแล้วเปิดหน้านี้ใหม่ ระบบจะออกใบที่ใช้ได้จริงให้ทันที
          </p>
        </div>
      )}

      <div className="mx-auto px-3 sm:px-0 print:px-0">
      <div className="sheet mx-auto bg-white leading-relaxed text-neutral-900 shadow print:shadow-none">
        {isWhtForm ? (
          <WhtCert doc={doc} shopName={shopName} shopTaxId={shop.tax_id ?? null} shopAddress={shop.billing_address ?? null} />
        ) : (
          <>
            {/* หัวเอกสาร */}
            <div className="flex items-start justify-between gap-3 border-b-2 border-neutral-900 pb-4 sm:gap-6">
              <div className="min-w-0">
                <p className="text-base font-bold sm:text-lg">{shopName}</p>
                {shop.billing_address && <p className="whitespace-pre-wrap text-neutral-600">{shop.billing_address}</p>}
                {shop.tax_id && (
                  <p className="text-neutral-600">
                    เลขประจำตัวผู้เสียภาษี {formatTaxId(shop.tax_id)}
                    {/* ประกาศอธิบดีฯ ฉบับที่ 199 บังคับระบุสำนักงานใหญ่/สาขา บนใบกำกับภาษีเต็มรูป
                        ขาดข้อความนี้ = ผู้ซื้อขอคืนภาษีซื้อไม่ได้ */}
                    {isTaxInvoice && shouldPrintBranch(shop.billing_address) && <span className="font-semibold"> ({branchLabel(shop.branch)})</span>}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-bold leading-tight sm:text-xl">{title}</p>
                {/* พิมพ์แค่ "ต้นฉบับ" เท่านั้น — ข้อความ "เอกสารออกเป็นชุด" ใช้ได้เฉพาะกรณีที่
                    ออกใบกำกับภาษีรวมชุดกับใบส่งของ/ใบเสร็จในการพิมพ์ครั้งเดียว ซึ่งระบบนี้ไม่ได้ทำ
                    ถ้าพิมพ์ทั้งที่ไม่ได้ออกเป็นชุด = ข้อความบนเอกสารไม่ตรงความจริง */}
                {isTaxInvoice && <p className="text-[11px] font-medium text-neutral-500">ต้นฉบับ</p>}
              </div>
            </div>

            {/* ข้อมูลเอกสาร + ลูกค้า */}
            <div className="mt-4 flex justify-between gap-3 sm:gap-6">
              <div className="min-w-0 max-w-[58%]">
                <p className="text-[11px] font-semibold text-neutral-400">ลูกค้า</p>
                <p className="break-words font-semibold">{doc.contact_name ?? "-"}</p>
                {doc.contact_address && <p className="whitespace-pre-wrap break-words text-neutral-600">{doc.contact_address}</p>}
                {doc.contact_tax_id && (
                  <p className="text-neutral-600">
                    เลขประจำตัวผู้เสียภาษี {formatTaxId(doc.contact_tax_id)}
                    {isTaxInvoice && shouldPrintBranch(doc.contact_address) && <span className="font-semibold"> ({branchLabel(doc.contact_branch)})</span>}
                  </p>
                )}
              </div>
              <table className="shrink-0 text-right">
                <tbody>
                  <tr><td className="pr-3 text-neutral-400">เลขที่</td><td className="font-semibold">{doc.doc_number}</td></tr>
                  <tr><td className="pr-3 text-neutral-400">วันที่</td><td>{dateOnlyTH(doc.issue_date)}</td></tr>
                  {doc.due_date && <tr><td className="pr-3 text-neutral-400">{doc.doc_type === "quotation" ? "ยืนราคาถึง" : "ครบกำหนด"}</td><td>{dateOnlyTH(doc.due_date)}</td></tr>}
                </tbody>
              </table>
            </div>

            {/* ตารางรายการ — คอลัมน์กว้างคงที่ + ตัวเลข tabular-nums ให้หลักตรงกันทุกบรรทัด */}
            <table className="mt-5 w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-[7%]" /><col /><col className="w-[14%]" /><col className="w-[18%]" /><col className="w-[18%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-t border-neutral-900 text-[11px]">
                  <th className="py-2 text-left font-semibold">#</th>
                  <th className="py-2 text-left font-semibold">รายการ</th>
                  <th className="py-2 text-right font-semibold">จำนวน</th>
                  <th className="py-2 text-right font-semibold">ราคา/หน่วย</th>
                  <th className="py-2 text-right font-semibold">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {(doc.fin_doc_items ?? []).map((it, i) => (
                  <tr key={i} className="border-b border-neutral-100 align-top">
                    <td className="py-1.5 pr-2 tabular-nums text-neutral-400">{i + 1}</td>
                    <td className="py-1.5 pr-2 break-words">{it.name}</td>
                    <td className="py-1.5 text-right tabular-nums">{Number(it.qty).toLocaleString()}{it.unit ? ` ${it.unit}` : ""}</td>
                    <td className="py-1.5 text-right tabular-nums">{bahtDoc(it.unit_price)}</td>
                    <td className="py-1.5 text-right tabular-nums">{bahtDoc(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* สรุปยอด — มือถือวางซ้อนกัน (ตารางยอดอยู่บน อ่านก่อน) จอใหญ่วางคู่กันซ้าย-ขวา */}
            <div className="mt-4 flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="flex-1">
                <p className="rounded bg-neutral-50 px-3 py-2 text-[12px]">
                  ({bahtText(Number(doc.total))})
                </p>
                {doc.notes && <p className="mt-2 whitespace-pre-wrap text-[12px] text-neutral-500">หมายเหตุ: {doc.notes}</p>}
                {qrDataUrl && (
                  <div className="mt-4 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="PromptPay QR" className="h-28 w-28" />
                    <div className="text-[12px] text-neutral-600">
                      <p className="font-semibold">สแกนจ่ายยอดค้าง {bahtDoc(outstanding)} บาท</p>
                      <p>พร้อมเพย์ {pay?.promptpay_id}</p>
                      {pay?.account_name && <p>{pay.account_name}{pay.bank_name ? ` · ${pay.bank_name}` : ""}</p>}
                    </div>
                  </div>
                )}
              </div>
              <table className="w-full shrink-0 tabular-nums sm:w-[250px]">
                <tbody>
                  <tr><td className="py-0.5 pr-4 text-neutral-500">รวมเป็นเงิน</td><td className="py-0.5 text-right">{bahtDoc(Number(doc.subtotal) - Number(doc.discount))}</td></tr>
                  {Number(doc.discount) > 0 && <tr><td className="py-0.5 pr-4 text-neutral-500">ส่วนลด</td><td className="py-0.5 text-right">-{bahtDoc(doc.discount)}</td></tr>}
                  {doc.vat_mode !== "none" && (
                    <>
                      <tr><td className="py-0.5 pr-4 text-neutral-500">มูลค่าก่อนภาษี</td><td className="py-0.5 text-right">{bahtDoc(Number(doc.total) - Number(doc.vat_amount))}</td></tr>
                      <tr><td className="py-0.5 pr-4 text-neutral-500">{VAT_LABEL}</td><td className="py-0.5 text-right">{bahtDoc(doc.vat_amount)}</td></tr>
                    </>
                  )}
                  <tr className="border-t border-neutral-900 text-[15px] font-bold">
                    <td className="py-1.5 pr-4">ยอดรวมสุทธิ</td><td className="py-1.5 text-right">{bahtDoc(doc.total)}</td>
                  </tr>
                  {Number(doc.wht_amount) > 0 && (
                    <>
                      <tr><td className="py-0.5 pr-4 text-neutral-500">หัก ณ ที่จ่าย {Number(doc.wht_rate)}%</td><td className="py-0.5 text-right">-{bahtDoc(doc.wht_amount)}</td></tr>
                      <tr className="border-t border-neutral-300 font-semibold"><td className="py-1 pr-4">ยอดชำระจริง</td><td className="py-1 text-right">{bahtDoc(Number(doc.total) - Number(doc.wht_amount))}</td></tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* ช่องเซ็น */}
            <div className="mt-10 grid grid-cols-2 gap-4 text-center text-[11px] sm:mt-16 sm:gap-10 sm:text-[12px]">
              <div>
                <div className="mx-auto w-full max-w-56 border-b border-dotted border-neutral-400 pb-8" />
                <p className="mt-2">ผู้รับเอกสาร / วันที่</p>
              </div>
              <div>
                <div className="mx-auto w-full max-w-56 border-b border-dotted border-neutral-400 pb-8" />
                <p className="mt-2 break-words">ผู้มีอำนาจลงนาม ({shopName})</p>
              </div>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

// ---------- หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ) ----------
function WhtCert({ doc, shopName, shopTaxId, shopAddress }: {
  doc: FinDoc; shopName: string; shopTaxId: string | null; shopAddress: string | null;
}) {
  const exVat = Number(doc.total) - Number(doc.vat_amount);
  const income = WHT_INCOME_TYPES.find((t) => t.code === doc.wht_income_type);
  const incomeLabel = income?.label ?? doc.wht_income_type ?? "40(8) ธุรกิจ พาณิชย์ บริการอื่น ๆ";
  // ใช้กฎกลางเดียวกับหน้ารายงาน/ไฟล์ยื่น — ห้ามเขียนซ้ำ ไม่งั้นเอกสารกับแบบที่ยื่นจะไม่ตรงกัน
  // ยึดประเภทผู้รับเงินที่ snapshot ไว้กับเอกสาร หนังสือ 50 ทวิ กับไฟล์ที่ยื่นจึงบอกแบบเดียวกันเสมอ
  const rdForm = rdFormFor(doc.contact_tax_id, doc.wht_income_type, doc.recipient_kind);
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 text-center">
          <p className="text-lg font-bold">หนังสือรับรองการหักภาษี ณ ที่จ่าย</p>
          <p className="text-[12px] text-neutral-500">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</p>
        </div>
        {/* เลขที่อ้างอิง — ผู้สอบบัญชี/สรรพากรใช้โยงกลับหาเอกสารต้นทางได้ */}
        <div className="shrink-0 border border-neutral-300 px-3 py-1.5 text-right text-[11px]">
          <p className="text-neutral-400">เลขที่</p>
          <p className="font-semibold">{doc.doc_number}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <section className="rounded border border-neutral-300 p-4">
          <p className="text-[11px] font-semibold text-neutral-400">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย (ผู้จ่ายเงิน)</p>
          <p className="font-semibold">{shopName}</p>
          {shopAddress && <p className="whitespace-pre-wrap text-neutral-600">{shopAddress}</p>}
          {shopTaxId && <p className="text-neutral-600">เลขประจำตัวผู้เสียภาษี {shopTaxId}</p>}
        </section>

        <section className="rounded border border-neutral-300 p-4">
          <p className="text-[11px] font-semibold text-neutral-400">ผู้ถูกหักภาษี ณ ที่จ่าย (ผู้รับเงิน)</p>
          <p className="font-semibold">{doc.contact_name ?? "-"}</p>
          {doc.contact_address && <p className="whitespace-pre-wrap text-neutral-600">{doc.contact_address}</p>}
          {doc.contact_tax_id && <p className="text-neutral-600">เลขประจำตัวผู้เสียภาษี {doc.contact_tax_id}</p>}
        </section>

        {/* แบบยื่นที่เกี่ยวข้อง — แบบราชการมีช่องนี้ นักบัญชีใช้ตัดสินว่ารายการนี้เข้าแบบไหน */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
          {["ภ.ง.ด.1ก", "ภ.ง.ด.2", "ภ.ง.ด.3", "ภ.ง.ด.53"].map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 border border-neutral-700 text-center text-[9px] leading-[10px] ${rdForm === f ? "font-bold" : ""}`}>
                {rdForm === f ? "✓" : ""}
              </span>
              {f}
            </span>
          ))}
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-t border-neutral-900 text-[11px]">
              <th className="py-2 text-left">ประเภทเงินได้พึงประเมินที่จ่าย</th>
              <th className="py-2 text-right">วันที่จ่าย</th>
              <th className="py-2 text-right">จำนวนเงินที่จ่าย</th>
              <th className="py-2 text-right">อัตรา</th>
              <th className="py-2 text-right">ภาษีที่หักและนำส่งไว้</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-200 align-top">
              <td className="py-2">
                {/* ประเภทเงินได้ตาม ม.40 — เดิมพิมพ์แค่ชื่อรายการ ทำให้นักบัญชีต้องมาจัดประเภทเองทุกใบ */}
                <span className="font-semibold">{incomeLabel}</span>
                <span className="block text-[11px] text-neutral-500">
                  {(doc.fin_doc_items ?? []).map((i) => i.name).join(", ").slice(0, 110) || "ค่าสินค้า/บริการ"}
                  {" · อ้างอิง "}{doc.doc_number}
                </span>
              </td>
              <td className="py-2 text-right">{dateOnlyTH(doc.issue_date)}</td>
              <td className="py-2 text-right tabular-nums">{bahtDoc(exVat)}</td>
              <td className="py-2 text-right tabular-nums">{Number(doc.wht_rate)}%</td>
              <td className="py-2 text-right font-semibold tabular-nums">{bahtDoc(doc.wht_amount)}</td>
            </tr>
            <tr className="font-bold">
              <td className="py-2" colSpan={4}>รวมเงินภาษีที่หักและนำส่ง ({bahtText(Number(doc.wht_amount))})</td>
              <td className="py-2 text-right tabular-nums">{bahtDoc(doc.wht_amount)}</td>
            </tr>
          </tbody>
        </table>

        {/* เงื่อนไขการหัก — แบบราชการบังคับให้ระบุ ระบบเราหักจากยอดจ่ายเสมอจึงติ๊กข้อ (1) ให้ */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
          <span className="text-neutral-500">ผู้จ่ายเงิน:</span>
          {[
            { n: "1", t: "หัก ณ ที่จ่าย", on: true },
            { n: "2", t: "ออกให้ตลอดไป", on: false },
            { n: "3", t: "ออกให้ครั้งเดียว", on: false },
            { n: "4", t: "อื่น ๆ", on: false },
          ].map((o) => (
            <span key={o.n} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 border border-neutral-700 text-center text-[9px] leading-[10px]">{o.on ? "✓" : ""}</span>
              ({o.n}) {o.t}
            </span>
          ))}
        </div>

        <p className="text-[12px] text-neutral-500">
          ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ
        </p>

        <div className="mt-12 grid grid-cols-2 gap-10 text-center text-[12px]">
          <div>
            <div className="mx-auto w-56 border-b border-dotted border-neutral-400 pb-8" />
            <p className="mt-2">ผู้จ่ายเงิน / ผู้มีอำนาจลงนาม</p>
          </div>
          <div>
            <div className="mx-auto w-56 border-b border-dotted border-neutral-400 pb-8" />
            <p className="mt-2">วันที่ออกหนังสือรับรอง</p>
          </div>
        </div>
      </div>
    </div>
  );
}
