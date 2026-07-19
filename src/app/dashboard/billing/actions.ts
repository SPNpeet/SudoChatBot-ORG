"use server";
// ============================================================
//  Billing — เติมเงิน (PromptPay QR + สลิป), เปลี่ยนแพ็กเกจ
//  ทุก action คืน { ok } เสมอ — ห้าม throw ให้หลุดถึง client
//  (Next.js production ซ่อนข้อความ throw จาก Server Action เป็น
//  "Server Components render error" ที่ผู้ใช้อ่านไม่รู้เรื่อง)
// ============================================================
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { revalidatePath } from "next/cache";

export type TopupResult =
  | { ok: true; topupId: string; qrUrl: string; promptpayId?: string; accountName?: string; amount: number; gateway?: "omise" }
  | { ok: false; error: string };
export type PlanResult = { ok: true } | { ok: false; error: string };

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
export async function createTopup(shopId: string, amount: number): Promise<TopupResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    if (amount < 20) return { ok: false, error: "ขั้นต่ำ 20 บาท" };
    const svc = createServiceClient();
    const { data: pf } = await svc.from("platform_billing_settings").select("promptpay_id,account_name").eq("id", true).single();
    if (!pf?.promptpay_id) return { ok: false, error: "แพลตฟอร์มยังไม่ได้ตั้งค่าบัญชีรับเงิน — ติดต่อผู้ดูแลระบบ" };

    const { data: topup, error } = await svc.from("topups").insert({
      shop_id: shopId, amount, method: "promptpay", status: "pending",
    }).select("id").single();
    if (error) return { ok: false, error: error.message };

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
    return { ok: true, topupId: topup.id, qrUrl, promptpayId: pf.promptpay_id, accountName: pf.account_name, amount };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "เฉพาะเจ้าของ/ผู้ดูแลร้านเติมเงินได้" : `เติมเงินไม่สำเร็จ: ${m.slice(0, 150)}` };
  }
}

/** สร้างรายการเติมเงินผ่าน Omise (PromptPay source — เครดิตอัตโนมัติเมื่อจ่ายสำเร็จ) */
export async function createOmiseTopup(shopId: string, amount: number): Promise<TopupResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    if (amount < 20) return { ok: false, error: "ขั้นต่ำ 20 บาท" };
    const svc = createServiceClient();
    const { getOmiseSecretKey, createPromptPayCharge } = await import("@/lib/omise");
    const secretKey = await getOmiseSecretKey(svc);
    if (!secretKey) return { ok: false, error: "แพลตฟอร์มยังไม่ได้ตั้งค่า Omise — ติดต่อผู้ดูแลระบบ" };

    const { data: topup, error } = await svc.from("topups").insert({
      shop_id: shopId, amount, method: "promptpay", gateway: "omise", status: "pending",
    }).select("id").single();
    if (error) return { ok: false, error: error.message };

    try {
      const charge = await createPromptPayCharge(secretKey, amount, topup.id, shopId);
      await svc.from("topups").update({ charge_id: charge.id }).eq("id", topup.id);
      const qrUrl = charge.source?.scannable_code?.image?.download_uri ?? "";
      revalidatePath("/dashboard/billing");
      return { ok: true, topupId: topup.id, qrUrl, amount, gateway: "omise" };
    } catch (e) {
      await svc.from("topups").update({ status: "expired" }).eq("id", topup.id);
      return { ok: false, error: `สร้างรายการชำระเงินไม่สำเร็จ: ${(e as Error).message.slice(0, 150)}` };
    }
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "เฉพาะเจ้าของ/ผู้ดูแลร้านเติมเงินได้" : `เติมเงินไม่สำเร็จ: ${m.slice(0, 150)}` };
  }
}

/** เช็กสถานะรายการเติมเงิน (ใช้ poll ฝั่ง client หลังสแกน QR) */
export async function getTopupStatus(shopId: string, topupId: string) {
  await assertMember(shopId, ["owner", "admin", "agent", "viewer"]);
  const svc = createServiceClient();
  const { data } = await svc.from("topups").select("status").eq("id", topupId).eq("shop_id", shopId).single();
  return data?.status ?? "unknown";
}

export async function changePlan(shopId: string, planCode: string): Promise<PlanResult> {
  try {
    await assertMember(shopId, ["owner"]);
    const supabase = await createClient();
    const { error } = await supabase.from("shops").update({ plan: planCode, plan_since: new Date().toISOString().slice(0, 10) }).eq("id", shopId);
    if (error) return { ok: false, error: error.message };
    const svc = createServiceClient();
    await svc.from("audit_logs").insert({ shop_id: shopId, actor_type: "user", action: "plan_changed", resource_type: "shops", resource_id: shopId, details: { plan: planCode } });
    revalidatePath("/dashboard/billing");
    return { ok: true };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "เฉพาะเจ้าของร้านเปลี่ยนแพ็กเกจได้" : `เปลี่ยนแพ็กเกจไม่สำเร็จ: ${m.slice(0, 150)}` };
  }
}
