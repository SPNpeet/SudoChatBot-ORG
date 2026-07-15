"use server";
// ============================================================
//  Billing — เติมเงิน (PromptPay QR + สลิป), เปลี่ยนแพ็กเกจ
// ============================================================
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { revalidatePath } from "next/cache";

// ==== PromptPay QR (มาตรฐาน EMVCo) ====
function tlv(id: string, v: string) { return id + v.length.toString().padStart(2, "0") + v; }
function crc16(p: string) {
  let c = 0xffff;
  for (let i = 0; i < p.length; i++) { c ^= p.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = (c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1) & 0xffff; }
  return c.toString(16).toUpperCase().padStart(4, "0");
}
function promptPayPayload(target: string, amount: number) {
  const d = target.replace(/[^0-9]/g, "");
  const acct = d.length === 13 ? tlv("02", d) : d.length === 15 ? tlv("03", d) : tlv("01", "0066" + d.replace(/^0/, ""));
  let p = tlv("00", "01") + tlv("01", "12") + tlv("29", tlv("00", "A000000677010111") + acct) + tlv("53", "764") + tlv("54", amount.toFixed(2)) + tlv("58", "TH") + "6304";
  return p + crc16(p);
}

/** สร้างรายการเติมเงิน + QR พร้อมเพย์ของแพลตฟอร์ม */
export async function createTopup(shopId: string, amount: number) {
  await assertMember(shopId, ["owner", "admin"]);
  if (amount < 20) throw new Error("ขั้นต่ำ 20 บาท");
  const svc = createServiceClient();
  const { data: pf } = await svc.from("platform_billing_settings").select("promptpay_id,account_name").eq("id", true).single();
  if (!pf?.promptpay_id) throw new Error("แพลตฟอร์มยังไม่ได้ตั้งค่าบัญชีรับเงิน — ติดต่อผู้ดูแลระบบ");

  const { data: topup, error } = await svc.from("topups").insert({
    shop_id: shopId, amount, method: "promptpay", status: "pending",
  }).select("id").single();
  if (error) throw new Error(error.message);

  const payload = promptPayPayload(pf.promptpay_id, amount);
  let qrUrl = "";
  try {
    const QRCode = (await import("qrcode")).default;
    const dataUrl = await QRCode.toDataURL(payload, { width: 512, margin: 2 });
    const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
    const path = `${shopId}/topup/${topup.id}.png`;
    await svc.storage.from("shop-assets").upload(path, bytes, { contentType: "image/png", upsert: true });
    const { data: pub } = svc.storage.from("shop-assets").getPublicUrl(path);
    qrUrl = pub.publicUrl;
    await svc.from("topups").update({ qr_path: path }).eq("id", topup.id);
  } catch { /* ยังแสดงเลขพร้อมเพย์ได้ */ }

  revalidatePath("/dashboard/billing");
  return { topupId: topup.id, qrUrl, promptpayId: pf.promptpay_id, accountName: pf.account_name, amount };
}

export async function changePlan(shopId: string, planCode: string) {
  await assertMember(shopId, ["owner"]);
  const supabase = await createClient();
  const { error } = await supabase.from("shops").update({ plan: planCode, plan_since: new Date().toISOString().slice(0, 10) }).eq("id", shopId);
  if (error) throw new Error(error.message);
  const svc = createServiceClient();
  await svc.from("audit_logs").insert({ shop_id: shopId, actor_type: "user", action: "plan_changed", resource_type: "shops", resource_id: shopId, details: { plan: planCode } });
  revalidatePath("/dashboard/billing");
}
