"use server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/shop";
import { revalidatePath } from "next/cache";

async function assertPlatformAdmin() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.rpc("is_platform_admin");
  if (!data) throw new Error("forbidden: platform admin only");
  return { supabase, user };
}

export type ActionResult = { ok: true } | { ok: false; error: string };
// planLabel: บอกแอดมินว่ารายการนี้คือ "ซื้อแพ็กเกจ" ไม่ใช่เติมเครดิตเฉย ๆ (และรายปีหรือรายเดือน)
// เดิมเห็นแค่ยอดเงิน แอดมินแยกไม่ออกว่ากดยืนยันแล้วจะเกิดอะไร
export type PendingTopup = { id: string; shopName: string; amount: number; status: string; createdAt: string; slipUrl: string | null; planLabel: string | null };
export type ListTopupsResult = { ok: true; rows: PendingTopup[]; hasMore: boolean } | { ok: false; error: string };

const TOPUPS_PAGE_SIZE = 30;

export async function listPendingTopups(offset: number): Promise<ListTopupsResult> {
  try {
    await assertPlatformAdmin();
    const svc = createServiceClient();
    const { data, error } = await svc.from("topups").select("id,amount,status,created_at,slip_path,plan_code,plan_period,shops(name)")
      .in("status", ["pending", "verifying"]).order("created_at", { ascending: false })
      .range(offset, offset + TOPUPS_PAGE_SIZE);
    if (error) return { ok: false, error: error.message };
    const all = data ?? [];
    const rows: PendingTopup[] = all.slice(0, TOPUPS_PAGE_SIZE).map((t) => ({
      id: t.id,
      shopName: (t.shops as unknown as { name: string } | null)?.name ?? "-",
      amount: t.amount,
      status: t.status,
      createdAt: t.created_at,
      slipUrl: t.slip_path ? svc.storage.from("slips").getPublicUrl(t.slip_path).data.publicUrl : null,
      planLabel: t.plan_code ? `ซื้อแพ็ก ${t.plan_code}${t.plan_period === "yearly" ? " (รายปี 12 เดือน)" : ""}` : null,
    }));
    return { ok: true, rows, hasMore: all.length > TOPUPS_PAGE_SIZE };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "ไม่มีสิทธิ์ดูรายการนี้" : `โหลดไม่สำเร็จ: ${m.slice(0, 150)}` };
  }
}

export async function confirmTopup(topupId: string, approve: boolean): Promise<ActionResult> {
  try {
    await assertPlatformAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_confirm_topup", { p_topup_id: topupId, p_approve: approve });
    if (error) return { ok: false, error: error.message };
    const result = data as { ok: boolean; message?: string } | null;
    if (result && result.ok === false) return { ok: false, error: result.message ?? "ทำรายการไม่สำเร็จ" };
    if (approve) {
      // ซื้อแพ็กเกจจ่ายตรง -> เปิดแพ็กให้ทันที (idempotent — ข้ามเองถ้าเป็นเติมเครดิตปกติ)
      const svc = createServiceClient();
      const { data: applied, error: applyErr } = await svc.rpc("apply_plan_purchase", { p_topup_id: topupId });
      const res = applied as { ok?: boolean; plan?: string; error?: string } | null;
      // ⚠️ ห้ามทิ้งผลลัพธ์: ถ้าเปิดแพ็กไม่สำเร็จ (เช่นแพ็กถูกปิด/เปลี่ยนรหัสระหว่างรออนุมัติ)
      // เครดิตเข้าไปแล้วแต่แพ็กไม่เปิด และรายการกลายเป็น paid จึงหลุดจากคิวรออนุมัติ
      // = ลูกค้าจ่ายค่าแพ็กแล้วไม่ได้แพ็ก โดยไม่มีใครรู้เลย ต้องบอกแอดมินตรงนั้นทันที
      if (applyErr || res?.ok === false) {
        revalidatePath("/dashboard/admin/billing");
        return {
          ok: false,
          error: `ยืนยันเงินเข้าแล้ว แต่เปิดแพ็กเกจไม่สำเร็จ (${applyErr?.message ?? res?.error ?? "ไม่ทราบสาเหตุ"}) — ตั้งแพ็กให้กิจการนี้เองที่หน้า จัดการผู้ใช้ระบบ`,
        };
      }
    }
    revalidatePath("/dashboard/admin/billing");
    return { ok: true };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "ไม่มีสิทธิ์ทำรายการนี้" : `ทำรายการไม่สำเร็จ: ${m.slice(0, 150)}` };
  }
}

// ผลของการบันทึกต้อง "ยืนยันได้" ไม่ใช่แค่บอกว่าสำเร็จ
// เกิดจริง 8 ส.ค. 2569: กดบันทึกแล้วขึ้น "บันทึกสำเร็จ" ทุกครั้งแม้ไม่ได้กรอกคีย์อะไรเลย
// เจ้าของจึงแยกไม่ออกว่าคีย์เข้าจริงไหม และไม่รู้ว่าตอนนี้ระบบรับเงินได้หรือยัง
// จึงคืนกลับมาว่า "เก็บอะไรไปบ้าง" + อ่านซ้ำจาก Vault เพื่อบอกสถานะจริงหลังบันทึก
export type SaveBillingResult =
  | { ok: true; savedKeys: string[]; stripeReady: boolean }
  | { ok: false; error: string };

export async function savePlatformBilling(formData: FormData): Promise<SaveBillingResult> {
  try {
    await assertPlatformAdmin();
    const svc = createServiceClient();
    // ⚠️ อัปเดตเฉพาะช่องที่ฟอร์มส่งมาเท่านั้น (แก้ 9 ส.ค. 2569)
    // หน้าตั้งค่าถูกแยกเป็นการ์ดคนละใบ การ์ดละปุ่มบันทึก — ถ้ายังเขียนทับทุกคอลัมน์
    // เหมือนเดิม การ์ดหนึ่งกดบันทึก = ค่าของการ์ดอื่นถูกล้างเป็น null เงียบ ๆ ทั้งแถบ
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const putText = (key: string, fallback: string | null = null) => {
      if (formData.has(key)) patch[key] = String(formData.get(key) ?? "").trim() || fallback;
    };
    putText("account_name");
    if (formData.has("slip_provider")) patch.slip_provider = String(formData.get("slip_provider") ?? "manual");
    putText("company_name");
    putText("company_address");
    if (formData.has("tax_id")) patch.tax_id = String(formData.get("tax_id") ?? "").replace(/[^0-9]/g, "") || null;
    putText("tax_branch", "สำนักงานใหญ่");
    // checkbox ที่ไม่ได้ติ๊กจะ "หายไป" จาก FormData เฉย ๆ — ต้องมีช่องซ่อน vat_form
    // เป็นพยานว่าการ์ดภาษีคือการ์ดที่กำลังบันทึก ไม่งั้นแยกไม่ออกจากการ์ดอื่น
    if (formData.has("vat_form")) patch.vat_registered = formData.get("vat_registered") === "on";
    putText("email_from");
    if (formData.has("low_credit_threshold")) {
      patch.low_credit_threshold = Math.max(0, Number(formData.get("low_credit_threshold") ?? 50) || 50);
    }
    // 0 เป็นค่าที่ตั้งใจได้ (= ปิดตรวจอัตโนมัติทั้งระบบ) จึงห้ามใช้ || ที่กลืน 0
    // และต้องกัน NaN ด้วย Number.isFinite ไม่งั้นพิมพ์มั่วแล้วเขียน NaN ลงคอลัมน์ int (บทเรียนเดิม)
    if (formData.has("slip_monthly_cap")) {
      const n = Number(formData.get("slip_monthly_cap"));
      patch.slip_monthly_cap = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 100;
    }
    if (Object.keys(patch).length > 1) {
      const { error } = await svc.from("platform_billing_settings").update(patch).eq("id", true);
      if (error) return { ok: false, error: `บันทึกไม่สำเร็จ: ${error.message}` };
    }

    const supabase = await createClient();
    const savedKeys: string[] = [];
    const slipKey = String(formData.get("slip_api_key") ?? "").trim();
    if (slipKey) {
      const { error: e1 } = await supabase.rpc("store_platform_slip_key", { p_key: slipKey });
      if (e1) return { ok: false, error: `บันทึก slip API key ไม่สำเร็จ: ${e1.message}` };
      savedKeys.push("คีย์ตรวจสลิป");
    }
    const stripeKey = String(formData.get("stripe_secret_key") ?? "").trim();
    if (stripeKey) {
      // กันพิมพ์ผิดช่อง: เอา whsec_ ไปใส่ช่อง secret key แล้วระบบเก็บเงียบ ๆ
      // ผลคือสร้าง checkout ไม่ได้เลยแต่หน้าจอบอกว่าบันทึกสำเร็จ — ต้องดักตั้งแต่ตรงนี้
      if (!stripeKey.startsWith("sk_") && !stripeKey.startsWith("rk_")) {
        return { ok: false, error: "Secret key ต้องขึ้นต้นด้วย sk_ (หรือ rk_) — ค่าที่กรอกมาน่าจะสลับช่องกับ webhook secret" };
      }
      // ⚠️ ยิงทดสอบกับ Stripe จริงก่อนเก็บ (เพิ่ม 28 ส.ค. 2569)
      // รูปแบบถูกแต่คีย์ถูกเพิกถอน/พิมพ์ตก = ระบบบอก "บันทึกสำเร็จ" แล้วลูกค้าจ่ายไม่ผ่านเงียบ ๆ
      // ตรวจตรงนี้ครั้งเดียวตอนเซฟ แล้วบอกให้จบว่าคีย์นี้ "รับเงินจริงได้ไหม"
      let stripeNote = "";
      try {
        const r = await fetch("https://api.stripe.com/v1/account", {
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        if (r.status === 401) {
          return { ok: false, error: "Stripe ปฏิเสธคีย์นี้ (401) — คีย์ผิดหรือถูกเพิกถอนแล้ว คัดลอกใหม่จาก Stripe Dashboard" };
        }
        if (r.ok) {
          const a = (await r.json()) as { charges_enabled?: boolean; livemode?: boolean };
          stripeNote = !stripeKey.startsWith("sk_live") && !stripeKey.startsWith("rk_live")
            ? " (คีย์ทดสอบ — ลูกค้าจริงยังจ่ายไม่ได้)"
            : a.charges_enabled === true
              ? " (คีย์ live พร้อมรับเงินจริงแล้ว)"
              : " (คีย์ live แต่บัญชียังไม่ผ่านยืนยันตัวตน — Stripe ยังไม่ให้รับเงิน)";
        }
      } catch { /* Stripe ล่ม/เน็ตสะดุด — อย่าขวางการเซฟ ด่านรันไทม์ (isLiveStripeKey) ยังกันอยู่ */ }
      const { error: e4 } = await supabase.rpc("store_platform_stripe_key", { p_key: stripeKey });
      if (e4) return { ok: false, error: `บันทึก Stripe secret key ไม่สำเร็จ: ${e4.message}` };
      savedKeys.push(`Stripe secret key${stripeNote}`);
    }
    const stripeWh = String(formData.get("stripe_webhook_secret") ?? "").trim();
    if (stripeWh) {
      if (!stripeWh.startsWith("whsec_")) {
        return { ok: false, error: "Webhook signing secret ต้องขึ้นต้นด้วย whsec_ — ค่าที่กรอกมาน่าจะสลับช่องกับ secret key" };
      }
      const { error: e5 } = await supabase.rpc("store_platform_stripe_webhook_secret", { p_key: stripeWh });
      if (e5) return { ok: false, error: `บันทึก Stripe webhook secret ไม่สำเร็จ: ${e5.message}` };
      savedKeys.push("Stripe webhook secret");
    }
    const resendKey = String(formData.get("resend_api_key") ?? "").trim();
    if (resendKey) {
      const { error: e3 } = await supabase.rpc("store_platform_resend_key", { p_key: resendKey });
      if (e3) return { ok: false, error: `บันทึก Resend API key ไม่สำเร็จ: ${e3.message}` };
      savedKeys.push("Resend API key");
    }
    // อ่านซ้ำจาก Vault หลังบันทึก — ยืนยันด้วยของจริง ไม่ใช่เชื่อว่า RPC ที่เพิ่งเรียกสำเร็จแล้วต้องมีค่า
    const [{ data: sk }, { data: wh }] = await Promise.all([
      svc.rpc("get_platform_stripe_key"),
      svc.rpc("get_platform_stripe_webhook_secret"),
    ]);
    const stripeReady = typeof sk === "string" && sk.trim().length > 0
      && typeof wh === "string" && wh.trim().length > 0;
    revalidatePath("/dashboard/admin/billing");
    return { ok: true, savedKeys, stripeReady };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "ไม่มีสิทธิ์ตั้งค่านี้" : `บันทึกไม่สำเร็จ: ${m.slice(0, 150)}` };
  }
}
