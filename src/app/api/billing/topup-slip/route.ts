import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notifyPlatformAdmins } from "@/lib/notify";
import { decodeSlipQr } from "@/lib/slip-qr";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const form = await request.formData();
  const topupId = String(form.get("topup_id") ?? "");
  const file = form.get("slip") as File | null;
  if (!topupId || !file) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ครบ" });

  const svc = createServiceClient();
  const { data: topup } = await svc.from("topups").select("id,shop_id,status").eq("id", topupId).single();
  if (!topup) return NextResponse.json({ ok: false, error: "ไม่พบรายการ" });
  // ตรวจสิทธิ์: ต้องเป็นสมาชิกร้าน
  const { data: mem } = await supabase.from("shop_members").select("role").eq("shop_id", topup.shop_id).eq("user_id", user.id).maybeSingle();
  if (!mem) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  // กันเคสที่เจอ 5 ส.ค. 2569: รายการที่จ่ายแล้ว ถ้าอัปสลิปซ้ำ status จะถูกทับกลับเป็น verifying
  // แล้วไปโผล่คิวรออนุมัติอีกรอบ — แอดมินกดยืนยันซ้ำ = เครดิตเข้าสองรอบ (credit_wallet ไม่ idempotent)
  if (topup.status === "paid") {
    return NextResponse.json({ ok: true, auto: true, message: "รายการนี้ยืนยันแล้ว — เครดิต/แพ็กเกจเข้าเรียบร้อย ไม่ต้องส่งสลิปซ้ำ" });
  }
  // รายการที่แอดมินปฏิเสธ/หมดอายุไปแล้ว ห้ามดันกลับเข้าคิวด้วยการอัปสลิปซ้ำ
  // (เดิมกันแค่ paid -> อัปสลิปเดิมซ้ำได้เรื่อย ๆ ปลุกแอดมินไม่รู้จบ)
  if (topup.status === "rejected" || topup.status === "expired") {
    return NextResponse.json({ ok: false, error: "รายการนี้ถูกยกเลิก/หมดอายุแล้ว — สร้างรายการชำระเงินใหม่ได้เลย" });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // QR ชั้นฟรี: อ่าน transRef จาก mini-QR บนสลิป (ไม่เสียเงิน API) เพื่อกันสลิปซ้ำทั้งแพลตฟอร์ม
  // อ่านไม่ออก = ข้ามเฉย ๆ — ชั้นนี้ปฏิเสธได้ อนุมัติไม่ได้
  const qr = await decodeSlipQr(bytes);
  if (qr) {
    const { data: dupRef } = await svc.from("slip_refs").select("trans_ref").eq("trans_ref", qr.transRef).maybeSingle();
    if (dupRef) return NextResponse.json({ ok: false, error: "สลิปใบนี้ถูกใช้ยืนยันไปแล้ว — ถ้าเป็นความเข้าใจผิด ติดต่อผู้ดูแลระบบ" });
    // เก็บเลขติดรายการตั้งแต่ตอนอัป — เส้นอนุมัติมือจะได้ dedupe ด้วย unique index เดียวกัน
    // และ admin_confirm_topup จะลงทะเบียนกลางให้ตอนกดยืนยัน
    const { error: refErr } = await svc.from("topups").update({ slip_trans_ref: qr.transRef }).eq("id", topupId);
    if (refErr) return NextResponse.json({ ok: false, error: "สลิปใบนี้ถูกใช้ยืนยันไปแล้ว — ถ้าเป็นความเข้าใจผิด ติดต่อผู้ดูแลระบบ" });
  }

  const path = `${topup.shop_id}/topup-slip/${topupId}.jpg`;
  // เก็บสลิปไม่สำเร็จ = ไม่มีหลักฐานให้แอดมินดู ต้องบอกให้ส่งใหม่ ห้ามเดินต่อแล้วเขียน path ที่ชี้ไปไฟล์ที่ไม่มีจริง
  const { error: upErr } = await svc.storage.from("slips")
    .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: true });
  if (upErr) {
    return NextResponse.json({ ok: false, error: "อัปโหลดสลิปไม่สำเร็จ — ลองใหม่อีกครั้ง หรือถ่ายรูปใหม่ให้ไฟล์เล็กลง" });
  }
  await svc.from("topups").update({ slip_path: path, status: "verifying" }).eq("id", topupId);

  // ตรวจสลิปอัตโนมัติถ้าแพลตฟอร์มตั้งค่าไว้
  const { data: pf } = await svc.from("platform_billing_settings").select("slip_provider").eq("id", true).single();
  if (pf?.slip_provider && pf.slip_provider !== "manual") {
    const { data: key } = await svc.rpc("get_platform_slip_key");
    // เพดานกลาง: เต็มแล้วตกไปเส้นอนุมัติมือด้านล่าง (ซึ่งปลุกแอดมินให้อยู่แล้ว)
    const { consumePlatformSlip } = await import("@/lib/slip-guard");
    if (key && (await consumePlatformSlip(svc)).ok) {
      try {
        const { data: t } = await svc.from("topups").select("amount,plan_code").eq("id", topupId).single();
        const fd = new FormData();
        fd.append(pf.slip_provider === "easyslip" ? "file" : "files", new Blob([bytes as BlobPart], { type: "image/jpeg" }), "slip.jpg");
        const url = pf.slip_provider === "easyslip" ? "https://developer.easyslip.com/api/v1/verify"
          : `https://api.slipok.com/api/line/apikey/${String(key).split(":")[0]}`;
        const headers: Record<string, string> = pf.slip_provider === "easyslip"
          ? { Authorization: `Bearer ${key}` } : { "x-authorization": String(key).split(":")[1] ?? String(key) };
        const res = await fetch(url, { method: "POST", headers, body: fd });
        const j = await res.json();
        const ok = pf.slip_provider === "easyslip" ? j.status === 200 : j.success;
        const amount = pf.slip_provider === "easyslip" ? j.data?.amount?.amount : j.data?.amount;
        const ref = pf.slip_provider === "easyslip" ? j.data?.transRef : j.data?.transRef;
        if (ok && amount && t && Math.abs(Number(amount) - Number(t.amount)) < 0.01) {
          // ---- ยอดตรง -> เครดิตอัตโนมัติ (ลำดับนี้สำคัญ ห้ามสลับ) ----

          // 1) จองเลขอ้างอิงในทะเบียนกลางก่อน = ด่านกันสลิปซ้ำทั้งแพลตฟอร์ม
          //    เดิมทำเป็นขั้นตอนสุดท้ายแบบ "พังเงียบได้" ทำให้สลิปที่เคยใช้จ่ายบิลร้านมาแล้ว
          //    เอามาเติมเงินซ้ำได้อีกรอบ (mini-QR อ่านไม่ออกก็ไม่มีด่านไหนกันเลย)
          if (ref) {
            const { error: refDup } = await svc.from("slip_refs")
              .insert({ trans_ref: String(ref), shop_id: topup.shop_id, source: "topup" });
            if (refDup) {
              return NextResponse.json({ ok: false, error: "สลิปใบนี้ถูกใช้ยืนยันไปแล้ว — ถ้าเป็นความเข้าใจผิด ติดต่อผู้ดูแลระบบ" });
            }
          }

          // 2) เขียนสถานะแบบมีเงื่อนไข (.neq paid) + ขอแถวกลับมา = ตัวล็อกจริงของเส้นนี้
          //    เดิมเป็น check-then-act (อ่านสถานะบรรทัดบน แล้วเขียนทับแบบไม่มีเงื่อนไข)
          //    ทำให้แอดมินกดยืนยันระหว่างรอ API หรือยิงสองคำขอพร้อมกัน = เครดิตเข้าสองรอบ
          //    แม่แบบมาจาก omise/webhook ที่ทำถูกอยู่แล้ว
          const { data: claimed, error: claimErr } = await svc.from("topups")
            .update({ slip_trans_ref: ref ?? null, slip_data: j, status: "paid", verified_by: "auto", paid_at: new Date().toISOString() })
            .eq("id", topupId).neq("status", "paid").select("id");
          // ⚠️ ต้องแยก "เขียนไม่สำเร็จ" ออกจาก "คนอื่นยืนยันไปก่อน" — postgrest คืน data:null ทั้งสองกรณี
          // ถ้ากลืน error จะตอบลูกค้าว่า "เครดิตเข้าเรียบร้อย" ทั้งที่ไม่ได้เครดิต และเลขสลิปที่เพิ่งจองไว้
          // จะค้างในทะเบียนกลางตลอดไป ทำให้เขาส่งใหม่ก็โดนตีกลับว่า "สลิปใบนี้ถูกใช้แล้ว" = ตันถาวร
          if (claimErr) {
            if (ref) await svc.from("slip_refs").delete().eq("trans_ref", String(ref));
            return NextResponse.json({ ok: false, error: "บันทึกการชำระเงินไม่สำเร็จ — ลองส่งสลิปอีกครั้ง ถ้ายังไม่ได้ติดต่อผู้ดูแลระบบ" });
          }
          if (!claimed || claimed.length === 0) {
            // มีคนอื่นยืนยันไปก่อนแล้ว (แอดมิน/คำขอคู่แข่ง) — ห้ามเครดิตซ้ำ
            return NextResponse.json({ ok: true, auto: true, message: "รายการนี้ยืนยันแล้ว — เครดิต/แพ็กเกจเข้าเรียบร้อย" });
          }

          // 3) เครดิตเข้ากระเป๋า — ต้องรู้ผลจริง ห้ามทิ้ง error
          //    (มี unique index wallet_tx_topup_once เป็นตาข่ายชั้นสุดท้ายที่ DB อีกชั้น)
          const { error: creditErr } = await svc.rpc("credit_wallet", {
            p_shop_id: topup.shop_id, p_amount: Number(t.amount), p_type: "topup",
            p_ref_type: "topup", p_ref_id: topupId, p_note: "เติมเงิน PromptPay (auto)", p_actor: user.id,
          });
          if (creditErr) {
            // เงินเข้าบัญชีจริงแล้วแต่เครดิตไม่เข้า = ต้องมีคนมาเก็บงาน ห้ามตอบว่าสำเร็จ
            // ⚠️ ต้องคืนสถานะเป็น verifying ด้วย ไม่งั้น admin_confirm_topup ปฏิเสธแถวที่เป็น paid แล้ว
            //    (มันเช็ค `if status = 'paid' then return ok:false`) = ปุ่มที่เราบอกให้แอดมินไปกด กดไม่ได้
            //    และเลขสลิปที่จองไว้ต้องปล่อยคืน ไม่งั้นเส้นอนุมัติมือก็เดินไม่ได้เหมือนกัน
            await svc.from("topups").update({
              status: "verifying", verified_by: null, paid_at: null,
              error: `credit_wallet: ${creditErr.message}`.slice(0, 300),
            }).eq("id", topupId);
            if (ref) await svc.from("slip_refs").delete().eq("trans_ref", String(ref));
            await notifyPlatformAdmins(svc, {
              title: "ด่วน: ลูกค้าจ่ายเงินแล้วแต่เครดิตไม่เข้า",
              body: `รายการ ${topupId} — ตรวจสลิปผ่านและสถานะเป็นชำระแล้ว แต่ credit_wallet ล้มเหลว ต้องเข้าไปจัดการมือ`,
              url: "/dashboard/admin/billing", tag: `credit-fail:${topupId}`,
            });
            return NextResponse.json({ ok: false, error: "ตรวจสลิปผ่านแล้ว แต่ระบบบันทึกเครดิตไม่สำเร็จ — แจ้งผู้ดูแลให้แล้ว จะรีบจัดการให้ทันที" });
          }

          // 4) ซื้อแพ็กเกจจ่ายตรง -> เปิดแพ็ก + ตัดค่าแพ็ก + ตั้งรอบบิล (idempotent)
          const { data: applied, error: applyErr } = await svc.rpc("apply_plan_purchase", { p_topup_id: topupId });
          const res = applied as { ok?: boolean; plan?: string; error?: string } | null;
          if (t.plan_code && (applyErr || res?.ok === false)) {
            // จ่ายค่าแพ็กแล้วแต่เปิดแพ็กไม่สำเร็จ = ห้ามเงียบ (เดิมทิ้งผลลัพธ์ ผู้ใช้เห็นแค่ "เครดิตเข้าแล้ว")
            await notifyPlatformAdmins(svc, {
              title: "ด่วน: จ่ายค่าแพ็กแล้วแต่เปิดแพ็กไม่สำเร็จ",
              body: `รายการ ${topupId} — ${applyErr?.message ?? res?.error ?? "ไม่ทราบสาเหตุ"} · เครดิตเข้าแล้ว ต้องเปิดแพ็กให้มือ`,
              url: "/dashboard/admin/billing", tag: `plan-fail:${topupId}`,
            });
            return NextResponse.json({ ok: true, auto: true, message: "ชำระสำเร็จ! เครดิตเข้าแล้ว — กำลังเปิดแพ็กเกจให้ ผู้ดูแลได้รับแจ้งแล้ว" });
          }
          return NextResponse.json({ ok: true, auto: true, message: res?.plan ? "ชำระสำเร็จ! เปิดแพ็กเกจให้แล้ว ใช้งานได้ทันที" : "เติมเงินสำเร็จ! เครดิตเข้าแล้ว" });
        }
      } catch { /* fallback manual */ }
    }
  }
  // มาถึงตรงนี้ = ต้องให้คนกดอนุมัติ ต้องปลุกผู้ดูแลทันที
  // เดิมไม่แจ้งใครเลย รายการไปกองเงียบ ๆ ในหน้าแอดมิน คนจ่ายตอนกลางคืนรอถึงเช้า
  // (วัดจากข้อมูลจริง: มีคนเดินมาถึงขั้นจ่าย 7 ครั้ง ไม่สำเร็จสักครั้ง)
  const { data: shop } = await svc.from("shops").select("name").eq("id", topup.shop_id).maybeSingle();
  const { data: amt } = await svc.from("topups").select("amount,plan_code").eq("id", topupId).single();
  await notifyPlatformAdmins(svc, {
    title: "มีคนรอจ่ายเงิน — กดยืนยันให้เขาด้วย",
    body: `${shop?.name ?? "กิจการ"} อัปสลิป ${Number(amt?.amount ?? 0).toLocaleString("th-TH")} บาท`
      + `${amt?.plan_code ? ` (แพ็ก ${amt.plan_code})` : ""} · เขากำลังรออยู่ตอนนี้`,
    url: "/dashboard/admin/billing",
    tag: `topup:${topupId}`,
  });

  // บอกความจริงกับคนจ่าย — "ไม่กี่นาที" ที่ไม่มีใครรับประกันได้ ทำให้เขารู้สึกโดนลอยแพเมื่อมันนาน
  return NextResponse.json({
    ok: true, auto: false,
    message: "ได้รับสลิปแล้ว — แจ้งผู้ดูแลให้ตรวจแล้ว ระบบจะเปิดแพ็กเกจให้ทันทีที่ยืนยัน",
  });
}
