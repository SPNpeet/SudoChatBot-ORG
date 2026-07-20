import Link from "next/link";
import { getCurrentShop } from "@/lib/shop";
import { Badge, Button, Card, CardContent, EmptyState, Table, Th, Td } from "@/components/ui";
import { FileUp } from "lucide-react";
import { baht, dateTH } from "@/lib/utils";
import { upsertProduct } from "../actions";
import ProductForm from "./product-form";
import ArchiveButton from "./archive-button";
import type { Product, ProductVariant } from "@/lib/types/db";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { supabase, shop, role } = await getCurrentShop();
  const canEdit = role === "owner" || role === "admin";
  const { data } = await supabase.from("products")
    .select("*").eq("shop_id", shop.id).neq("status", "archived")
    .order("created_at", { ascending: false }).limit(200);
  const products = (data ?? []) as Product[];
  const { data: variantRows } = await supabase.from("product_variants")
    .select("id,product_id,name,sku,price,stock,status")
    .in("product_id", products.map((p) => p.id)).neq("status", "archived").order("created_at");
  const variantsByProduct = new Map<string, ProductVariant[]>();
  for (const v of (variantRows ?? []) as ProductVariant[]) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  async function save(formData: FormData) {
    "use server";
    return upsertProduct(String(formData.get("shop_id")), formData);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold">สินค้า</h1>
          <p className="text-sm text-neutral-400">แคตตาล็อกที่บอทใช้ตอบราคาและเช็กสต๊อกแบบเรียลไทม์</p>
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
          คุณดูรายการสินค้าได้ แต่แก้ไข/เพิ่มได้เฉพาะเจ้าของ/ผู้ดูแลร้าน
        </p>
      )}

      <Card>
        <CardContent className="px-0 pb-0 pt-0">
          {products.length === 0 ? (
            <EmptyState title="ยังไม่มีสินค้า" hint="เพิ่มสินค้าแรกเพื่อให้บอทเริ่มขายได้" />
          ) : (
            <Table>
              <thead><tr><Th>สินค้า</Th><Th>SKU</Th><Th>ราคา</Th><Th>สต๊อก</Th><Th>สถานะ</Th><Th>เพิ่มเมื่อ</Th>{canEdit && <Th />}</tr></thead>
              <tbody>
                {products.map((p) => {
                  const pv = variantsByProduct.get(p.id) ?? [];
                  return (
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
                            {pv.length > 0 && (
                              <p className="mt-0.5 max-w-56 truncate text-[11px] text-sky-600">
                                {pv.length} ตัวเลือก: {pv.map((v) => v.name).join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td className="text-neutral-500">{p.sku ?? "-"}</Td>
                      <Td className="font-semibold">
                        {baht(p.price)}
                        {p.compare_at_price != null && p.compare_at_price > p.price && (
                          <span className="ml-1.5 text-[11px] font-normal text-neutral-400 line-through">{baht(p.compare_at_price)}</span>
                        )}
                      </Td>
                      <Td>
                        {pv.length > 0
                          ? <span>{pv.reduce((s, v) => s + v.stock, 0)} <span className="text-[10px] text-neutral-400">(รวมตัวเลือก)</span></span>
                          : <span className={p.stock <= 3 ? "font-semibold text-red-600" : ""}>{p.track_stock ? p.stock : "∞"}</span>}
                      </Td>
                      <Td><Badge tone={p.status === "active" ? "green" : "neutral"}>{p.status === "active" ? "ขายอยู่" : "ร่าง"}</Badge></Td>
                      <Td className="text-neutral-400">{dateTH(p.created_at)}</Td>
                      {canEdit && (
                        <Td>
                          <div className="flex items-center justify-end gap-2">
                            <ProductForm shopId={shop.id} action={save} product={p} variants={pv} />
                            <ArchiveButton productId={p.id} shopId={shop.id} />
                          </div>
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
