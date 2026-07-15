import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `${topup.shop_id}/topup-slip/${topupId}.jpg`;
  await svc.storage.from("slips").upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: true });
  await svc.from("topups").update({ slip_path: path, status: "verifying" }).eq("id", topupId);

  // ตรวจสลิปอัตโนมัติถ้าแพลตฟอร์มตั้งค่าไว้
  const { data: pf } = await svc.from("platform_billing_settings").select("slip_provider").eq("id", true).single();
  if (pf?.slip_provider && pf.slip_provider !== "manual") {
    const { data: key } = await svc.rpc("get_platform_slip_key");
    if (key) {
      try {
        const { data: t } = await svc.from("topups").select("amount").eq("id", topupId).single();
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
          // ยอดตรง -> เครดิตอัตโนมัติ
          const { error: dupErr } = await svc.from("topups").update({ slip_trans_ref: ref, slip_data: j }).eq("id", topupId);
          if (!dupErr) {
            await svc.from("topups").update({ status: "paid", verified_by: "auto", paid_at: new Date().toISOString() }).eq("id", topupId);
            await svc.rpc("credit_wallet", { p_shop_id: topup.shop_id, p_amount: Number(t.amount), p_type: "topup", p_ref_type: "topup", p_ref_id: topupId, p_note: "เติมเงิน PromptPay (auto)", p_actor: user.id });
            return NextResponse.json({ ok: true, auto: true, message: "เติมเงินสำเร็จ! เครดิตเข้าแล้ว" });
          }
        }
      } catch { /* fallback manual */ }
    }
  }
  return NextResponse.json({ ok: true, auto: false, message: "ได้รับสลิปแล้ว รอผู้ดูแลยืนยัน (ปกติภายในไม่กี่นาที)" });
}
