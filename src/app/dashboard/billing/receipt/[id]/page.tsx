import { getCurrentShop } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { baht, dateTH } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { notFound } from "next/navigation";
import { PrintButton } from "../print-button";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { shop } = await getCurrentShop();
  const { id } = await params;
  const svc = createServiceClient();
  const { data: t } = await svc.from("topups").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!t || t.status !== "paid") notFound();
  const [{ data: pf }, { data: shopTax }] = await Promise.all([
    svc.from("platform_billing_settings").select("account_name,company_name,company_address,tax_id,tax_branch,vat_registered").eq("id", true).single(),
    svc.from("shops").select("billing_name,billing_address,tax_id").eq("id", shop.id).single(),
  ]);

  const vatRegistered = Boolean(pf?.vat_registered && pf?.tax_id);
  const total = Number(t.amount);
  // ราคารวม VAT แล้ว: ก่อน VAT = ยอด*100/107
  const preVat = Math.round((total * 100 / 107) * 100) / 100;
  const vat = Math.round((total - preVat) * 100) / 100;
  const docNo = t.invoice_number ?? String(t.id).slice(0, 8).toUpperCase();
  const method = t.gateway === "omise" ? "PromptPay (Omise)" : "PromptPay";

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <a href="/dashboard/billing" className="text-sm text-neutral-500">← กลับ</a>
        <PrintButton />
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white p-8">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <Logo />
          <div className="text-right">
            <p className="text-sm font-semibold">{vatRegistered ? "ใบเสร็จรับเงิน / ใบกำกับภาษี" : "ใบเสร็จรับเงิน"}</p>
            <p className="text-[11px] text-neutral-400">{vatRegistered ? "RECEIPT / TAX INVOICE" : "RECEIPT"}</p>
          </div>
        </div>

        {/* ผู้ขาย / ผู้ซื้อ */}
        <div className="grid grid-cols-2 gap-4 border-b border-neutral-100 py-4 text-sm">
          <div>
            <p className="text-[11px] font-semibold text-neutral-400">ผู้ขาย</p>
            <p className="font-medium">{pf?.company_name ?? pf?.account_name ?? "SudoChatBot Platform"}</p>
            {pf?.company_address && <p className="whitespace-pre-line text-xs text-neutral-500">{pf.company_address}</p>}
            {vatRegistered && (
              <p className="text-xs text-neutral-500">เลขประจำตัวผู้เสียภาษี {pf?.tax_id} ({pf?.tax_branch ?? "สำนักงานใหญ่"})</p>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold text-neutral-400">ผู้ซื้อ</p>
            <p className="font-medium">{shopTax?.billing_name ?? shop.name}</p>
            {shopTax?.billing_address && <p className="whitespace-pre-line text-xs text-neutral-500">{shopTax.billing_address}</p>}
            {shopTax?.tax_id && <p className="text-xs text-neutral-500">เลขประจำตัวผู้เสียภาษี {shopTax.tax_id}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 py-4 text-sm">
          <div>
            <p className="text-[11px] text-neutral-400">เลขที่</p>
            <p className="font-mono">{docNo}</p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">วันที่</p>
            <p>{dateTH(t.paid_at ?? t.created_at)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-neutral-400">ช่องทาง</p>
            <p>{method}</p>
          </div>
        </div>

        <div className="rounded-xl bg-neutral-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">เติมเครดิตเข้าระบบ SudoChatBot</span>
            <span className="font-semibold">{baht(total)}</span>
          </div>
        </div>

        <div className="mt-4 space-y-1.5 border-t border-neutral-200 pt-4 text-sm">
          {vatRegistered && (
            <>
              <div className="flex items-center justify-between text-neutral-500">
                <span>มูลค่าสินค้า/บริการ (ก่อน VAT)</span><span>{baht(preVat)}</span>
              </div>
              <div className="flex items-center justify-between text-neutral-500">
                <span>ภาษีมูลค่าเพิ่ม (VAT 7%)</span><span>{baht(vat)}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="font-semibold">ยอดชำระทั้งสิ้น</span>
            <span className="text-xl font-bold text-emerald-600">{baht(total)}</span>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-neutral-400">
          ผู้รับเงิน: {pf?.company_name ?? pf?.account_name ?? "SudoChatBot Platform"}<br />
          เอกสารนี้ออกโดยระบบอัตโนมัติ{vatRegistered ? " · ราคารวมภาษีมูลค่าเพิ่มแล้ว" : " · ต้องการใบกำกับภาษีเต็มรูปแบบ ติดต่อผู้ดูแลระบบ"}
        </p>
      </div>
    </div>
  );
}
