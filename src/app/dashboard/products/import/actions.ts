"use server";
// ============================================================
//  Bulk import สินค้า (จากไฟล์ Excel/CSV/PDF/รูป หลังผู้ใช้ตรวจพรีวิว)
//  คืน { ok } เสมอ — ไม่ throw ให้หลุดถึง client
// ============================================================
import { createServiceClient } from "@/lib/supabase/server";
import { assertMember } from "@/lib/shop";
import { revalidatePath } from "next/cache";

export interface BulkRow {
  name: string; sku?: string; category?: string;
  price: number; stock?: number; description?: string;
  variants?: { name: string; sku?: string; price: number | null; stock: number }[];
}
export interface BulkOptions { skipDuplicates: boolean; asDraft: boolean }
export type BulkResult =
  | { ok: true; imported: number; skipped: number }
  | { ok: false; error: string };

const MAX_ROWS = 300;

export async function bulkImportProducts(shopId: string, rows: BulkRow[], opts: BulkOptions): Promise<BulkResult> {
  try {
    await assertMember(shopId, ["owner", "admin"]);
    const clean = (rows ?? [])
      .filter((r) => r && typeof r.name === "string" && r.name.trim())
      .slice(0, MAX_ROWS)
      .map((r) => ({
        name: r.name.trim().slice(0, 200),
        sku: r.sku?.trim().slice(0, 60) || null,
        category: r.category?.trim().slice(0, 100) || null,
        description: r.description?.trim().slice(0, 2000) || null,
        price: Math.max(0, Number(r.price) || 0),
        stock: Math.max(0, parseInt(String(r.stock ?? 0), 10) || 0),
        variants: (r.variants ?? []).filter((v) => v?.name?.trim()).slice(0, 50),
      }));
    if (!clean.length) return { ok: false, error: "ไม่มีรายการที่นำเข้าได้ (ทุกแถวต้องมีชื่อสินค้า)" };

    const svc = createServiceClient();
    let skipped = 0;
    let toImport = clean;
    if (opts.skipDuplicates) {
      const { data: existing } = await svc.from("products")
        .select("name").eq("shop_id", shopId).neq("status", "archived").limit(1000);
      const names = new Set((existing ?? []).map((p) => (p.name as string).trim().toLowerCase()));
      toImport = clean.filter((r) => !names.has(r.name.toLowerCase()));
      skipped = clean.length - toImport.length;
    }
    if (!toImport.length) return { ok: true, imported: 0, skipped };

    const status = opts.asDraft ? "draft" : "active";
    let imported = 0;
    // insert ทีละชุด 50 — แถวที่มี variants ต้องได้ product id กลับมา
    for (let i = 0; i < toImport.length; i += 50) {
      const chunk = toImport.slice(i, i + 50);
      const { data: inserted, error } = await svc.from("products").insert(
        chunk.map((r) => ({
          shop_id: shopId, name: r.name, sku: r.sku, category: r.category,
          description: r.description, price: r.price, stock: r.stock, status,
        })),
      ).select("id,name");
      if (error) return { ok: false, error: `นำเข้าไม่สำเร็จที่แถว ${i + 1}: ${error.message}` };
      imported += inserted?.length ?? 0;

      // variants: จับคู่ product id ตามลำดับแถวที่ insert (PostgREST คืนตามลำดับ insert)
      const variantRows: Record<string, unknown>[] = [];
      chunk.forEach((r, j) => {
        const pid = inserted?.[j]?.id;
        if (!pid || !r.variants.length) return;
        for (const v of r.variants) {
          variantRows.push({
            product_id: pid, shop_id: shopId, name: v.name.trim().slice(0, 100),
            sku: v.sku?.trim().slice(0, 60) || null,
            price: v.price === null || v.price === undefined || Number.isNaN(Number(v.price)) ? null : Math.max(0, Number(v.price)),
            stock: Math.max(0, parseInt(String(v.stock ?? 0), 10) || 0),
            status: "active",
          });
        }
      });
      if (variantRows.length) {
        const { error: vErr } = await svc.from("product_variants").insert(variantRows);
        if (vErr) return { ok: false, error: `สินค้าเข้าแล้ว ${imported} รายการ แต่บันทึกตัวเลือกย่อยไม่สำเร็จ: ${vErr.message}` };
      }
    }

    await svc.from("audit_logs").insert({
      shop_id: shopId, actor_type: "user", action: "products_bulk_import",
      resource_type: "products", details: { imported, skipped, as_draft: opts.asDraft },
    });
    revalidatePath("/dashboard/products");
    return { ok: true, imported, skipped };
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes("forbidden") ? "เฉพาะเจ้าของ/ผู้ดูแลร้านนำเข้าสินค้าได้" : `นำเข้าไม่สำเร็จ: ${m.slice(0, 200)}` };
  }
}
