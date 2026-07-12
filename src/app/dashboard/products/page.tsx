import { getCurrentShop } from "@/lib/shop";
import { Badge, Card, CardContent, EmptyState, Table, Th, Td } from "@/components/ui";
import { baht, dateTH } from "@/lib/utils";
import { upsertProduct, archiveProduct } from "../actions";
import ProductForm from "./product-form";
import type { Product } from "@/lib/types/db";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { supabase, shop } = await getCurrentShop();
  const { data } = await supabase.from("products")
    .select("*").eq("shop_id", shop.id).neq("status", "archived")
    .order("created_at", { ascending: false }).limit(200);
  const products = (data ?? []) as Product[];

  async function save(formData: FormData) {
    "use server";
    await upsertProduct(String(formData.get("shop_id")), formData);
  }
  async function archive(formData: FormData) {
    "use server";
    await archiveProduct(String(formData.get("product_id")), String(formData.get("shop_id")));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold">สินค้า</h1>
          <p className="text-sm text-neutral-400">แคตตาล็อกที่บอทใช้ตอบราคาและเช็กสต๊อกแบบเรียลไทม์</p>
        </div>
        <ProductForm shopId={shop.id} action={save} />
      </div>

      <Card>
        <CardContent className="px-0 pb-0 pt-0">
          {products.length === 0 ? (
            <EmptyState title="ยังไม่มีสินค้า" hint="เพิ่มสินค้าแรกเพื่อให้บอทเริ่มขายได้" />
          ) : (
            <Table>
              <thead><tr><Th>สินค้า</Th><Th>SKU</Th><Th>ราคา</Th><Th>สต๊อก</Th><Th>สถานะ</Th><Th>เพิ่มเมื่อ</Th><Th /></tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <p className="font-medium">{p.name}</p>
                      {p.category && <p className="text-[11px] text-neutral-400">{p.category}</p>}
                    </Td>
                    <Td className="text-neutral-500">{p.sku ?? "-"}</Td>
                    <Td className="font-semibold">{baht(p.price)}</Td>
                    <Td>
                      <span className={p.stock <= 3 ? "font-semibold text-red-600" : ""}>{p.track_stock ? p.stock : "∞"}</span>
                    </Td>
                    <Td><Badge tone={p.status === "active" ? "green" : "neutral"}>{p.status === "active" ? "ขายอยู่" : "ร่าง"}</Badge></Td>
                    <Td className="text-neutral-400">{dateTH(p.created_at)}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        <ProductForm shopId={shop.id} action={save} product={p} />
                        <form action={archive}>
                          <input type="hidden" name="product_id" value={p.id} />
                          <input type="hidden" name="shop_id" value={shop.id} />
                          <button className="text-xs text-neutral-400 hover:text-red-600">เก็บเข้าคลัง</button>
                        </form>
                      </div>
                    </Td>
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
