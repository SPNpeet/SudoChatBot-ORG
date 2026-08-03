"use server";
// ============================================================
//  Server Actions กลาง — ทุกฟังก์ชันตรวจสิทธิ์สมาชิกก่อนแตะ service role เสมอ
//  ทุก action คืน { ok } เสมอ — ห้าม throw ให้หลุดถึง client (Next.js
//  production ซ่อนข้อความ throw จาก Server Action เป็นข้อความอ่านไม่รู้เรื่อง)
// ============================================================
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { revalidatePath } from "next/cache";
import { branchLabel } from "@/lib/tax-th";

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
/**
 * กดอ่านข้อความในกล่องจดหมายระบบ
 *
 * กุญแจขึ้นต้น row: = แถวจริงในตาราง notifications -> อัปเดต read ที่แถวนั้น
 * กุญแจอื่น = ข้อความที่คำนวณสดจากสถานะ -> บันทึกลง notice_dismissals
 *
 * ⚠️ กุญแจผูกกับสถานะ (เช่น health:partners:3) ถ้าสถานะแย่ลงกุญแจเปลี่ยน
 * แล้วข้อความเด้งขึ้นใหม่ — กดอ่านครั้งเดียวไม่ได้ปิดปัญหาที่โตขึ้นไปตลอด
 */
export async function dismissNotice(shopId: string, noticeKey: string): Promise<ActionResult> {
  try {
    await assertMember(shopId);
    const key = String(noticeKey).slice(0, 200);
    if (!key) return { ok: false, error: "ไม่พบข้อความที่จะปิด" };
    const supabase = await createClient();

    if (key.startsWith("row:")) {
      const id = key.slice(4);
      const { error } = await supabase.from("notifications")
        .update({ read: true }).eq("id", id).eq("shop_id", shopId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { data: me } = await supabase.auth.getUser();
      if (!me?.user) return { ok: false, error: "เซสชันหมดอายุ เข้าระบบใหม่อีกครั้ง" };
      // กดซ้ำจากหลายแท็บได้ไม่พัง — คีย์หลักคือ (shop, user, key)
      const { error } = await supabase.from("notice_dismissals")
        .upsert({ shop_id: shopId, user_id: me.user.id, notice_key: key },
          { onConflict: "shop_id,user_id,notice_key" });
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "ปิดข้อความไม่สำเร็จ") };
  }
}

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
      // แปลงเป็นรูปแบบที่กฎหมายรับ ("สำนักงานใหญ่" / "สาขาที่ 00001") ตั้งแต่ตอนบันทึก
      // ผู้ใช้จะพิมพ์ "1" หรือ "สาขา 1" มาก็ได้ ไม่ต้องรู้รูปแบบราชการ
      branch: branchLabel(String(formData.get("branch") ?? "")),
    }).eq("id", shopId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/print", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "บันทึกข้อมูลกิจการไม่สำเร็จ") };
  }
}

// ---------- ลายเซ็นอิเล็กทรอนิกส์บนเอกสาร ----------
//
// เก็บเป็นไฟล์ PNG ใน bucket shop-assets แล้วอ้าง URL ใน shops.settings
// ⚠️ ห้ามเก็บ data URL ลงฐานข้อมูลตรง ๆ — ภาพ base64 ยาว ~30-80KB ต่อรูป
// ถูกดึงมาพร้อม shop ทุกครั้งที่โหลดหน้าไหนก็ตามใน dashboard (layout ดึง shop เสมอ)
// = จ่ายค่า egress ทุกการเปิดหน้าเพื่อรูปที่ใช้เฉพาะตอนพิมพ์เอกสาร

const SIG_MAX_BYTES = 300 * 1024;   // 600x200 PNG ลายเส้นจริงอยู่ราว 10-40KB

export async function saveSignature(shopId: string, dataUrl: string): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? "");
    if (!m) return { ok: false, error: "รูปลายเซ็นไม่ถูกต้อง" };
    const bytes = Buffer.from(m[1], "base64");
    if (!bytes.length) return { ok: false, error: "ยังไม่ได้วาดลายเซ็น" };
    if (bytes.length > SIG_MAX_BYTES) return { ok: false, error: "ลายเซ็นใหญ่เกินไป ลองวาดใหม่ให้เส้นน้อยลง" };

    const svc = createServiceClient();
    // ชื่อไฟล์คงที่ + upsert — เปลี่ยนลายเซ็นแล้วไม่ทิ้งไฟล์เก่าค้างใน storage
    // ต่อท้ายด้วย ?v= ตอนอ่าน เพื่อให้เบราว์เซอร์ไม่โชว์รูปเก่าจาก cache
    const path = `${shopId}/signature.png`;
    const { error: upErr } = await svc.storage.from("shop-assets")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (upErr) return { ok: false, error: upErr.message };
    const { data: pub } = svc.storage.from("shop-assets").getPublicUrl(path);
    const url = `${pub.publicUrl}?v=${Date.now()}`;

    const { data: shop } = await svc.from("shops").select("settings").eq("id", shopId).maybeSingle();
    const settings = { ...((shop?.settings ?? {}) as Record<string, unknown>), signature_url: url };
    const { error } = await svc.from("shops").update({ settings }).eq("id", shopId);
    if (error) return { ok: false, error: error.message };

    await svc.from("audit_logs").insert({
      shop_id: shopId, action: "signature_updated", actor_type: "user",
      resource_type: "shop", resource_id: shopId, details: {},
    });
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/print", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "บันทึกลายเซ็นไม่สำเร็จ") };
  }
}

export async function clearSignature(shopId: string): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    await svc.storage.from("shop-assets").remove([`${shopId}/signature.png`]);
    const { data: shop } = await svc.from("shops").select("settings").eq("id", shopId).maybeSingle();
    const settings = { ...((shop?.settings ?? {}) as Record<string, unknown>) };
    delete settings.signature_url;
    const { error } = await svc.from("shops").update({ settings }).eq("id", shopId);
    if (error) return { ok: false, error: error.message };
    await svc.from("audit_logs").insert({
      shop_id: shopId, action: "signature_cleared", actor_type: "user",
      resource_type: "shop", resource_id: shopId, details: {},
    });
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/print", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "ลบลายเซ็นไม่สำเร็จ") };
  }
}

// ---------- ปิดงวด / ปลดล็อกงวด ----------
// ตัวเลขที่ยื่น ภ.พ.30 หรือ ภ.ง.ด. ไปแล้วต้องนิ่งตลอดไป ถ้ายังแก้ย้อนหลังได้
// ระบบจะไม่ตรงกับแบบที่ยื่น และอธิบายกับสรรพากรตอนตรวจย้อนหลังไม่ได้
//
// การบังคับจริงอยู่ที่ trigger ในฐานข้อมูล (assert_period_open) ไม่ใช่ที่นี่
// ฟังก์ชันนี้แค่ตั้งค่าและบันทึกร่องรอย ต่อให้มีทางเขียนข้อมูลที่ลืมเช็ค
// หรือมีคนเข้าถึง service role ตรง ๆ ก็ยังทะลุงวดที่ปิดไม่ได้

export async function setPeriodLock(shopId: string, formData: FormData): Promise<ActionResult> {
  try {
    const { user } = await assertMember(shopId, ["owner", "admin"]);
    const raw = String(formData.get("locked_through") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { ok: false, error: "เลือกวันที่ปิดงวดก่อน" };

    // ห้ามปิดงวดล่วงหน้า — จะทำให้ออกเอกสารของวันนี้ไม่ได้ทันที
    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    if (raw >= today) return { ok: false, error: "ปิดงวดได้ถึงเมื่อวานเป็นอย่างช้า ไม่งั้นจะออกเอกสารวันนี้ไม่ได้" };

    const svc = createServiceClient();
    const { error } = await svc.from("fin_period_locks").upsert({
      shop_id: shopId, locked_through: raw, locked_by: user.id,
      locked_at: new Date().toISOString(),
      note: String(formData.get("note") ?? "").trim().slice(0, 300) || null,
    }, { onConflict: "shop_id" });
    if (error) return { ok: false, error: error.message };

    await svc.from("audit_logs").insert({
      actor_type: "user", actor_id: user.id, action: "period_locked",
      resource_type: "fin_period_locks", resource_id: shopId,
      details: { locked_through: raw },
    });
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "ปิดงวดไม่สำเร็จ") };
  }
}

export async function clearPeriodLock(shopId: string): Promise<ActionResult> {
  try {
    // ปลดล็อกเป็นเรื่องใหญ่ทางบัญชี — เจ้าของเท่านั้น และต้องมีร่องรอยเสมอ
    const { user } = await assertMember(shopId, ["owner"]);
    const svc = createServiceClient();
    const { data: cur } = await svc.from("fin_period_locks").select("locked_through").eq("shop_id", shopId).maybeSingle();
    const { error } = await svc.from("fin_period_locks").delete().eq("shop_id", shopId);
    if (error) return { ok: false, error: error.message };

    await svc.from("audit_logs").insert({
      actor_type: "user", actor_id: user.id, action: "period_unlocked",
      resource_type: "fin_period_locks", resource_id: shopId,
      details: { was_locked_through: cur?.locked_through ?? null },
    });
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "ปลดล็อกงวดไม่สำเร็จ") };
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
      link_source: "own",
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
    const { resolveLineSender, pushLineMessage } = await import("@/lib/line");
    const sender = await resolveLineSender(svc, shopId);
    if (!sender) return { ok: false, error: "ยังไม่ได้เชื่อม LINE — กดปุ่ม 'เชื่อมต่อ LINE' ก่อนนะ" };
    const r = await pushLineMessage(sender.token, sender.to,
      "🔔 ทดสอบจาก SudoChatBot — การแจ้งเตือนใช้งานได้ปกติค่ะ");
    return r.ok ? { ok: true } : { ok: false, error: r.error ?? "ส่งไม่สำเร็จ" };
  } catch (e) {
    return { ok: false, error: friendly(e, "ทดสอบไม่สำเร็จ") };
  }
}

/** ยกเลิกการเชื่อม LINE ของกิจการ */
export async function unlinkLine(shopId: string): Promise<ActionResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();
    const { error } = await svc.from("shop_notify_settings")
      .update({ line_to_id: null, line_channel_token: null, line_display_name: null, linked_at: null, updated_at: new Date().toISOString() })
      .eq("shop_id", shopId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "ยกเลิกการเชื่อมต่อไม่สำเร็จ") };
  }
}

// ---------- บัญชีผู้ใช้ของตัวเอง ----------
/**
 * แก้ชื่อที่แสดง/เบอร์ของตัวเอง
 *
 * ⚠️ ใช้ client ปกติ (ไม่ใช่ service role) โดยตั้งใจ — RLS ของตาราง profiles
 * บังคับ id = auth.uid() อยู่แล้ว จึงแก้ของคนอื่นไม่ได้แม้ส่ง id มาเอง
 * ที่นี่ไม่รับ id จากฝั่ง client เลยด้วยซ้ำ ยึดจาก session ฝั่งเซิร์ฟเวอร์อย่างเดียว
 *
 * ไม่ให้แก้อีเมลตรงนี้ — อีเมลคือกุญแจล็อกอินและเป็นตัวระบุตัวตนใน audit log
 * การเปลี่ยนต้องยืนยันทางอีเมลทั้งใบเก่าและใบใหม่ ไม่ใช่แค่พิมพ์ทับ
 */
export async function updateMyProfile(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบใหม่" };

    const name = String(formData.get("display_name") ?? "").trim().slice(0, 80);
    const phone = String(formData.get("phone") ?? "").trim().slice(0, 30);
    if (name.length < 2) return { ok: false, error: "ชื่อที่แสดงต้องยาวอย่างน้อย 2 ตัวอักษร" };

    // upsert เพราะแถว profiles อาจไม่มีถ้าสมัครก่อนที่ระบบจะมี trigger สร้างให้
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: name,
      phone: phone || null,
      email: user.email ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };

    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "บันทึกไม่สำเร็จ") };
  }
}
