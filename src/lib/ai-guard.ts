// ============================================================
//  เกราะแพลตฟอร์มก่อนยิง AI — กฎอยู่ที่นี่ที่เดียว
//
//  ⚠️ ทำไมต้องแยกออกมา (ตรวจพบ 4 ส.ค. 2569)
//  3 ทางเข้าที่มีเกราะอยู่แล้ว เขียนเงื่อนไขเหมือนกันว่า `if (pfOk === false) block`
//  (ทางที่ 4 คือหน้านำเข้าสินค้า ซึ่งเดิม *ไม่มีเกราะเลย*)
//  ซึ่ง **fail-open**: ถ้า RPC พัง/ไทม์เอาต์ ค่าที่ได้เป็น null ไม่ใช่ false
//  เงื่อนไขจึงเป็นเท็จ แล้วปล่อยให้ยิง AI ต่อ
//  แปลว่าในจังหวะที่ฐานข้อมูลมีปัญหา "สวิตช์ปิด AI" จะปิดไม่ลง ซึ่งตรงข้ามกับหน้าที่ของมัน
//  — สวิตช์ฉุกเฉินที่ทำงานเฉพาะตอนระบบปกติ ไม่ใช่สวิตช์ฉุกเฉิน
//
//  กติกาโปรเจกต์ (CLAUDE.md ข้อ 8): เพดาน/โควตา/kill switch ต้อง fail-closed เสมอ
//  ตอบไม่ได้ว่า "เปิดอยู่ไหม" = ต้องถือว่าปิด ค่าเสียหายของการหยุดชั่วคราว
//  น้อยกว่าค่าเสียหายของการเผา token ไม่จำกัดตอนที่ตั้งใจจะปิดมันแล้ว
//
//  ⚠️ ยังมีทางออก AI อีกทางที่ *ไม่* ผ่านไฟล์นี้โดยเจตนา: /api/admin/test-ai
//  เพราะผู้ดูแลต้องทดสอบคีย์ได้ขณะ AI ปิดอยู่ ไม่งั้นเปิดกลับมาไม่ได้ (คำขอสั้นมาก)
//  อย่าเขียนว่า "ทุกทางเข้า" ในเอกสาร — ไม่จริง และทำให้รอบหน้าเริ่มจากสมมติฐานผิด
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ⚠️ สาขา "ตรวจไม่ได้" ห้ามต่อท้ายด้วย altText
 * altText เขียนไว้สำหรับกรณี "ผู้ดูแลปิด AI เอง" ซึ่งระบบส่วนอื่นยังปกติดี
 * แต่สาขานี้เกิดตอนคุยกับฐานข้อมูลไม่ได้ — ทางออกที่ altText สัญญา (คีย์เอง /
 * นำเข้า Excel) ก็ต้องใช้ฐานข้อมูลเหมือนกัน จึงใช้ไม่ได้เช่นกัน
 * สัญญาสิ่งที่ทำไม่ได้ = ผู้ใช้เสียเวลาแปลงไฟล์แล้วมาเจอ error ซ้ำ
 */
const UNAVAILABLE_MSG = "ระบบขัดข้องชั่วคราว ยังตรวจสถานะไม่ได้ — รอสักครู่แล้วลองใหม่อีกครั้ง";

/**
 * ⚠️ ต้องเป็น union ไม่ใช่ `{ ok: boolean; error?: string }`
 * แบบเดิม TypeScript ยอมให้ `return { ok: false }` ที่ลืมใส่ error ผ่าน compile
 * แล้วผู้ใช้จะเจอกล่อง error ว่างเปล่า ซึ่งชนกติกา CLAUDE.md ข้อ 3 (ห้ามเจอจอเปล่า)
 * union บังคับให้ทุกทางที่ ok:false ต้องมีข้อความเสมอ และตัด `!` ที่ call site ออกได้
 */
export type AiGuardResult =
  | { ok: true }
  | { ok: false; error: string; quotaExceeded?: boolean };

/**
 * ตรวจเกราะแพลตฟอร์ม (kill switch + เพดานค่า AI ต่อวัน) ก่อนยิง AI ทุกครั้ง
 * @param altText สิ่งที่ผู้ใช้ยังทำได้ระหว่างที่ AI ปิด — ต่างกันตามหน้า
 */
export async function platformAiGuard(svc: SupabaseClient, altText: string): Promise<AiGuardResult> {
  try {
    const { data, error } = await svc.rpc("platform_ai_ok");
    if (error) {
      // ตรวจไม่ได้ = ถือว่าปิด (fail-closed) แต่ต้องแยกข้อความจาก "ปิดโดยตั้งใจ"
      // ไม่งั้นเวลาไล่ปัญหาจะแยกไม่ออกว่าผู้ดูแลปิดเอง หรือระบบตรวจพัง
      console.error("platformAiGuard rpc error", error.message);
      return { ok: false, error: UNAVAILABLE_MSG };
    }
    if (data === false) {
      return { ok: false, error: `ระบบ AI ปิดปรับปรุงชั่วคราวโดยผู้ดูแลแพลตฟอร์ม — ${altText}` };
    }
    // data ต้องเป็น true เท่านั้นถึงผ่าน — ค่าอื่น (null/undefined) ถือว่าตอบไม่ได้
    if (data !== true) {
      return { ok: false, error: UNAVAILABLE_MSG };
    }
    return { ok: true };
  } catch (e) {
    console.error("platformAiGuard threw", (e as Error).message);
    return { ok: false, error: UNAVAILABLE_MSG };
  }
}

/**
 * กินโควตา AI ของผู้ใช้ (ต่อวัน/ต่อเดือน) — ต้องเรียกหลัง platformAiGuard ผ่านแล้วเท่านั้น
 *
 * ⚠️ บทเรียน 4 ส.ค. 2569 (จากการรีวิวโค้ดรอบนี้เอง)
 * ผมเขียนหัวไฟล์นี้อธิบายว่า `if (x === false)` คือ fail-open แล้วก็ยังคัดลอกบล็อก
 * `const { data: quota } = await svc.rpc("consume_ai_quota", ...)` ซึ่งมีบั๊กเดียวกันเป๊ะ
 * เข้าไปอีก 3 ที่ — ไม่ได้รับค่า error มาดูเลย RPC พัง -> quota เป็น null ->
 * `q && q.allowed === false` เป็นเท็จ -> **ยิง AI ต่อ** ซึ่งคือสิ่งที่ไฟล์นี้ตั้งใจจะกำจัด
 *
 * การแก้ที่ถูกคือย้ายกฎมาไว้ที่เดียวแบบนี้ ไม่ใช่แก้ทีละไฟล์แล้วหวังว่าคนถัดไปจะจำได้
 *
 * ⚠️ ลำดับสำคัญ: RPC นี้ "ตัดโควตาทันที" ที่เรียก ห้ามมีด่านปฏิเสธอื่นต่อท้าย
 * ไม่งั้นผู้ใช้โดนตัดโควตาแล้วแต่ไม่ได้งาน — ด่านเฉพาะทางต้องเช็คให้จบ *ก่อน* เรียกตัวนี้
 */
export async function consumeAiQuota(
  svc: SupabaseClient, shopId: string, altText: string,
): Promise<AiGuardResult> {
  try {
    const { data, error } = await svc.rpc("consume_ai_quota", { p_shop_id: shopId });
    if (error) {
      console.error("consumeAiQuota rpc error", error.message);
      return { ok: false, error: UNAVAILABLE_MSG };
    }
    const q = data as { allowed?: boolean; reason?: string } | null;
    // ตอบไม่ได้ว่าอนุญาตไหม = ไม่อนุญาต (fail-closed) ไม่ใช่ปล่อยผ่านเหมือนเดิม
    if (!q || q.allowed !== true) {
      if (q && q.allowed === false) {
        // ⚠️ reason มี 3 ค่า ไม่ใช่ 2 — เดิมใช้ ternary สองทาง ทำให้เคส no_shop
        // (owner_id ว่าง / กิจการถูกลบ / shop_id ผิด) ไปบอกลูกค้าที่จ่ายเงินแล้วว่า
        // "อัปเกรดแพ็กเกจ" ซึ่งอัปเกรดไปก็ไม่หาย = ชวนให้จ่ายเงินโดยแก้ปัญหาไม่ได้
        if (q.reason === "no_shop") {
          return { ok: false, error: `ไม่พบกิจการที่ใช้งานอยู่สำหรับบัญชีนี้ — เปิดหน้าใหม่อีกครั้ง หรือเลือกกิจการจากเมนูมุมซ้ายบน · ${altText}` };
        }
        return {
          ok: false, quotaExceeded: true,
          error: q.reason === "daily"
            ? `โควตางาน AI วันนี้เต็มแล้ว — พรุ่งนี้ใช้ต่อได้ หรืออัปเกรดแพ็กเกจที่หน้า แพ็กเกจ/เครดิต · ${altText}`
            : `โควตางาน AI ของแพ็กเกจเดือนนี้เต็มแล้ว — สมัคร/อัปเกรดแพ็กเกจที่หน้า แพ็กเกจ/เครดิต เพื่อใช้ต่อทันที · ${altText}`,
        };
      }
      return { ok: false, error: UNAVAILABLE_MSG };
    }
    return { ok: true };
  } catch (e) {
    console.error("consumeAiQuota threw", (e as Error).message);
    return { ok: false, error: UNAVAILABLE_MSG };
  }
}

/**
 * กิจการต้องสถานะ active เท่านั้นถึงใช้ AI ได้ — ตรวจพบ 4 ส.ค. 2569 ว่า
 * assertMember ตรวจแค่ "เป็นสมาชิกไหม" ไม่ได้ดู shops.status
 * กิจการที่ถูกระงับ (เช่น ค้างจ่าย) จึงยังเรียก AI ผ่านทางอ่านไฟล์ได้ไม่จำกัด
 * ตรวจไม่ได้ = ไม่ให้ใช้ (fail-closed) เหมือนด่านอื่นทุกตัวในไฟล์นี้
 */
export async function assertShopActive(svc: SupabaseClient, shopId: string): Promise<AiGuardResult> {
  try {
    const { data, error } = await svc.from("shops").select("status").eq("id", shopId).maybeSingle();
    if (error || !data) return { ok: false, error: UNAVAILABLE_MSG };
    if (data.status !== "active") {
      return { ok: false, error: "บัญชีธุรกิจถูกระงับการใช้งาน — ติดต่อผู้ดูแลระบบ" };
    }
    return { ok: true };
  } catch (e) {
    console.error("assertShopActive threw", (e as Error).message);
    return { ok: false, error: UNAVAILABLE_MSG };
  }
}

/** เพดาน OCR ต่อเดือนตามแพ็ก — กฎอยู่ที่นี่ที่เดียว
 *  ทำไมต้องมี (5 ส.ค. 2569): OCR แพงกว่าคำสั่งแชท ~8 เท่า (0.72฿ vs 0.09฿)
 *  ถ้าคุมด้วยโควตา AI รวมอย่างเดียว แพ็กธุรกิจ 249฿ ที่ใช้ 400 คำสั่งเป็น OCR ล้วน
 *  ต้นทุนจะเกินราคาขาย — ด่านนี้ทำให้การขาดทุนเป็นไปไม่ได้เชิงคณิตศาสตร์ ไม่ใช่แค่ "ไม่น่าเกิด" */
const OCR_MONTHLY_CAP: Record<string, number> = {
  free: 5, starter: 30, professional: 100, executive: 250, agency: 750,
};

/** ด่านนี้ "ปฏิเสธเฉย ๆ" ไม่ตัดโควตา — ต้องเรียกก่อน consumeAiQuota เสมอ (กติกาลำดับด่าน) */
export async function ocrMonthlyGuard(svc: SupabaseClient, shopId: string): Promise<AiGuardResult> {
  try {
    const { data: shop, error: shopErr } = await svc.from("shops").select("plan").eq("id", shopId).maybeSingle();
    if (shopErr || !shop) return { ok: false, error: UNAVAILABLE_MSG };
    const cap = OCR_MONTHLY_CAP[String(shop.plan)] ?? OCR_MONTHLY_CAP.free;
    // ขอบเขต "เดือน" ตามเวลาไทย ให้ตรงกับโควตา AI หลัก (ไม่ใช่ rolling window)
    const bkk = new Date(Date.now() + 7 * 3600_000);
    const monthStart = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), 1) - 7 * 3600_000).toISOString();
    const { count, error } = await svc.from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId).eq("purpose", "ocr").gte("created_at", monthStart);
    if (error || !Number.isFinite(count as number)) return { ok: false, error: UNAVAILABLE_MSG };
    if ((count as number) >= cap) {
      return {
        ok: false, quotaExceeded: true,
        error: `โควตา AI อ่านไฟล์เดือนนี้เต็มแล้ว (${cap} ไฟล์/เดือนตามแพ็ก) — คีย์ข้อมูลเองได้ตามปกติ หรืออัปเกรดแพ็กเกจที่หน้า แพ็กเกจ/เครดิต`,
      };
    }
    return { ok: true };
  } catch (e) {
    console.error("ocrMonthlyGuard threw", (e as Error).message);
    return { ok: false, error: UNAVAILABLE_MSG };
  }
}
