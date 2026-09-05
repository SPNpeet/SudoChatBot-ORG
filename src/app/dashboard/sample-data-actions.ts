"use server";
import { friendlyError as friendly } from "@/lib/friendly-error";
// ============================================================
//  ข้อมูลตัวอย่าง 1 คลิก — แก้ "กำแพงศูนย์" ตอนเปิดแดชบอร์ดครั้งแรก
//  ผู้ใช้ใหม่เห็นระบบทำงานเต็มรูป (เอกสาร → สมุดรายวัน → ยอดค้าง → รายงาน)
//  ภายใน 5 วินาที โดยไม่ต้องกรอกอะไรเลย แล้วกดล้างทิ้งได้สะอาดหมดจด
//  ทุกแถวติดธง is_sample — ล้างทีเดียวจบ ไม่ปนกับข้อมูลจริง
// ============================================================
import { assertMember } from "@/lib/shop";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { saveDoc } from "./finance/actions";
import { bkkToday } from "@/lib/finance-server";

export type SampleResult = { ok: true; docs: number } | { ok: false; error: string };

function daysAgo(n: number): string {
  return new Date(Date.now() + 7 * 3600_000 - n * 864e5).toISOString().slice(0, 10);
}

export async function seedSampleData(shopId: string): Promise<SampleResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();

    const { count } = await svc.from("fin_docs").select("id", { count: "exact", head: true })
      .eq("shop_id", shopId).eq("is_sample", true);
    if ((count ?? 0) > 0) return { ok: false, error: "มีข้อมูลตัวอย่างอยู่แล้ว — ล้างก่อนถ้าต้องการสร้างใหม่" };

    // คู่ค้าตัวอย่าง
    const { data: people } = await svc.from("contacts").insert([
      { shop_id: shopId, name: "บริษัท ตัวอย่างการค้า จำกัด (ตัวอย่าง)", kind: "customer", tax_id: "0105512345678", phone: "021234567", is_sample: true },
      { shop_id: shopId, name: "ร้านวัสดุรุ่งเรือง (ตัวอย่าง)", kind: "vendor", phone: "0891234567", is_sample: true },
    ]).select("id,kind");
    const customerId = people?.find((p) => p.kind === "customer")?.id ?? null;
    const vendorId = people?.find((p) => p.kind === "vendor")?.id ?? null;

    await svc.from("products").insert({
      shop_id: shopId, name: "บริการออกแบบเว็บไซต์ (ตัวอย่าง)", price: 25000, cost: 8000,
      track_stock: false, status: "active", is_sample: true,
    });

    const made: string[] = [];

    // 1) ใบแจ้งหนี้ค้างรับ + เกินกำหนด -> ให้เห็นการ์ด "เกินกำหนดชำระ" ทำงานจริง
    const inv = await saveDoc(shopId, {
      doc_type: "invoice", contact_id: customerId,
      items: [{ name: "บริการออกแบบเว็บไซต์", qty: 1, unit_price: 25000 }],
      vat_mode: "exclusive", wht_rate: 3,
      issue_date: daysAgo(40), due_date: daysAgo(10),
      notes: "ข้อมูลตัวอย่าง — ลบได้", status: "awaiting", source: "import",
    });
    if (inv.ok) made.push(inv.docId);

    // 2) ใบเสร็จขายสด -> เงินเข้าเดือนนี้ + กราฟกระแสเงินสดมีข้อมูล
    const rc = await saveDoc(shopId, {
      doc_type: "receipt", contact_id: customerId,
      items: [{ name: "ค่าดูแลระบบรายเดือน", qty: 1, unit_price: 4500 }],
      vat_mode: "exclusive", issue_date: daysAgo(5), paid_now: true, pay_method: "promptpay",
      notes: "ข้อมูลตัวอย่าง — ลบได้", status: "awaiting", source: "import",
    });
    if (rc.ok) made.push(rc.docId);

    // 3) ค่าใช้จ่ายจ่ายแล้ว -> เงินออก + ภาษีซื้อในรายงาน ภ.พ.30
    const exp = await saveDoc(shopId, {
      doc_type: "expense", contact_id: vendorId,
      items: [{ name: "ค่าเช่าออฟฟิศ", qty: 1, unit_price: 12000 }],
      vat_mode: "exclusive", wht_rate: 5, paid_now: true,
      issue_date: daysAgo(8), notes: "ข้อมูลตัวอย่าง — ลบได้", status: "awaiting", source: "import",
    });
    if (exp.ok) made.push(exp.docId);

    // 4) บิลค้างจ่าย -> เจ้าหนี้ค้างจ่ายไม่เป็น 0
    const exp2 = await saveDoc(shopId, {
      doc_type: "expense", contact_id: vendorId,
      items: [{ name: "ซื้อวัสดุสำนักงาน", qty: 1, unit_price: 3200 }],
      vat_mode: "exclusive", paid_now: false,
      issue_date: daysAgo(3), due_date: bkkToday(), notes: "ข้อมูลตัวอย่าง — ลบได้", status: "awaiting", source: "import",
    });
    if (exp2.ok) made.push(exp2.docId);

    if (made.length) await svc.from("fin_docs").update({ is_sample: true }).in("id", made);

    revalidatePath("/dashboard", "layout");
    return { ok: true, docs: made.length };
  } catch (e) {
    return { ok: false, error: friendly(e, "ทำรายการไม่สำเร็จ ลองอีกครั้ง").slice(0, 200) };
  }
}

/** ล้างข้อมูลตัวอย่างทั้งหมด รวมรายการในสมุดรายวันที่เกิดจากมัน */
export async function clearSampleData(shopId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const svc = createServiceClient();

    const { data: docs } = await svc.from("fin_docs").select("id").eq("shop_id", shopId).eq("is_sample", true);
    const ids = (docs ?? []).map((d) => d.id as string);

    if (ids.length) {
      // ลบรายการบัญชีที่เกิดจากเอกสารตัวอย่างก่อน แล้วค่อยลบตัวเอกสาร
      const { data: entries } = await svc.from("journal_entries").select("id")
        .eq("shop_id", shopId).in("source_id", ids);
      const entryIds = (entries ?? []).map((e) => e.id as string);
      if (entryIds.length) {
        await svc.from("journal_lines").delete().in("entry_id", entryIds);
        await svc.from("journal_entries").delete().in("id", entryIds);
      }
      await svc.from("fin_payments").delete().in("doc_id", ids);
      await svc.from("fin_doc_items").delete().in("doc_id", ids);
      await svc.from("fin_doc_files").delete().in("doc_id", ids);
      await svc.from("fin_docs").delete().in("id", ids);
    }
    await svc.from("products").delete().eq("shop_id", shopId).eq("is_sample", true);
    await svc.from("contacts").delete().eq("shop_id", shopId).eq("is_sample", true);

    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendly(e, "ทำรายการไม่สำเร็จ ลองอีกครั้ง").slice(0, 200) };
  }
}
