import Link from "next/link";
import { getCurrentShop } from "@/lib/shop";
import { Badge, Button, Card, CardContent, EmptyState, Table, Th, Td, PageHeader } from "@/components/ui";
import { FileUp, Package } from "lucide-react";
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
  // เกณฑ์เดียวกับที่ตารางใช้ทำตัวแดง (≤3) — ตัวเลขบนหัวหน้ากับในตารางต้องหมายถึงของอย่างเดียวกัน
  const lowStock = products.filter((p) => p.track_stock && p.stock <= 3).length;

  async function save(formData: FormData) {
    "use server";
    return upsertProduct(String(formData.get("shop_id")), formData);
  }

  return (
    <div className="space-y-5">
      {/* คำโปรยบอกจำนวนกับของที่ใกล้หมด — สองอย่างที่คนเปิดหน้านี้มาดู ไม่ใช่ทวนชื่อหน้า */}
      <PageHeader
        title="สินค้า / บริการ"
        lead={products.length === 0 ? "ยังไม่มีรายการ — ใส่ของที่ขายประจำไว้ครั้งเดียว ใช้ได้ตลอด" : <>
          {products.length} รายการ
          {lowStock > 0 && <> · <b className="text-amber-600">{lowStock} รายการสต๊อกใกล้หมด</b></>}
        </>}
        help="ใส่ของที่ขายประจำไว้ที่นี่ — ตอนออกเอกสารแค่เลือกชื่อ ราคาขึ้นเอง ไม่ต้องพิมพ์ซ้ำทุกครั้ง · ถ้าใส่ต้นทุนไว้ด้วย ระบบจะคำนวณกำไรและตัดสต๊อกให้อัตโนมัติเมื่อขาย"
        action={canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/products/import">
              <Button variant="outline"><FileUp className="h-4 w-4" /> นำเข้าไฟล์</Button>
            </Link>
            <ProductForm shopId={shop.id} action={save} />
          </div>
        )}
      />
      {!canEdit && (
        <p className="rounded-xl bg-neutral-50 px-4 py-2.5 text-sm text-neutral-500">
          คุณดูรายการได้ แต่แก้ไข/เพิ่มได้เฉพาะเจ้าของ/ผู้ดูแล
        </p>
      )}

      <Card>
        <CardContent className="px-0 pb-0 pt-0">
          {products.length === 0 ? (
            <EmptyState icon={Package} title="ยังไม่มีสินค้า/บริการ"
              hint="ไม่บังคับต้องมี — แต่ถ้าใส่ไว้ ออกเอกสารครั้งต่อไปเลือกได้เลยไม่ต้องพิมพ์ราคาซ้ำ"
              steps={[
                "ใส่ชื่อรายการกับราคาขาย เช่น \"ค่าออกแบบโลโก้ 5,000\"",
                "ใส่ต้นทุนด้วยถ้าอยากรู้กำไรต่อชิ้น (ข้ามได้)",
                "ของเยอะ? นำเข้าจากไฟล์ Excel ทีเดียวทั้งหมด",
              ]} />
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
                          {p.category && <p className="text-xs text-neutral-400">{p.category}</p>}
                        </div>
                      </div>
                    </Td>
                    <Td label="SKU" className="text-neutral-500">{p.sku ?? "-"}</Td>
                    <Td label="ราคาขาย" className="font-semibold">{baht(p.price)}</Td>
                    <Td label="ต้นทุน" className="text-neutral-500">{p.cost != null ? baht(p.cost) : "-"}</Td>
                    <Td label="สต๊อก">
                      <span className={p.track_stock && p.stock <= 3 ? "font-semibold text-red-600" : ""}>{p.track_stock ? p.stock : "ไม่นับ"}</span>
                    </Td>
                    <Td label="สถานะ"><Badge tone={p.status === "active" ? "green" : "neutral"}>{p.status === "active" ? "ใช้งาน" : "พัก"}</Badge></Td>
                    <Td label="เพิ่มเมื่อ" className="text-neutral-400">{dateTH(p.created_at)}</Td>
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
