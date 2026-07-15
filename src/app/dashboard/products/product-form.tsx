"use client";
import { useState, useTransition } from "react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import type { Product, ProductVariant } from "@/lib/types/db";
import { Plus, Pencil, X } from "lucide-react";

interface VariantRow { id?: string; name: string; sku: string; price: string; stock: string }

export default function ProductForm({
  shopId, action, product, variants,
}: { shopId: string; action: (fd: FormData) => Promise<void>; product?: Product; variants?: ProductVariant[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<VariantRow[]>(
    (variants ?? []).map((v) => ({ id: v.id, name: v.name, sku: v.sku ?? "", price: v.price === null ? "" : String(v.price), stock: String(v.stock) })),
  );

  function setRow(i: number, patch: Partial<VariantRow>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function submit(fd: FormData) {
    const clean = rows.filter((r) => r.name.trim()).map((r) => ({
      id: r.id, name: r.name.trim(), sku: r.sku.trim() || undefined,
      price: r.price.trim() === "" ? null : Number(r.price),
      stock: parseInt(r.stock || "0", 10) || 0,
    }));
    fd.set("variants_json", JSON.stringify(clean));
    start(async () => {
      await action(fd);
      setOpen(false);
    });
  }

  return (
    <>
      {product ? (
        <button onClick={() => setOpen(true)} className="text-neutral-400 hover:text-neutral-800">
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> เพิ่มสินค้า</Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <form
            action={submit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="font-bold">{product ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h2>
            <input type="hidden" name="shop_id" value={shopId} />
            {product && <input type="hidden" name="id" value={product.id} />}
            <div>
              <Label>ชื่อสินค้า *</Label>
              <Input name="name" required defaultValue={product?.name} placeholder="เช่น เซรั่มวิตซี 30ml" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>SKU</Label><Input name="sku" defaultValue={product?.sku ?? ""} placeholder="VC-30" /></div>
              <div><Label>หมวดหมู่</Label><Input name="category" defaultValue={product?.category ?? ""} placeholder="สกินแคร์" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>ราคา (บาท) *</Label><Input name="price" type="number" step="0.01" min="0" required defaultValue={product?.price} /></div>
              <div><Label>สต๊อก</Label><Input name="stock" type="number" min="0" defaultValue={product?.stock ?? 0} /></div>
              <div>
                <Label>สถานะ</Label>
                <Select name="status" defaultValue={product?.status ?? "active"}>
                  <option value="active">ขายอยู่</option>
                  <option value="draft">ร่าง (บอทไม่เห็น)</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>รายละเอียด (บอทใช้ตอบลูกค้า — ใส่จุดเด่น วิธีใช้ ขนาด)</Label>
              <Textarea name="description" defaultValue={product?.description ?? ""} placeholder="อธิบายสินค้าให้ละเอียด บอทจะใช้ข้อมูลนี้ขายของ" />
            </div>

            {/* ===== ตัวเลือกย่อย (variants) ===== */}
            <div>
              <div className="flex items-center justify-between">
                <Label>ตัวเลือกย่อย เช่น สี/ไซซ์ (บอทถามลูกค้าให้เลือกเอง)</Label>
                <button type="button" onClick={() => setRows((rs) => [...rs, { name: "", sku: "", price: "", stock: "0" }])}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700">+ เพิ่มตัวเลือก</button>
              </div>
              {rows.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-[1fr_5rem_6rem_4.5rem_1.5rem] gap-1.5 text-[10px] text-neutral-400">
                    <span>ชื่อตัวเลือก</span><span>SKU</span><span>ราคา (ว่าง=ราคาหลัก)</span><span>สต๊อก</span><span />
                  </div>
                  {rows.map((r, i) => (
                    <div key={r.id ?? `new-${i}`} className="grid grid-cols-[1fr_5rem_6rem_4.5rem_1.5rem] items-center gap-1.5">
                      <Input value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="เช่น แดง / L" className="h-9 text-xs" />
                      <Input value={r.sku} onChange={(e) => setRow(i, { sku: e.target.value })} placeholder="SKU" className="h-9 text-xs" />
                      <Input value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} type="number" step="0.01" min="0" placeholder="ราคาหลัก" className="h-9 text-xs" />
                      <Input value={r.stock} onChange={(e) => setRow(i, { stock: e.target.value })} type="number" min="0" className="h-9 text-xs" />
                      <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                        className="text-neutral-300 hover:text-red-500" aria-label="ลบตัวเลือก"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <p className="text-[10px] text-neutral-400">ลบตัวเลือกที่เคยบันทึกแล้ว = เก็บเข้าคลัง (ออเดอร์เก่ายังอ้างอิงได้)</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึกสินค้า"}</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
