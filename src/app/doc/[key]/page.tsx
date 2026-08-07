// ============================================================
//  หน้าเอกสารสาธารณะ — ร้านส่งลิงก์ให้ลูกค้า: ดูใบแจ้งหนี้/ใบเสร็จ
//  สแกน QR จ่าย แล้วอัปสลิปตรงนี้ ระบบตรวจ+ตัดยอดให้ร้านอัตโนมัติ
//  เข้าถึงด้วย share_key (สุ่ม uuid) เท่านั้น ไม่ต้องล็อกอิน
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { bahtDoc, dateOnlyTH } from "@/lib/utils";
import { DOC_TYPE_TH, docOutstanding, docStatusLabel, bahtText } from "@/lib/finance";
import { promptPayPayload } from "@/lib/promptpay";
import type { DocStatus, DocType, FinDoc } from "@/lib/types/finance";
import { Logo } from "@/components/logo";
import PublicSlipUpload from "./slip-upload";
import { vatPercentLabelOf } from "@/lib/tax-th";
import { CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicDocPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(key)) notFound();

  const svc = createServiceClient();
  const { data } = await svc.from("fin_docs")
    .select("*, fin_doc_items(*)")
    .eq("share_key", key)
    // รวมใบลดหนี้/ใบเพิ่มหนี้ด้วย — ลูกค้าต้องเปิดลิงก์ดูได้เหมือนเอกสารขายอื่น
    .in("doc_type", ["quotation", "invoice", "receipt", "credit_note", "debit_note"])
    .neq("status", "draft")
    .maybeSingle();
  if (!data) notFound();
  const doc = data as unknown as FinDoc;

  const [{ data: shop }, { data: pay }, { data: pf }] = await Promise.all([
    svc.from("shops").select("name,billing_name,billing_address,tax_id").eq("id", doc.shop_id).single(),
    svc.from("shop_payment_settings").select("promptpay_id,account_name,bank_name,slip_provider").eq("shop_id", doc.shop_id).maybeSingle(),
    // ตรวจสลิปรวมศูนย์ (5 ส.ค. 2569): ร้านไม่ต้องตั้งค่าเอง ถ้าแพลตฟอร์มเปิดไว้ = ตรวจอัตโนมัติได้เลย
    svc.from("platform_billing_settings").select("slip_provider").eq("id", true).maybeSingle(),
  ]);
  const autoVerify = (!!pay?.slip_provider && pay.slip_provider !== "manual")
    || (!!pf?.slip_provider && pf.slip_provider !== "manual");
  const shopName = shop?.billing_name || shop?.name || "";

  const outstanding = docOutstanding(doc);
  const payable = doc.doc_type === "invoice" && doc.status !== "void" && outstanding > 0;

  let qrDataUrl: string | null = null;
  if (payable && pay?.promptpay_id) {
    const QRCode = (await import("qrcode")).default;
    qrDataUrl = await QRCode.toDataURL(promptPayPayload(pay.promptpay_id, outstanding), { width: 280, margin: 1 });
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-6">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-3">
            <div>
              <p className="font-bold">{shopName}</p>
              {shop?.tax_id && <p className="text-xs text-neutral-400">เลขผู้เสียภาษี {shop.tax_id}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{DOC_TYPE_TH[doc.doc_type as DocType]}</p>
              <p className="text-xs text-neutral-400">{doc.doc_number}</p>
            </div>
          </div>

          <div className="mt-3 flex justify-between text-sm">
            <div>
              <p className="text-xs text-neutral-400">ลูกค้า</p>
              <p className="font-medium">{doc.contact_name ?? "-"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-400">วันที่ {dateOnlyTH(doc.issue_date)}</p>
              {doc.due_date && <p className="text-xs text-neutral-400">ครบกำหนด {dateOnlyTH(doc.due_date)}</p>}
              <p className="mt-0.5 text-xs font-medium text-emerald-700">{docStatusLabel(doc.doc_type as DocType, doc.status as DocStatus)}</p>
            </div>
          </div>

          <table className="mt-4 w-full text-sm">
            <tbody>
              {(doc.fin_doc_items ?? []).map((it, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  <td className="py-1.5 pr-2">{it.name} <span className="text-neutral-400">×{Number(it.qty).toLocaleString()}</span></td>
                  <td className="py-1.5 text-right">{bahtDoc(it.amount)}</td>
                </tr>
              ))}
              {Number(doc.discount) > 0 && (
                <tr className="border-t border-neutral-100 text-neutral-500"><td className="py-1.5">ส่วนลด</td><td className="py-1.5 text-right">-{bahtDoc(doc.discount)}</td></tr>
              )}
              {doc.vat_mode !== "none" && (
                <tr className="text-neutral-500"><td className="py-1">VAT {vatPercentLabelOf(doc)}</td><td className="py-1 text-right">{bahtDoc(doc.vat_amount)}</td></tr>
              )}
              <tr className="border-t-2 border-neutral-900 text-base font-bold">
                <td className="py-2">ยอดรวมสุทธิ</td><td className="py-2 text-right">{bahtDoc(doc.total)}</td>
              </tr>
              {/* ⚠️ บรรทัดหัก ณ ที่จ่าย หายไปจากหน้านี้มาตลอด (พบ 6 ส.ค. 2569 ตอนเปิดดูของจริง)
                  ผลที่เกิดกับลูกค้าของร้าน: เอกสารบอกยอดรวมสุทธิ 5,350 แต่ QR ให้จ่าย 5,200
                  โดยไม่มีอะไรอธิบายส่วนต่าง 150 บาทเลย — คนจ่ายมีสองทางเลือกคือ
                  โทรมาถามว่าร้านคิดผิดหรือเปล่า หรือจ่ายเต็ม 5,350 แล้วร้านต้องคืนเงินทีหลัง
                  ทั้งที่ใบพิมพ์ของเราเอง (dashboard/print) แสดงบรรทัดนี้อยู่แล้ว
                  = เอกสารใบเดียวกันบอกตัวเลขไม่ตรงกันสองที่ ซึ่งแย่กว่าไม่มีข้อมูล */}
              {Number(doc.wht_amount) > 0 && (
                <>
                  <tr className="text-neutral-500">
                    <td className="py-1">หัก ณ ที่จ่าย</td>
                    <td className="py-1 text-right">-{bahtDoc(doc.wht_amount)}</td>
                  </tr>
                  <tr className="border-t border-neutral-200 font-semibold text-emerald-700">
                    <td className="py-1.5">ยอดที่ต้องโอน</td>
                    <td className="py-1.5 text-right">{bahtDoc(Number(doc.total) - Number(doc.wht_amount))}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          {/* ตัวหนังสือกำกับต้องเป็นยอดเดียวกับที่ผู้จ่ายต้องโอนจริง ไม่ใช่ยอดก่อนหัก */}
          <p className="text-xs text-neutral-400">({bahtText(Number(doc.total) - Number(doc.wht_amount || 0))})</p>
          {Number(doc.wht_amount) > 0 && (
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              ผู้จ่ายหักภาษี ณ ที่จ่ายไว้ {bahtDoc(doc.wht_amount)} บาท — กรุณาออกหนังสือรับรองการหักภาษี (50 ทวิ) ให้ผู้รับเงินด้วย
            </p>
          )}
          {payable && Number(doc.paid_amount) > 0 && (
            <p className="mt-1 text-sm text-amber-600">ชำระแล้ว {bahtDoc(doc.paid_amount)} · คงเหลือ {bahtDoc(outstanding)}</p>
          )}
        </div>

        {payable && (
          <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
            {qrDataUrl ? (
              <>
                <p className="text-sm font-semibold">① สแกน QR จ่าย {bahtDoc(outstanding)} บาท</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="PromptPay QR" className="mx-auto mt-2 h-56 w-56" />
                <p className="text-xs text-neutral-400">
                  พร้อมเพย์ {pay?.promptpay_id}{pay?.account_name ? ` · ${pay.account_name}` : ""}{pay?.bank_name ? ` · ${pay.bank_name}` : ""}
                </p>
                <div className="my-4 border-t border-dashed border-neutral-200" />
              </>
            ) : (
              <p className="text-sm text-neutral-500">โอนชำระตามช่องทางที่ร้านแจ้ง แล้วอัปโหลดสลิปด้านล่าง</p>
            )}
            <PublicSlipUpload docKey={key} autoVerify={autoVerify} />
          </div>
        )}

        {doc.status === "paid" && doc.doc_type === "invoice" && (
          <p className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />ชำระครบแล้ว ขอบคุณค่ะ
          </p>
        )}

        {/* แถบท้ายเอกสาร — หน้านี้คือหน้าเดียวที่ "ลูกค้าของลูกค้า" เห็น
            ทุกใบที่ผู้ประกอบการส่งต่อ = คนใหม่ได้เห็นระบบโดยเราไม่ได้จ่ายค่าโฆษณา
            จึงต้องดูตั้งใจ ไม่ใช่โลโก้ลอย ๆ ท้ายหน้า และต้องกดมาดูต่อได้จริง
            แต่ห้ามเด่นกว่าตัวเอกสาร — คนเปิดมาเพื่อดูยอดเงิน ไม่ได้มาดูโฆษณาเรา */}
        <div className="border-t border-neutral-200/70 pb-6 pt-5">
          {/* ชี้เข้าหน้าลองใช้ ไม่ใช่หน้าแรก — คนที่เปิดลิงก์นี้คือคนที่ถือเอกสารของเราอยู่ในมือแล้ว
              พาไปที่ที่ลองออกเอกสารได้ทันทีย่อมตรงกับสิ่งที่เขาเพิ่งเห็นมากกว่าหน้าโฆษณา */}
          <a href="https://sudochatbot.online/try" target="_blank" rel="noopener"
            className="group mx-auto flex max-w-xs flex-col items-center gap-1.5 rounded-2xl px-4 py-3 transition-colors hover:bg-neutral-50">
            <span className="flex items-center gap-1.5 text-xs text-neutral-400">
              เอกสารนี้ออกด้วย <Logo />
            </span>
            <span className="text-center text-xs leading-relaxed text-neutral-400">
              ระบบบัญชีออนไลน์สำหรับธุรกิจไทย — ออกใบแจ้งหนี้ รับเงิน ลงบัญชี ยื่นภาษี ครบในที่เดียว
            </span>
            <span className="text-xs font-semibold text-emerald-700 group-hover:underline">
              ทดลองใช้ฟรี ไม่ต้องใส่บัตร →
            </span>
          </a>
        </div>
      </div>
    </main>
  );
}
