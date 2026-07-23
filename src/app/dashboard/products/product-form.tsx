"use client";
import { useState, useTransition } from "react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import type { Product } from "@/lib/types/db";
import type { ActionResult } from "../actions";
import { uploadProductImage } from "../actions";
import { Plus, Pencil, X, Upload } from "lucide-react";

export default function ProductForm({
  shopId, action, product,
}: { shopId: string; action: (fd: FormData) => Promise<ActionResult>; product?: Product }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>(Array.isArray(product?.images) ? (product!.images as string[]) : []);
  const [uploading, setUploading] = useState(false);
  const [trackStock, setTrackStock] = useState(product?.track_stock ?? false);

  async function pickImage(file: File) {
    setUploading(true); setError(null);
    const fd = new FormData();
    fd.append("shop_id", shopId);
    fd.append("file", file);
    const r = await uploadProductImage(shopId, fd);
    if (!r.ok) { setError(r.error); setUploading(false); return; }
    setImages((im) => [...im, r.url]);
    setUploading(false);
  }

  function submit(fd: FormData) {
    fd.set("images_json", JSON.stringify(images));
    setError(null);
    start(async () => {
      const r = await action(fd);
      if (!r.ok) { setError(r.error); return; }
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
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> เพิ่มสินค้า/บริการ</Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <form
            action={submit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6"
          >
            <h2 className="font-bold">{product ? "แก้ไขสินค้า/บริการ" : "เพิ่มสินค้า/บริการ"}</h2>
            <input type="hidden" name="shop_id" value={shopId} />
            {product && <input type="hidden" name="id" value={product.id} />}
            <div>
              <Label>ชื่อสินค้า/บริการ *</Label>
              <Input name="name" required defaultValue={product?.name} placeholder="เช่น ค่าบริการออกแบบเว็บไซต์ / เซรั่มวิตซี 30ml" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>SKU/รหัส</Label><Input name="sku" defaultValue={product?.sku ?? ""} placeholder="VC-30" /></div>
              <div><Label>หมวดหมู่</Label><Input name="category" defaultValue={product?.category ?? ""} placeholder="บริการ / สินค้า" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ราคาขาย (บาท) *</Label><Input name="price" type="number" step="0.01" min="0" required defaultValue={product?.price} /></div>
              <div><Label>ต้นทุน/หน่วย (คิดกำไร-COGS)</Label><Input name="cost" type="number" step="0.01" min="0" defaultValue={product?.cost ?? ""} placeholder="ว่าง = ไม่คิดต้นทุน" /></div>
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-neutral-50 px-3 py-2.5">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="track_stock" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                นับสต๊อก (ตัดอัตโนมัติเมื่อออกใบเสร็จ/ใบแจ้งหนี้)
              </label>
              {trackStock && (
                <div className="flex items-center gap-2">
                  <Label className="mb-0">คงเหลือ</Label>
                  <Input name="stock" type="number" min="0" defaultValue={product?.stock ?? 0} className="w-24" />
                </div>
              )}
            </div>
            <div>
              <Label>สถานะ</Label>
              <Select name="status" defaultValue={product?.status ?? "active"}>
                <option value="active">ใช้งาน</option>
                <option value="draft">พัก (ไม่ขึ้นตอนออกเอกสาร)</option>
              </Select>
            </div>
            <div>
              <Label>รายละเอียด</Label>
              <Textarea name="description" defaultValue={product?.description ?? ""} placeholder="โน้ตภายใน เช่น สเปก ซัพพลายเออร์" />
            </div>

            {/* ===== รูปสินค้า ===== */}
            <div>
              <Label>รูป (ไม่บังคับ)</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {images.map((url, i) => (
                  <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-neutral-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setImages((im) => im.filter((_, j) => j !== i))}
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-neutral-300 text-neutral-400 hover:border-emerald-400 hover:text-emerald-600">
                  <Upload className="h-4 w-4" />
                  <span className="text-[9px]">{uploading ? "..." : "อัปโหลด"}</span>
                  <input type="file" accept="image/*" className="hidden" disabled={uploading}
                    onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])} />
                </label>
              </div>
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
            <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-neutral-100 bg-white px-5 pb-1 pt-3 sm:mx-0 sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">ยกเลิก</Button>
              <Button disabled={pending} className="flex-1 sm:flex-none">{pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
