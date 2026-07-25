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
import PrintButton from "./print-button";

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
                {shop.tax_id && <p className="text-neutral-600">เลขประจำตัวผู้เสียภาษี {shop.tax_id}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-bold leading-tight sm:text-xl">{title}</p>
                {doc.vat_mode !== "none" && doc.doc_type === "receipt" && <p className="text-[11px] text-neutral-500">ต้นฉบับ</p>}
              </div>
            </div>

            {/* ข้อมูลเอกสาร + ลูกค้า */}
            <div className="mt-4 flex justify-between gap-3 sm:gap-6">
              <div className="min-w-0 max-w-[58%]">
                <p className="text-[11px] font-semibold text-neutral-400">ลูกค้า</p>
                <p className="break-words font-semibold">{doc.contact_name ?? "-"}</p>
                {doc.contact_address && <p className="whitespace-pre-wrap break-words text-neutral-600">{doc.contact_address}</p>}
                {doc.contact_tax_id && <p className="text-neutral-600">เลขประจำตัวผู้เสียภาษี {doc.contact_tax_id}</p>}
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
                      <tr><td className="py-0.5 pr-4 text-neutral-500">ภาษีมูลค่าเพิ่ม 7%</td><td className="py-0.5 text-right">{bahtDoc(doc.vat_amount)}</td></tr>
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
  return (
    <div>
      <p className="text-center text-lg font-bold">หนังสือรับรองการหักภาษี ณ ที่จ่าย</p>
      <p className="text-center text-[12px] text-neutral-500">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</p>

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

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-t border-neutral-900 text-[11px]">
              <th className="py-2 text-left">ประเภทเงินได้ที่จ่าย</th>
              <th className="py-2 text-right">วันที่จ่าย</th>
              <th className="py-2 text-right">จำนวนเงินที่จ่าย</th>
              <th className="py-2 text-right">อัตรา</th>
              <th className="py-2 text-right">ภาษีที่หักไว้</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-200">
              <td className="py-2">{(doc.fin_doc_items ?? []).map((i) => i.name).join(", ").slice(0, 120) || "ค่าสินค้า/บริการ"} (อ้างอิง {doc.doc_number})</td>
              <td className="py-2 text-right">{dateOnlyTH(doc.issue_date)}</td>
              <td className="py-2 text-right">{bahtDoc(exVat)}</td>
              <td className="py-2 text-right">{Number(doc.wht_rate)}%</td>
              <td className="py-2 text-right font-semibold">{bahtDoc(doc.wht_amount)}</td>
            </tr>
            <tr className="font-bold">
              <td className="py-2" colSpan={4}>รวมภาษีที่หักนำส่ง ({bahtText(Number(doc.wht_amount))})</td>
              <td className="py-2 text-right">{bahtDoc(doc.wht_amount)}</td>
            </tr>
          </tbody>
        </table>

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
