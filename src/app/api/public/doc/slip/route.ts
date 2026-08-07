import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifySlip } from "@/lib/slip-verify";
import { decodeSlipQr } from "@/lib/slip-qr";
import { consumePlatformSlip } from "@/lib/slip-guard";
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
    // ⚠️ แยก "ส่ง body มาผิดรูปแบบ" ออกจาก "ระบบเราพัง" (พบ 6 ส.ค. 2569 ตอนกวาด endpoint)
    // ยิง JSON เข้ามาที่ endpoint ที่รอ multipart -> formData() โยน error -> ตกไปที่ catch ก้อนล่าง
    // ซึ่งตอบ 500 "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง" ทั้งที่ลองใหม่กี่ครั้งก็ไม่มีทางผ่าน
    // 500 ยังทำให้ระบบเฝ้าระวังเข้าใจผิดว่าเซิร์ฟเวอร์เรามีปัญหา ทั้งที่คนเรียกส่งมาผิดเอง
    let fd: FormData;
    try {
      fd = await request.formData();
    } catch {
      return NextResponse.json({ ok: false, error: "รูปแบบข้อมูลไม่ถูกต้อง — ต้องส่งเป็นฟอร์มพร้อมไฟล์รูปสลิป" }, { status: 400 });
    }
    const key = String(fd.get("key") ?? "");
    const file = fd.get("file") as File | null;
    if (!/^[0-9a-f-]{36}$/i.test(key) || !file || !file.size) {
      return NextResponse.json({ ok: false, error: "ข้อมูลไม่ครบ" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) return NextResponse.json({ ok: false, error: "รองรับเฉพาะรูปภาพสลิป" });
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกิน 8MB" });

    const svc = createServiceClient();
    const { data: doc } = await svc.from("fin_docs")
      .select("id,shop_id,doc_number,doc_type,total,wht_amount,paid_amount,contact_name,status,tax_point,vat_amount")
      .eq("share_key", key).eq("doc_type", "invoice").in("status", ["awaiting", "partial"]).maybeSingle();
    if (!doc) return NextResponse.json({ ok: false, error: "เอกสารนี้ชำระแล้วหรือไม่เปิดรับชำระ" });

    const outstanding = docOutstanding(doc);
    if (outstanding <= 0) return NextResponse.json({ ok: true, paid: true, message: "เอกสารนี้ชำระครบแล้ว" });

    // ---------- จำกัดอัตราต่อ IP ----------
    // หน้านี้ไม่ต้องล็อกอิน ใครถือลิงก์ก็ยิงได้ และทุกครั้งที่ยิงมีต้นทุนจริง (โควตาสลิป + ค่า API + ถอดรูป)
    // เดิมไม่มีด่านนี้ = คนที่ได้ลิงก์ต่อ ๆ กันมา เผาโควตาสลิปทั้งเดือนของร้านได้ด้วยสคริปต์สั้น ๆ
    // เป็นด่าน "ปฏิเสธเฉย ๆ" จึงต้องอยู่ก่อนด่านที่ตัดโควตาทั้งหมด
    const ipRaw = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim().toLowerCase();
    const ipNorm = ipRaw.includes(":") ? ipRaw.split("%")[0].split(":").slice(0, 4).join(":") + "::/64" : ipRaw;
    const { createHmac } = await import("crypto");
    const ipHash = createHmac("sha256", process.env.RATE_LIMIT_IP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "sc-fallback")
      .update(ipNorm).digest("hex");   // ห้ามเก็บ IP ดิบ (PDPA)
    const { data: rate, error: rateErr } = await svc.rpc("consume_public_rate", {
      p_bucket: "public_slip", p_ip_hash: ipHash, p_limit: 12, p_window_secs: 3600,
    });
    if (rateErr || (rate as { allowed?: boolean } | null)?.allowed !== true) {
      return NextResponse.json({ ok: false, error: "ส่งสลิปถี่เกินไป — รอสักครู่แล้วลองใหม่ หรือส่งสลิปให้ร้านโดยตรง" });
    }

    // ---------- QR ชั้นฟรี (5 ส.ค. 2569): กันสลิปซ้ำทั้งแพลตฟอร์มก่อนเสียโควตา/ค่า API ----------
    // ด่านปฏิเสธเฉย ๆ ต้องมาก่อนด่านที่ตัดโควตา (หลักเดียวกับด่าน AI)
    // อ่าน QR ไม่ออก = ข้ามเฉย ๆ ห้าม reject — ชั้นนี้ปฏิเสธได้ อนุมัติไม่ได้
    const bytes = new Uint8Array(await file.arrayBuffer());
    const qr = await decodeSlipQr(bytes);
    if (qr) {
      const { data: dupRef } = await svc.from("slip_refs").select("trans_ref").eq("trans_ref", qr.transRef).maybeSingle();
      if (dupRef) return NextResponse.json({ ok: false, error: "สลิปใบนี้ถูกใช้ยืนยันไปแล้ว" });
    }

    // เจ้าของแพลตฟอร์มตัดสินใจ 5 ส.ค. 2569: ตรวจสลิปรวมศูนย์ที่แพลตฟอร์ม (SlipOK แพ็กฟรี)
    // ลูกค้าไม่ต้องตั้งค่าผู้ให้บริการเองอีก — ร้านที่ตั้งคีย์ของตัวเองไว้แล้วยังใช้ของตัวเองก่อน
    // (ไม่ริบของที่เขาตั้งไว้) ร้านที่ไม่ได้ตั้ง = ใช้คีย์กลางของแพลตฟอร์มอัตโนมัติ
    const [{ data: pay }, { data: shopKey }, { data: pfRow }, { data: pfKey }] = await Promise.all([
      svc.from("shop_payment_settings").select("slip_provider").eq("shop_id", doc.shop_id).maybeSingle(),
      svc.rpc("get_shop_slip_key", { p_shop_id: doc.shop_id }),
      svc.from("platform_billing_settings").select("slip_provider").eq("id", true).maybeSingle(),
      svc.rpc("get_platform_slip_key"),
    ]);
    const shopReady = !!pay?.slip_provider && pay.slip_provider !== "manual" && !!shopKey;
    const pfReady = !!pfRow?.slip_provider && pfRow.slip_provider !== "manual" && !!pfKey;
    const provider = shopReady ? pay!.slip_provider : pfReady ? pfRow!.slip_provider : null;
    const slipKey = shopReady ? shopKey : pfReady ? pfKey : null;
    // ⚠️ ไม่มีผู้ให้บริการตรวจสลิป ≠ ห้ามลูกค้าส่งสลิป (แก้ 6 ส.ค. 2569)
    //
    // เดิมตรงนี้ปฏิเสธทิ้งแล้วบอกว่า "ส่งสลิปให้ร้านโดยตรง" ซึ่งเป็นทางตันสองชั้น:
    //  1. หน้าเว็บไม่โชว์ช่องอัปโหลดเลยด้วยซ้ำ ลูกค้าจึงไม่มีทางส่งผ่านระบบได้
    //  2. "ส่งให้ร้านโดยตรง" คือช่องทางไหนก็ไม่รู้ — หน้านั้นไม่มีเบอร์ ไม่มีไลน์
    // ผลจริง: ตราบใดที่ยังไม่ได้ตั้งคีย์ SlipOK ลูกค้าของ **ทุกร้าน** ส่งสลิปผ่านระบบไม่ได้เลย
    //
    // โหมด manual แปลว่า "คนตรวจ" ไม่ใช่ "ห้ามส่ง" — เก็บสลิปไว้ให้ร้านแล้วปลุกร้าน
    // ⚠️ ห้ามบันทึกรับเงินหรือแตะยอดค้างเด็ดขาดในเส้นนี้ ไม่มีอะไรยืนยันว่าสลิปจริง
    // ร้านต้องเป็นคนกดรับเงินเองที่หน้าเอกสาร (ซึ่งเป็นเส้นทางที่มีอยู่แล้ว)
    if (!provider || !slipKey) {
      const manualPath = `${doc.shop_id}/finance/manual-${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await svc.storage.from("slips").upload(manualPath, bytes, { contentType: file.type });
      if (upErr) {
        return NextResponse.json({ ok: false, error: "เก็บสลิปไม่สำเร็จ — ลองใหม่อีกครั้ง หรือส่งให้ร้านโดยตรง" });
      }
      const { error: fileErr } = await svc.from("fin_doc_files").insert({
        doc_id: doc.id, shop_id: doc.shop_id, path: manualPath, name: "สลิปจากลูกค้า",
      });
      if (fileErr) {
        // แนบไม่ติด = ร้านจะไม่มีวันเห็นสลิปใบนี้ ห้ามบอกลูกค้าว่าส่งสำเร็จ
        await svc.storage.from("slips").remove([manualPath]);
        return NextResponse.json({ ok: false, error: "เก็บสลิปไม่สำเร็จ — ลองใหม่อีกครั้ง หรือส่งให้ร้านโดยตรง" });
      }
      const { notifyShop } = await import("@/lib/notify");
      await notifyShop(svc, doc.shop_id, {
        title: "ลูกค้าส่งสลิปมาแล้ว รอยืนยัน",
        body: `เอกสาร ${doc.doc_number} — เปิดดูสลิปที่หน้าเอกสาร แล้วกดบันทึกรับเงินถ้าถูกต้อง`,
        url: `/dashboard/sales/${doc.id}`, tag: `manual-slip:${doc.id}`,
      });
      return NextResponse.json({
        ok: true, paid: false,
        message: "ส่งสลิปให้ร้านแล้ว — ร้านได้รับแจ้งเตือนและจะยืนยันให้ สถานะจะเปลี่ยนเมื่อร้านตรวจเรียบร้อย",
      });
    }
    // fail-closed แบบเดียวกับด่าน AI: RPC พัง/คืน null ต้องไม่แปลว่า "ผ่าน"
    // (เดิมเช็ค === false แล้ว null หลุดผ่านไปเสียค่า API ตอน DB มีปัญหา)
    const { data: slipQuota, error: quotaErr } = await svc.rpc("check_slip_quota", { p_shop_id: doc.shop_id });
    if (quotaErr || (slipQuota as { allowed?: boolean } | null)?.allowed !== true) {
      return NextResponse.json({ ok: false, error: "ระบบตรวจสลิปอัตโนมัติของร้านไม่พร้อมชั่วคราว — ส่งสลิปให้ร้านยืนยันโดยตรงได้เลย" });
    }

    // เพดานกลางต้องอยู่หลังด่านโควตาร้าน (ด่านที่ปฏิเสธเฉย ๆ มาก่อนด่านที่ตัดโควตา)
    // และตัดเฉพาะเมื่อใช้ "คีย์กลางของแพลตฟอร์ม" เท่านั้น — ร้านที่ซื้อแพ็กและตั้งคีย์เอง
    // ต้องไม่มากินเพดานของคีย์กลาง (บั๊กที่เจอตอนตรวจซ้ำ: เดิมตัดทุกกรณี)
    if (!shopReady) {
      const pfSlip = await consumePlatformSlip(svc);
      if (!pfSlip.ok) return NextResponse.json({ ok: false, error: pfSlip.error });
    }

    const verify = await verifySlip(provider as string, slipKey as string, bytes);

    // แยก "ระบบตรวจล่ม/เครดิต API หมด" ออกจาก "สลิปไม่ผ่าน" — คนละความหมายคนละคนผิด
    // ล่ม = ห้ามโทษสลิปลูกค้า ต้องสวิตช์เป็นโหมดส่งร้านตรวจเอง + ปลุกร้านและแอดมินทันที
    // (คำวิจารณ์วิศวกร 5 ส.ค. 2569: ไม่มี fallback ตอน SlipOK ล่ม = ธุรกรรมลูกค้าสะดุดเงียบ ๆ)
    const providerDown = !verify || verify.ok !== true
      || (!verify.verified && !!verify.error && /quota|credit|limit|expired|timeout|50[023]|unavailable/i.test(String(verify.error)));
    if (providerDown) {
      const { notifyShop, notifyPlatformAdmins } = await import("@/lib/notify");
      await Promise.allSettled([
        notifyShop(svc, doc.shop_id, {
          title: "ลูกค้าพยายามชำระเงินแต่ระบบตรวจสลิปขัดข้อง",
          body: `เอกสาร ${doc.doc_number} — ขอสลิปจากลูกค้าแล้วตรวจเอง จากนั้นบันทึกรับเงินในระบบ`,
          url: "/dashboard/finance", tag: `slip-down:${doc.id}`,
        }),
        notifyPlatformAdmins(svc, {
          title: "ระบบตรวจสลิปอัตโนมัติขัดข้อง",
          body: `provider ไม่ตอบ/เครดิตหมด (${String(verify?.error ?? "no response").slice(0, 80)}) — ตรวจที่หน้า รายได้+บัญชีรับเงิน`,
          url: "/dashboard/admin/billing", tag: "slip-provider-down",
        }),
      ]);
      return NextResponse.json({ ok: false, error: "ระบบตรวจอัตโนมัติขัดข้องชั่วคราว — ส่งสลิปให้ร้านยืนยันโดยตรงได้เลย ร้านได้รับแจ้งแล้วค่ะ" });
    }
    if (!verify.verified || !verify.amount || verify.amount <= 0) {
      return NextResponse.json({ ok: false, error: "ตรวจสลิปไม่ผ่าน — เช็คว่าเป็นรูปสลิปโอนเงินที่ชัดเจน หรือติดต่อร้านโดยตรง" });
    }
    const amount = Math.round(verify.amount * 100) / 100;
    if (amount > outstanding + 1) {
      return NextResponse.json({ ok: false, error: `ยอดในสลิป (${amount.toLocaleString()} บาท) มากกว่ายอดค้าง (${outstanding.toLocaleString()} บาท) — ติดต่อร้านเพื่อตรวจสอบ` });
    }

    // จองเลขอ้างอิงในทะเบียนกลางก่อนบันทึกรับเงิน — สองร้านใช้สลิปใบเดียวพร้อมกัน
    // คนที่จองได้คนแรกเท่านั้นที่ได้ใช้ (unique เดิมของ fin_payments กันแค่ในร้านเดียว)
    const transRef = verify.transRef ?? qr?.transRef ?? null;
    let refReserved = false;
    if (transRef) {
      const { error: refErr } = await svc.from("slip_refs").insert({ trans_ref: transRef, shop_id: doc.shop_id, source: "doc_payment" });
      if (refErr?.code === "23505") return NextResponse.json({ ok: false, error: "สลิปใบนี้ถูกใช้ยืนยันไปแล้ว" });
      // ทะเบียนกลางล่มด้วยเหตุอื่น -> ปล่อยผ่านไปพึ่ง unique รายร้านเดิม ดีกว่าทำให้การรับเงินล้มทั้งระบบ
      refReserved = !refErr;
    }

    // เก็บสลิป + บันทึกรับเงิน (กันสลิปซ้ำด้วย unique trans_ref)
    // อัปโหลดล้ม = ไม่มีหลักฐานการรับเงิน ห้ามบันทึกเงินโดยชี้ไปไฟล์ที่ไม่มีอยู่จริง
    const path = `${doc.shop_id}/finance/public-${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await svc.storage.from("slips").upload(path, bytes, { contentType: file.type });
    if (upErr) {
      if (refReserved && transRef) await svc.from("slip_refs").delete().eq("trans_ref", transRef);
      return NextResponse.json({ ok: false, error: "เก็บสลิปไม่สำเร็จ — ลองใหม่อีกครั้ง หรือส่งสลิปให้ร้านโดยตรง" });
    }

    const { data: payment, error } = await svc.from("fin_payments").insert({
      shop_id: doc.shop_id, doc_id: doc.id, direction: "in", method: "promptpay",
      amount, paid_at: new Date().toISOString(),
      slip_storage_path: path, slip_trans_ref: transRef, slip_data: verify.raw ?? null,
      verify_status: "verified", matched_by: "auto",
    }).select("id").single();
    if (error || !payment) {
      // คืนเลขที่เพิ่งจอง — ไม่งั้นลูกค้าตัวจริงลองใหม่แล้วโดนหาว่าใช้สลิปซ้ำ ทั้งที่ยังไม่มีการบันทึกรับเงิน
      if (refReserved && transRef) await svc.from("slip_refs").delete().eq("trans_ref", transRef);
      if (error?.message.includes("fin_payments_transref_uniq")) {
        return NextResponse.json({ ok: false, error: "สลิปใบนี้ถูกใช้ยืนยันไปแล้ว" });
      }
      return NextResponse.json({ ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }

    // ลงบัญชี/ตัดยอด — ถ้าโยน (เช่นผังบัญชีของร้านขาดรหัสที่ต้องใช้) ต้องเก็บกวาดให้จบ
    // ไม่งั้นค้างครึ่งทาง: มีแถวรับเงิน+จองเลขไว้ แต่เอกสารยังค้างชำระ แล้วลูกค้าส่งใหม่ก็โดนหาว่าสลิปซ้ำ = ตันถาวร
    let status: string;
    try {
      status = await applyPaymentToDoc(svc, doc.shop_id, null, doc, amount, "promptpay", new Date().toISOString());
    } catch (postErr) {
      await svc.from("fin_payments").delete().eq("id", payment.id);
      if (refReserved && transRef) await svc.from("slip_refs").delete().eq("trans_ref", transRef);
      const { notifyShop } = await import("@/lib/notify");
      await notifyShop(svc, doc.shop_id, {
        title: "ลูกค้าจ่ายเงินแล้วแต่ระบบลงบัญชีไม่ได้",
        body: `เอกสาร ${doc.doc_number} — ${(postErr as Error).message.slice(0, 120)} · ตรวจผังบัญชีแล้วบันทึกรับเงินเองที่หน้าการเงิน`,
        url: "/dashboard/finance", tag: `post-fail:${doc.id}`,
      });
      return NextResponse.json({ ok: false, error: "ตรวจสลิปผ่านแล้ว แต่ระบบบันทึกบัญชีของร้านไม่สำเร็จ — แจ้งร้านให้แล้ว ร้านจะยืนยันให้เอง" });
    }
    await svc.from("audit_logs").insert({
      shop_id: doc.shop_id, actor_type: "system", action: "public_slip_payment",
      resource_type: "fin_payment", resource_id: payment.id,
      details: { doc_number: doc.doc_number, amount, trans_ref: verify.transRef },
    });

    return NextResponse.json({
      ok: true, paid: status === "paid",
      message: status === "paid"
        ? `ตรวจสลิปผ่าน — ชำระครบ ${amount.toLocaleString()} บาท ขอบคุณค่ะ`
        : `ตรวจสลิปผ่าน — รับยอด ${amount.toLocaleString()} บาท (ยังค้างบางส่วน)`,
    });
  } catch (e) {
    // หน้านี้เปิดสาธารณะ — ห้ามส่งข้อความ error ดิบของฐานข้อมูล/ชื่อ constraint ออกไป
    // (บอกโครงสร้างภายในให้คนนอกโดยไม่จำเป็น) เก็บรายละเอียดไว้ที่ log ฝั่งเซิร์ฟเวอร์แทน
    console.error("public slip error", (e as Error).message);
    return NextResponse.json({ ok: false, error: "ระบบขัดข้องชั่วคราว — ลองใหม่อีกครั้ง หรือส่งสลิปให้ร้านโดยตรง" }, { status: 500 });
  }
}
