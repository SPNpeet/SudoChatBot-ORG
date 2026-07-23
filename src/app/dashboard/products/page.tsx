import Link from "next/link";
import { getCurrentShop } from "@/lib/shop";
import { Badge, Button, Card, CardContent, EmptyState, Table, Th, Td } from "@/components/ui";
import { FileUp } from "lucide-react";
import { baht, dateTH } from "@/lib/utils";
import { upsertProduct } from "../actions";
import ProductForm from "./product-form";
import ArchiveButton from "./archive-button";
import type { Product } from "@/lib/types/db";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { supabase, shop, role } = await getCurrentShop();
  const canEdit = role === "owner" || role === "admin";
  const { data } = await supabase.from("products")
    .select("*").eq("shop_id", shop.id).neq("status", "archived")
    .order("created_at", { ascending: false }).limit(200);
  const products = (data ?? []) as Product[];

  async function save(formData: FormData) {
    "use server";
    return upsertProduct(String(formData.get("shop_id")), formData);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold">สินค้า/บริการ</h1>
          <p className="text-sm text-neutral-400">รายการที่ใช้ออกเอกสาร — ดึงราคาอัตโนมัติ ตัดสต๊อกเมื่อขาย คิดต้นทุน (COGS) ให้เอง</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Link href="/dashboard/products/import">
              <Button variant="outline"><FileUp className="h-4 w-4" /> นำเข้าไฟล์</Button>
            </Link>
            <ProductForm shopId={shop.id} action={save} />
          </div>
        )}
      </div>
      {!canEdit && (
        <p className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">
          คุณดูรายการได้ แต่แก้ไข/เพิ่มได้เฉพาะเจ้าของ/ผู้ดูแล
        </p>
      )}

      <Card>
        <CardContent className="px-0 pb-0 pt-0">
          {products.length === 0 ? (
            <EmptyState title="ยังไม่มีสินค้า/บริการ" hint="เพิ่มรายการแรกเพื่อออกเอกสารได้เร็วขึ้น — หรือคีย์ชื่อสดตอนออกเอกสารก็ได้" />
          ) : (
            <Table>
              <thead><tr><Th>รายการ</Th><Th>SKU</Th><Th>ราคาขาย</Th><Th>ต้นทุน</Th><Th>สต๊อก</Th><Th>สถานะ</Th><Th>เพิ่มเมื่อ</Th>{canEdit && <Th />}</tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        {Array.isArray(p.images) && Boolean(p.images[0]) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={String(p.images[0])} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                        )}
                        <div>
                          <p className="font-medium">{p.name}</p>
                          {p.category && <p className="text-[11px] text-neutral-400">{p.category}</p>}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-neutral-500">{p.sku ?? "-"}</Td>
                    <Td className="font-semibold">{baht(p.price)}</Td>
                    <Td className="text-neutral-500">{p.cost != null ? baht(p.cost) : "-"}</Td>
                    <Td>
                      <span className={p.track_stock && p.stock <= 3 ? "font-semibold text-red-600" : ""}>{p.track_stock ? p.stock : "ไม่นับ"}</span>
                    </Td>
                    <Td><Badge tone={p.status === "active" ? "green" : "neutral"}>{p.status === "active" ? "ใช้งาน" : "พัก"}</Badge></Td>
                    <Td className="text-neutral-400">{dateTH(p.created_at)}</Td>
                    {canEdit && (
                      <Td>
                        <div className="flex items-center justify-end gap-2">
                          <ProductForm shopId={shop.id} action={save} product={p} />
                          <ArchiveButton productId={p.id} shopId={shop.id} />
                        </div>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
