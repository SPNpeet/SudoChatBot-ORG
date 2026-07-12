"use client";
import { useState, useTransition } from "react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import type { Product } from "@/lib/types/db";
import { Plus, Pencil } from "lucide-react";

export default function ProductForm({
  shopId, action, product,
}: { shopId: string; action: (fd: FormData) => Promise<void>; product?: Product }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
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
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl"
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
