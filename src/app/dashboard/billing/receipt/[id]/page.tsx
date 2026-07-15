import { getCurrentShop } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { baht, dateTH } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { shop } = await getCurrentShop();
  const { id } = await params;
  const svc = createServiceClient();
  const { data: t } = await svc.from("topups").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!t || t.status !== "paid") notFound();
  const { data: pf } = await svc.from("platform_billing_settings").select("account_name").eq("id", true).single();

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <a href="/dashboard/billing" className="text-sm text-neutral-500">← กลับ</a>
        <button onClick={undefined as never} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm" style={{ display: "none" }} />
        <PrintButton />
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white p-8">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <Logo />
          <div className="text-right">
            <p className="text-sm font-semibold">ใบเสร็จรับเงิน</p>
            <p className="text-[11px] text-neutral-400">RECEIPT</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 py-5 text-sm">
          <div>
            <p className="text-[11px] text-neutral-400">เลขที่</p>
            <p className="font-mono">{String(t.id).slice(0, 8).toUpperCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-neutral-400">วันที่</p>
            <p>{dateTH(t.paid_at ?? t.created_at)}</p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">ร้าน</p>
            <p>{shop.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-neutral-400">ช่องทาง</p>
            <p>PromptPay</p>
          </div>
        </div>
        <div className="rounded-xl bg-neutral-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">เติมเครดิตเข้าระบบ SudoChatBot</span>
            <span className="font-semibold">{baht(t.amount)}</span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4">
          <span className="font-semibold">ยอดชำระทั้งสิ้น</span>
          <span className="text-xl font-bold text-emerald-600">{baht(t.amount)}</span>
        </div>
        <p className="mt-6 text-center text-[11px] text-neutral-400">
          ผู้รับเงิน: {pf?.account_name ?? "SudoChatBot Platform"}<br />
          เอกสารนี้ออกโดยระบบอัตโนมัติ · ต้องการใบกำกับภาษีเต็มรูปแบบ ติดต่อผู้ดูแลระบบ
        </p>
      </div>
    </div>
  );
}

function PrintButton() {
  return (
    <form action={() => {}}>
      <a href="#" onClick={undefined as never} />
      <button type="button" className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
        // @ts-expect-error inline handler for print
        onClick="window.print()">พิมพ์ / บันทึก PDF</button>
    </form>
  );
}
