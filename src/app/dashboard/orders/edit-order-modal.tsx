"use client";
import { useState, useTransition } from "react";
import { Button, Input, Label } from "@/components/ui";
import { updateOrderDetails } from "./actions";
import type { Order } from "@/lib/types/db";
import { Pencil } from "lucide-react";

export default function EditOrderModal({ order, shopId }: { order: Order; shopId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(order.shipping_name ?? "");
  const [phone, setPhone] = useState(order.shipping_phone ?? "");
  const [address, setAddress] = useState(order.shipping_address?.text ?? "");
  const canEditItems = ["draft", "pending_payment", "paid", "confirmed"].includes(order.status);
  const [qty, setQty] = useState<Record<string, string>>(
    Object.fromEntries((order.order_items ?? []).map((i) => [i.id, String(i.quantity)])),
  );

  function submit() {
    setError(null);
    start(async () => {
      const items = (order.order_items ?? []).map((i) => ({ id: i.id, quantity: parseInt(qty[i.id] || "1", 10) || 1 }));
      const r = await updateOrderDetails(order.id, shopId, { name, phone, address }, items);
      if (!r.ok) { setError(r.error); return; }
      setOpen(false);
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex min-h-[38px] w-full items-center justify-center rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 sm:w-auto">
        <Pencil className="mr-1 inline h-3.5 w-3.5" /> แก้ไขออเดอร์
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6">
            <h2 className="font-bold">แก้ไขออเดอร์ {order.order_number}</h2>
            <div><Label>ชื่อผู้รับ</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>เบอร์โทร</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>ที่อยู่จัดส่ง</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>

            {(order.order_items ?? []).length > 0 && (
              <div>
                <Label>จำนวนสินค้า{!canEditItems && " (แก้ไม่ได้แล้ว — จัดส่งไปแล้ว)"}</Label>
                <div className="mt-1.5 space-y-1.5">
                  {(order.order_items ?? []).map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-neutral-600">{it.product_name}{it.variant_name ? ` (${it.variant_name})` : ""}</span>
                      <Input type="number" min={1} disabled={!canEditItems} value={qty[it.id] ?? "1"}
                        onChange={(e) => setQty((q) => ({ ...q, [it.id]: e.target.value }))} className="h-10 w-20 shrink-0 sm:h-9 sm:text-xs" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
            <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-neutral-100 bg-white px-5 pb-1 pt-3 sm:mx-0 sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">ยกเลิก</Button>
              <Button onClick={submit} disabled={pending} className="flex-1 sm:flex-none">{pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
