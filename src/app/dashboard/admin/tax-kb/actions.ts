"use server";
// ============================================================
//  จัดการคลังความรู้ภาษี — เฉพาะผู้ดูแลแพลตฟอร์ม
//
//  ⚠️ ความรู้ผิดหนึ่งบรรทัดกระทบทุกกิจการพร้อมกัน (ผู้ช่วย AI เอาไปตอบทุกร้าน)
//     ทุกทางเข้าจึงต้องผ่าน is_platform_admin() ก่อนแตะ service client เสมอ
//
//  ⚠️ คีย์ AI ต้องไม่ออกจากฝั่ง server — การสร้างเวกเตอร์ทำที่นี่ ไม่ใช่ที่เบราว์เซอร์
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/shop";
import { embedText } from "@/lib/tax-kb";
import { revalidatePath } from "next/cache";

type Result = { ok: true; message: string } | { ok: false; error: string };

const PATH = "/dashboard/admin/tax-kb";

/**
 * ⚠️ ต้องเรียกฟังก์ชันนี้ตรง ๆ ในทุก action ห้ามห่อไว้ใน helper ชื่ออื่น
 *
 * ครั้งแรกผมเขียนเป็น `guard()` ที่คืน boolean แล้ว `npm run check:actions` จับได้ว่า
 * ทั้ง 3 action "ไม่มีด่านสิทธิ์" — ด่านนั้นอ่านชื่อฟังก์ชันแบบสถิต มองทะลุ helper ไม่ได้
 * ซึ่งถูกแล้ว: ถ้ายอมให้ห่อได้ วันหนึ่งจะมีคนเขียน helper ที่ลืมเช็คจริง แล้วไม่มีอะไรจับ
 */
async function assertPlatformAdmin() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.rpc("is_platform_admin");
  if (!data) throw new Error("forbidden: platform admin only");
  return { supabase, user };
}

const DENIED = "เฉพาะผู้ดูแลแพลตฟอร์มเท่านั้น";

export interface TaxKbInput {
  id?: string;
  topic: string;
  content: string;
  citation: string;
  sourceUrl?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  tags?: string;
  keywords?: string;
}

export async function saveTaxKnowledge(input: TaxKbInput): Promise<Result> {
  try { await assertPlatformAdmin(); } catch { return { ok: false, error: DENIED }; }

  const topic = input.topic?.trim();
  const content = input.content?.trim();
  const citation = input.citation?.trim();
  // ⚠️ citation ห้ามว่าง — ความรู้ภาษีที่อ้างอิงไม่ได้ ผู้ใช้เอาไปยืนยันกับสรรพากรไม่ได้
  if (!topic || !content || !citation) return { ok: false, error: "ต้องกรอกหัวข้อ เนื้อหา และที่มาอ้างอิงให้ครบ" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom ?? "")) return { ok: false, error: "วันเริ่มใช้บังคับต้องเป็น YYYY-MM-DD" };
  if (input.effectiveTo && !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveTo)) return { ok: false, error: "วันสิ้นสุดต้องเป็น YYYY-MM-DD" };
  if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) return { ok: false, error: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม" };

  const svc = createServiceClient();
  const row = {
    topic, content, citation,
    source_url: input.sourceUrl?.trim() || null,
    effective_from: input.effectiveFrom,
    effective_to: input.effectiveTo || null,
    tags: (input.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    // คำที่ผู้ใช้พิมพ์จริง — วัดแล้วว่าเป็นตัวชี้ขาดว่าค้นเจอหรือไม่เจอ (ดู migration 103)
    keywords: (input.keywords ?? "").trim(),
    updated_at: new Date().toISOString(),
    // เนื้อหาเปลี่ยน = เวกเตอร์เดิมใช้ไม่ได้แล้ว ต้องล้างทิ้งให้สร้างใหม่
    // (ถ้าปล่อยไว้ ระบบจะค้นเจอด้วยเนื้อหาเก่าแต่แสดงเนื้อหาใหม่ = ผิดแบบที่จับได้ยากมาก)
    embedding: null as string | null,
  };

  const saved = input.id
    ? await svc.from("tax_knowledge").update(row).eq("id", input.id).select("id").single()
    : await svc.from("tax_knowledge").insert(row).select("id").single();
  if (saved.error) return { ok: false, error: saved.error.message.slice(0, 200) };

  // ============================================================
  //  สร้างเวกเตอร์ให้ทันทีในคำสั่งเดียวกัน — ห้ามกลับไปเขียนว่า "อย่าลืมกดสร้างเวกเตอร์"
  //
  //  ⚠️ ของเดิมบันทึกแล้วขึ้นข้อความเตือนให้คนไปกดปุ่มเอง ซึ่งคือการ "ขอร้องให้จำ"
  //  ผลจริง: คลังมี 11 เรื่อง และ **ทั้ง 11 เรื่องไม่มีเวกเตอร์เลยสักเรื่อง**
  //  ค้างแบบนั้นข้ามหลายวันจนเจ้าของเปิดหน้ามาเจอเอง (26 ส.ค. 2569)
  //  กติกาข้อ 3 ของโปรเจกต์: อยากให้เกิดต้องเขียนโค้ดให้เกิด ไม่ใช่เขียนข้อความขอ
  //
  //  ⚠️ เวกเตอร์ล้มเหลวต้องไม่ทำให้การบันทึกล้มตาม
  //  เนื้อหาถูกบันทึกไปแล้วและใช้งานได้จริงด้วยการค้นแบบเทียบข้อความ (migration 103)
  //  การคืน error ตรงนี้จะทำให้แอดมินคิดว่าบันทึกไม่สำเร็จแล้วกดซ้ำจนเกิดแถวซ้ำ
  // ============================================================
  let vectorNote = "";
  try {
    // keywords ต้องอยู่ในข้อความที่เอาไปทำเวกเตอร์ ไม่งั้นเวกเตอร์รู้จักแต่ภาษากฎหมาย
    const vec = await embedText(svc, `${topic}\n${row.keywords}\n${content}`);
    if (vec) {
      const up = await svc.from("tax_knowledge")
        .update({ embedding: JSON.stringify(vec) }).eq("id", saved.data.id);
      vectorNote = up.error ? " (เก็บเวกเตอร์ไม่สำเร็จ กดปุ่มสร้างเวกเตอร์อีกครั้งได้)" : " พร้อมเวกเตอร์";
    } else {
      vectorNote = " — ยังไม่มีเวกเตอร์ (ไม่มีคีย์ Google/OpenAI ที่ใช้ได้) ระหว่างนี้ค้นด้วยการเทียบข้อความ";
    }
  } catch {
    vectorNote = " — สร้างเวกเตอร์ไม่สำเร็จ กดปุ่มสร้างเวกเตอร์อีกครั้งได้";
  }

  revalidatePath(PATH);
  return { ok: true, message: (input.id ? "แก้ไขแล้ว" : "เพิ่มแล้ว") + vectorNote };
}

export async function deleteTaxKnowledge(id: string): Promise<Result> {
  try { await assertPlatformAdmin(); } catch { return { ok: false, error: DENIED }; }
  const svc = createServiceClient();
  const { error } = await svc.from("tax_knowledge").delete().eq("id", id);
  if (error) return { ok: false, error: error.message.slice(0, 200) };
  revalidatePath(PATH);
  return { ok: true, message: "ลบแล้ว" };
}

/** สร้างเวกเตอร์ให้แถวที่ยังไม่มี — ทำทีละชุดเพื่อไม่ให้ request ค้างยาว */
export async function buildTaxEmbeddings(): Promise<Result> {
  try { await assertPlatformAdmin(); } catch { return { ok: false, error: DENIED }; }
  const svc = createServiceClient();

  const { data: pending } = await svc.from("tax_knowledge")
    .select("id,topic,content,keywords").is("embedding", null).limit(20);
  if (!pending?.length) return { ok: true, message: "ทุกแถวมีเวกเตอร์ครบแล้ว" };

  let done = 0;
  for (const r of pending) {
    // ⚠️ ต้องใส่ keywords ลงในข้อความที่เอาไปทำเวกเตอร์ด้วย
    // ไม่งั้นเวกเตอร์จะรู้จักแต่ภาษากฎหมาย แล้วคำเรียกชาวบ้านที่อุตส่าห์ใส่ไว้จะสูญเปล่า
    const vec = await embedText(svc, `${r.topic}\n${r.keywords ?? ""}\n${r.content}`);
    if (!vec) break;   // คีย์ใช้ไม่ได้ = หยุดทั้งชุด ไม่ต้องยิงซ้ำให้เสียเงินฟรี
    const { error } = await svc.from("tax_knowledge")
      .update({ embedding: JSON.stringify(vec) }).eq("id", r.id);
    if (error) break;
    done++;
  }

  revalidatePath(PATH);
  if (done === 0) {
    return { ok: false, error: "สร้างเวกเตอร์ไม่ได้ — ต้องมีคีย์ Google หรือ OpenAI ที่ใช้งานได้ในศูนย์ AI (ระหว่างนี้ระบบยังค้นด้วยการเทียบข้อความให้อยู่)" };
  }
  return { ok: true, message: `สร้างเวกเตอร์แล้ว ${done} แถว${done < pending.length ? " — เหลืออีก กดซ้ำได้" : ""}` };
}
