"use client";
import { useState, useTransition } from "react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import type { Product, ProductVariant } from "@/lib/types/db";
import type { ActionResult } from "../actions";
import { uploadProductImage } from "../actions";
import { Plus, Pencil, X, Upload } from "lucide-react";

interface VariantRow { id?: string; name: string; sku: string; price: string; stock: string }

export default function ProductForm({
  shopId, action, product, variants,
}: { shopId: string; action: (fd: FormData) => Promise<ActionResult>; product?: Product; variants?: ProductVariant[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>(Array.isArray(product?.images) ? (product!.images as string[]) : []);
  const [uploading, setUploading] = useState(false);
  const [rows, setRows] = useState<VariantRow[]>(
    (variants ?? []).map((v) => ({ id: v.id, name: v.name, sku: v.sku ?? "", price: v.price === null ? "" : String(v.price), stock: String(v.stock) })),
  );

  function setRow(i: number, patch: Partial<VariantRow>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

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
    const clean = rows.filter((r) => r.name.trim()).map((r) => ({
      id: r.id, name: r.name.trim(), sku: r.sku.trim() || undefined,
      price: r.price.trim() === "" ? null : Number(r.price),
      stock: parseInt(r.stock || "0", 10) || 0,
    }));
    fd.set("variants_json", JSON.stringify(clean));
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
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> เพิ่มสินค้า</Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <form
            action={submit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6"
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div><Label>ราคา (บาท) *</Label><Input name="price" type="number" step="0.01" min="0" required defaultValue={product?.price} /></div>
              <div><Label>ราคาเดิม (ถ้าลด)</Label><Input name="compare_at_price" type="number" step="0.01" min="0" defaultValue={product?.compare_at_price ?? ""} placeholder="ว่าง = ไม่มี" /></div>
              <div className="col-span-2 sm:col-span-1"><Label>สต๊อก</Label><Input name="stock" type="number" min="0" defaultValue={product?.stock ?? 0} /></div>
            </div>
            <div>
              <Label>สถานะ</Label>
              <Select name="status" defaultValue={product?.status ?? "active"}>
                <option value="active">ขายอยู่</option>
                <option value="draft">ร่าง (บอทไม่เห็น)</option>
              </Select>
            </div>
            <div>
              <Label>รายละเอียด (บอทใช้ตอบลูกค้า — ใส่จุดเด่น วิธีใช้ ขนาด)</Label>
              <Textarea name="description" defaultValue={product?.description ?? ""} placeholder="อธิบายสินค้าให้ละเอียด บอทจะใช้ข้อมูลนี้ขายของ" />
            </div>

            {/* ===== รูปสินค้า — บอทส่งให้ลูกค้าดูได้ ===== */}
            <div>
              <Label>รูปสินค้า (บอทส่งให้ลูกค้าดูได้)</Label>
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

            {/* ===== ตัวเลือกย่อย (variants) ===== */}
            <div>
              <div className="flex items-center justify-between">
                <Label>ตัวเลือกย่อย เช่น สี/ไซซ์ (บอทถามลูกค้าให้เลือกเอง)</Label>
                <button type="button" onClick={() => setRows((rs) => [...rs, { name: "", sku: "", price: "", stock: "0" }])}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700">+ เพิ่มตัวเลือก</button>
              </div>
              {rows.length > 0 && (
                <div className="mt-2 space-y-2">
                  {/* หัวคอลัมน์เฉพาะจอ ≥sm — มือถือใช้ป้ายกำกับในแต่ละการ์ดแทน */}
                  <div className="hidden gap-1.5 text-[10px] text-neutral-400 sm:grid sm:grid-cols-[1fr_5rem_6rem_4.5rem_2rem]">
                    <span>ชื่อตัวเลือก</span><span>SKU</span><span>ราคา (ว่าง=ราคาหลัก)</span><span>สต๊อก</span><span />
                  </div>
                  {rows.map((r, i) => (
                    <div key={r.id ?? `new-${i}`}
                      className="grid grid-cols-1 gap-2 rounded-xl border border-neutral-200 p-3 sm:grid-cols-[1fr_5rem_6rem_4.5rem_2rem] sm:items-center sm:gap-1.5 sm:rounded-none sm:border-0 sm:p-0">
                      <div>
                        <label className="mb-0.5 block text-[11px] font-medium text-neutral-500 sm:hidden">ชื่อตัวเลือก (สี/ไซซ์)</label>
                        <Input value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="เช่น แดง / L" className="h-11 sm:h-9 sm:text-xs" />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] font-medium text-neutral-500 sm:hidden">SKU (ถ้ามี)</label>
                        <Input value={r.sku} onChange={(e) => setRow(i, { sku: e.target.value })} placeholder="SKU" className="h-11 sm:h-9 sm:text-xs" />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] font-medium text-neutral-500 sm:hidden">ราคา (ว่าง = ราคาหลัก)</label>
                        <Input value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} type="number" step="0.01" min="0" placeholder="ราคาหลัก" className="h-11 sm:h-9 sm:text-xs" />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] font-medium text-neutral-500 sm:hidden">สต๊อก</label>
                        <Input value={r.stock} onChange={(e) => setRow(i, { stock: e.target.value })} type="number" min="0" className="h-11 sm:h-9 sm:text-xs" />
                      </div>
                      <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                        className="flex h-10 w-full items-center justify-center gap-1 rounded-lg border border-neutral-200 text-xs text-red-500 hover:bg-red-50 sm:h-9 sm:w-auto sm:border-0"
                        aria-label="ลบตัวเลือก">
                        <X className="h-4 w-4" /><span className="sm:hidden">ลบตัวเลือกนี้</span>
                      </button>
                    </div>
                  ))}
                  <p className="text-[11px] text-neutral-400">ลบตัวเลือกที่เคยบันทึกแล้ว = เก็บเข้าคลัง (ออเดอร์เก่ายังอ้างอิงได้)</p>
                </div>
              )}
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
            <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-neutral-100 bg-white px-5 pb-1 pt-3 sm:mx-0 sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">ยกเลิก</Button>
              <Button disabled={pending} className="flex-1 sm:flex-none">{pending ? "กำลังบันทึก..." : "บันทึกสินค้า"}</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
