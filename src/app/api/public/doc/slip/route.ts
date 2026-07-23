import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifySlip } from "@/lib/slip-verify";
import { applyPaymentToDoc } from "@/lib/finance-server";
import { docOutstanding } from "@/lib/finance";

// ============================================================
//  ลูกค้าอัปสลิปจากหน้าเอกสารสาธารณะ (ไม่ต้องล็อกอิน — ใช้ share_key)
//  บันทึกอัตโนมัติเฉพาะเมื่อ "ตรวจสลิปผ่านจริง + ยอดไม่เกินยอดค้าง" เท่านั้น
//  ตรวจไม่ได้/ยอดเพี้ยน -> ไม่แตะบัญชี บอกลูกค้าให้ติดต่อร้าน (กันสลิปปลอม)
// ============================================================

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const fd = await request.formData();
    const key = String(fd.get("key") ?? "");
    const file = fd.get("file") as File | null;
    if (!/^[0-9a-f-]{36}$/i.test(key) || !file || !file.size) {
      return NextResponse.json({ ok: false, error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) return NextResponse.json({ ok: false, error: "รองรับเฉพาะรูปภาพสลิป" });
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกิน 8MB" });

    const svc = createServiceClient();
    const { data: doc } = await svc.from("fin_docs")
      .select("id,shop_id,doc_number,doc_type,total,wht_amount,paid_amount,contact_name,status")
      .eq("share_key", key).eq("doc_type", "invoice").in("status", ["awaiting", "partial"]).maybeSingle();
    if (!doc) return NextResponse.json({ ok: false, error: "เอกสารนี้ชำระแล้วหรือไม่เปิดรับชำระ" });

    const outstanding = docOutstanding(doc);
    if (outstanding <= 0) return NextResponse.json({ ok: true, paid: true, message: "เอกสารนี้ชำระครบแล้ว" });

    const [{ data: pay }, { data: slipKey }] = await Promise.all([
      svc.from("shop_payment_settings").select("slip_provider").eq("shop_id", doc.shop_id).maybeSingle(),
      svc.rpc("get_shop_slip_key", { p_shop_id: doc.shop_id }),
    ]);
    if (!pay?.slip_provider || pay.slip_provider === "manual" || !slipKey) {
      return NextResponse.json({ ok: false, error: "ร้านยังไม่เปิดตรวจสลิปอัตโนมัติ — ส่งสลิปให้ร้านโดยตรงได้เลย" });
    }
    const { data: slipQuota } = await svc.rpc("check_slip_quota", { p_shop_id: doc.shop_id });
    if ((slipQuota as { allowed?: boolean } | null)?.allowed === false) {
      return NextResponse.json({ ok: false, error: "ระบบตรวจสลิปอัตโนมัติของร้านเต็มโควตาชั่วคราว — ส่งสลิปให้ร้านยืนยันโดยตรงได้เลย" });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const verify = await verifySlip(pay.slip_provider, slipKey as string, bytes);
    if (!verify?.verified || !verify.amount || verify.amount <= 0) {
      return NextResponse.json({ ok: false, error: "ตรวจสลิปไม่ผ่าน — เช็คว่าเป็นรูปสลิปโอนเงินที่ชัดเจน หรือติดต่อร้านโดยตรง" });
    }
    const amount = Math.round(verify.amount * 100) / 100;
    if (amount > outstanding + 1) {
      return NextResponse.json({ ok: false, error: `ยอดในสลิป (${amount.toLocaleString()} บาท) มากกว่ายอดค้าง (${outstanding.toLocaleString()} บาท) — ติดต่อร้านเพื่อตรวจสอบ` });
    }

    // เก็บสลิป + บันทึกรับเงิน (กันสลิปซ้ำด้วย unique trans_ref)
    const path = `${doc.shop_id}/finance/public-${crypto.randomUUID()}.jpg`;
    await svc.storage.from("slips").upload(path, bytes, { contentType: file.type });

    const { data: payment, error } = await svc.from("fin_payments").insert({
      shop_id: doc.shop_id, doc_id: doc.id, direction: "in", method: "promptpay",
      amount, paid_at: new Date().toISOString(),
      slip_storage_path: path, slip_trans_ref: verify.transRef ?? null, slip_data: verify.raw ?? null,
      verify_status: "verified", matched_by: "auto",
    }).select("id").single();
    if (error || !payment) {
      if (error?.message.includes("fin_payments_transref_uniq")) {
        return NextResponse.json({ ok: false, error: "สลิปใบนี้ถูกใช้ยืนยันไปแล้ว" });
      }
      return NextResponse.json({ ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }

    const status = await applyPaymentToDoc(svc, doc.shop_id, null, doc, amount, "promptpay", new Date().toISOString());
    await svc.from("audit_logs").insert({
      shop_id: doc.shop_id, actor_type: "system", action: "public_slip_payment",
      resource_type: "fin_payment", resource_id: payment.id,
      details: { doc_number: doc.doc_number, amount, trans_ref: verify.transRef },
    });

    return NextResponse.json({
      ok: true, paid: status === "paid",
      message: status === "paid"
        ? `ตรวจสลิปผ่าน ✓ ชำระครบ ${amount.toLocaleString()} บาท ขอบคุณค่ะ`
        : `ตรวจสลิปผ่าน ✓ รับยอด ${amount.toLocaleString()} บาท (ยังค้างบางส่วน)`,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `เกิดข้อผิดพลาด: ${(e as Error).message.slice(0, 150)}` }, { status: 500 });
  }
}
