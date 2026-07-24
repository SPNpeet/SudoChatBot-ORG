"use server";
// ============================================================
//  Server Actions กลาง — ทุกฟังก์ชันตรวจสิทธิ์สมาชิกก่อนแตะ service role เสมอ
//  ทุก action คืน { ok } เสมอ — ห้าม throw ให้หลุดถึง client (Next.js
//  production ซ่อนข้อความ throw จาก Server Action เป็นข้อความอ่านไม่รู้เรื่อง)
// ============================================================
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true } | { ok: false; error: string };

function friendly(e: unknown, fallback: string): string {
  const m = (e as Error).message ?? String(e);
  if (m.includes("forbidden")) return "คุณไม่มีสิทธิ์ทำรายการนี้ในธุรกิจนี้";
  return m || fallback;
}

// ---------- ความเห็นผู้ใช้ถึงเจ้าของแพลตฟอร์ม ----------
export async function submitFeedback(shopId: string, message: string, page: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบใหม่" };
    const msg = message.trim().slice(0, 2000);
    if (msg.length < 3) return { ok: false, error: "พิมพ์อย่างน้อย 3 ตัวอักษร" };
    const { error } = await supabase.from("feedback").insert({ shop_id: shopId, user_id: user.id, message: msg, page: page.slice(0, 200) });
    if (error) return { ok: false, error: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง" };
    return { ok: true };
  } catch {
    return { ok: false, error: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

// ---------- สินค้า/บริการ (ใช้เป็นรายการในเอกสารขาย + ตัดสต๊อก) ----------
export async function upsertProduct(shopId: string, formData: FormData): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const supabase = await createClient();
    const id = String(formData.get("id") ?? "");
    const row = {
      shop_id: shopId,
      name: String(formData.get("name") ?? "").trim(),
      sku: String(formData.get("sku") ?? "").trim() || null,
      category: String(formData.get("category") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
      price: Number(formData.get("price") ?? 0),
      cost: formData.get("cost") ? Number(formData.get("cost")) : null,
      stock: parseInt(String(formData.get("stock") ?? "0"), 10) || 0,
      track_stock: formData.get("track_stock") === "on",
      status: String(formData.get("status") ?? "active"),
      images: (() => {
        try { return JSON.parse(String(formData.get("images_json") ?? "[]")); } catch { return []; }
      })(),
    };
    if (!row.name) return { ok: false, error: "ต้องมีชื่อสินค้า/บริการ" };

    if (id) {
      const { error } = await supabase.from("products").update(row).eq("id", id).eq("shop_id", shopId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from("products").insert(row);
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/dashboard/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "บันทึกสินค้าไม่สำเร็จ") };
  }
}

export async function archiveProduct(productId: string, shopId: string): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const supabase = await createClient();
    await supabase.from("products").update({ status: "archived" }).eq("id", productId).eq("shop_id", shopId);
    revalidatePath("/dashboard/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "เก็บสินค้าเข้าคลังไม่สำเร็จ") };
  }
}

/** อัปโหลดรูปสินค้า 1 รูป — คืน URL ให้ฟอร์มเก็บไว้ใน images_json ก่อนบันทึกสินค้าจริง */
export async function uploadProductImage(shopId: string, formData: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const supabase = await createClient();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) return { ok: false, error: "เลือกไฟล์ก่อน" };
    if (!file.type.startsWith("image/")) return { ok: false, error: "รองรับเฉพาะไฟล์รูปภาพ" };
    if (file.size > 5 * 1024 * 1024) return { ok: false, error: "ไฟล์ใหญ่เกิน 5MB" };
    const path = `${shopId}/products/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-ก-๙]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("shop-assets").upload(path, file, { contentType: file.type });
    if (upErr) return { ok: false, error: upErr.message };
    const { data: pub } = supabase.storage.from("shop-assets").getPublicUrl(path);
    return { ok: true, url: pub.publicUrl };
  } catch (e) {
    return { ok: false, error: friendly(e, "อัปโหลดรูปไม่สำเร็จ") };
  }
}

// ---------- ตั้งค่าบัญชีรับเงิน (พร้อมเพย์บนเอกสาร + ตรวจสลิป) ----------
export async function savePaymentSettings(shopId: string, formData: FormData): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const supabase = await createClient();
    const { error } = await supabase.from("shop_payment_settings").upsert({
      shop_id: shopId,
      promptpay_id: String(formData.get("promptpay_id") ?? "").trim() || null,
      account_name: String(formData.get("account_name") ?? "").trim() || null,
      bank_name: String(formData.get("bank_name") ?? "").trim() || null,
      slip_provider: String(formData.get("slip_provider") ?? "manual"),
    });
    if (error) return { ok: false, error: error.message };

    const slipKey = String(formData.get("slip_api_key") ?? "").trim();
    if (slipKey) {
      const svc = createServiceClient();
      await svc.rpc("store_shop_slip_key", { p_shop_id: shopId, p_key: slipKey });
    }
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "บันทึกการตั้งค่าการเงินไม่สำเร็จ") };
  }
}

// ---------- ทีม ----------
export async function addMember(shopId: string, formData: FormData): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = String(formData.get("role") ?? "agent");
    if (!email) return { ok: false, error: "กรอกอีเมล" };
    const svc = createServiceClient();
    const { data: profile } = await svc.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (!profile) return { ok: false, error: "ไม่พบผู้ใช้อีเมลนี้ — ให้เขา Login เข้าระบบครั้งแรกก่อน" };
    const { error } = await svc.from("shop_members").insert({ shop_id: shopId, user_id: profile.id, role });
    if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "เชิญสมาชิกไม่สำเร็จ") };
  }
}

export async function removeMember(memberId: string, shopId: string): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const supabase = await createClient();
    await supabase.from("shop_members").delete().eq("id", memberId).eq("shop_id", shopId).neq("role", "owner");
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "ลบสมาชิกไม่สำเร็จ") };
  }
}

// ---------- แจ้งเตือน ----------
export async function markNotificationRead(notificationId: string, shopId: string): Promise<ActionResult> {
  try {
    await assertMember(shopId);
    const supabase = await createClient();
    await supabase.from("notifications").update({ read: true }).eq("id", notificationId).eq("shop_id", shopId);
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "อัปเดตแจ้งเตือนไม่สำเร็จ") };
  }
}

// ---------- ข้อมูลกิจการ/ภาษี (ใช้พิมพ์หัวเอกสาร-ใบกำกับภาษี) ----------
export async function saveTaxInfo(shopId: string, formData: FormData): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    const { error } = await svc.from("shops").update({
      billing_name: String(formData.get("billing_name") ?? "").trim() || null,
      billing_address: String(formData.get("billing_address") ?? "").trim() || null,
      tax_id: String(formData.get("tax_id") ?? "").replace(/[^0-9]/g, "") || null,
    }).eq("id", shopId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "บันทึกข้อมูลกิจการไม่สำเร็จ") };
  }
}

// ---------- สลับ/สร้างบริษัท (สำนักงานบัญชีดูแลหลายกิจการในบัญชีเดียว) ----------
export async function switchShop(shopId: string): Promise<ActionResult> {
  try {
    await assertMember(shopId);
    const { cookies } = await import("next/headers");
    (await cookies()).set("active_shop", shopId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "สลับบริษัทไม่สำเร็จ") };
  }
}

export async function createShop(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบใหม่" };
    const name = String(formData.get("name") ?? "").trim().slice(0, 100);
    if (!name) return { ok: false, error: "ตั้งชื่อกิจการก่อน" };

    const svc = createServiceClient();
    // ลิมิตจำนวนกิจการตามแพ็ก (Starter 1 · Professional 3 · Executive 5 · Agency ไม่จำกัด)
    const { data: canCreate } = await svc.rpc("can_create_company", { p_owner: user.id });
    const cc = canCreate as { allowed?: boolean; used?: number; cap?: number; plan?: string } | null;
    if (cc && cc.allowed === false) {
      return { ok: false, error: `แพ็กเกจ ${cc.plan ?? "ปัจจุบัน"} รองรับ ${cc.cap} กิจการ (ใช้ครบแล้ว) — อัปเกรดที่หน้า แพ็กเกจ/เครดิต เพื่อเพิ่มกิจการ (Professional = 3 · AI Executive = 5 · Agency = ไม่จำกัด)` };
    }

    const { data: shop, error } = await svc.from("shops").insert({ owner_id: user.id, name, plan: "free", status: "active" }).select("id").single();
    if (error || !shop) return { ok: false, error: error?.message ?? "สร้างไม่สำเร็จ" };
    const { error: memErr } = await svc.from("shop_members").insert({ shop_id: shop.id, user_id: user.id, role: "owner" });
    if (memErr && !memErr.message.includes("duplicate")) return { ok: false, error: memErr.message };

    const { cookies } = await import("next/headers");
    (await cookies()).set("active_shop", shop.id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "สร้างกิจการไม่สำเร็จ") };
  }
}

// ---------- แจ้งเตือน LINE (Messaging API — LINE Notify ปิดบริการแล้ว) ----------
export async function saveNotifySettings(shopId: string, formData: FormData): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    const token = String(formData.get("line_channel_token") ?? "").trim();
    const toId = String(formData.get("line_to_id") ?? "").trim().slice(0, 100);
    const patch: Record<string, unknown> = {
      shop_id: shopId,
      line_to_id: toId || null,
      notify_approval: formData.get("notify_approval") === "on",
      updated_at: new Date().toISOString(),
    };
    // ช่อง token ว่าง = คงค่าเดิม (หน้าเว็บโชว์แค่ masked)
    if (token) patch.line_channel_token = token.slice(0, 500);
    if (token === "__clear__") patch.line_channel_token = null;
    const { error } = await svc.from("shop_notify_settings").upsert(patch, { onConflict: "shop_id" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "บันทึกการแจ้งเตือนไม่สำเร็จ") };
  }
}

export async function testLineNotify(shopId: string): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    const { data: s } = await svc.from("shop_notify_settings")
      .select("line_channel_token,line_to_id").eq("shop_id", shopId).maybeSingle();
    if (!s?.line_channel_token || !s?.line_to_id) {
      return { ok: false, error: "ใส่ Channel access token และ User/Group ID แล้วกดบันทึกก่อนนะ" };
    }
    const { pushLineMessage } = await import("@/lib/line");
    const ok = await pushLineMessage(s.line_channel_token, s.line_to_id,
      "✅ SudoChatBot เชื่อมต่อ LINE สำเร็จ! การแจ้งเตือน (เช่น ค่าใช้จ่ายรออนุมัติ) จะส่งเข้าห้องนี้ค่ะ");
    return ok ? { ok: true } : { ok: false, error: "ส่งไม่สำเร็จ — เช็ค token และ ID อีกครั้ง (บอทต้องเป็นเพื่อน/อยู่ในกลุ่มปลายทางแล้ว)" };
  } catch (e) {
    return { ok: false, error: friendly(e, "ทดสอบไม่สำเร็จ") };
  }
}
