"use client";
// ฟอร์มเพิ่ม/แก้ผู้ติดต่อ — bottom-sheet บนมือถือ modal บนจอใหญ่
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X } from "lucide-react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { upsertContact, archiveContact } from "../finance/actions";
import type { Contact } from "@/lib/types/finance";

export default function ContactForm({ shopId, contact }: { shopId: string; contact?: Contact }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      const r = await upsertContact(shopId, fd);
      if (r.ok) { setOpen(false); router.refresh(); }
      else setError(r.error);
    });
  }

  function archive() {
    if (!contact) return;
    start(async () => {
      const r = await archiveContact(contact.id, shopId);
      if (r.ok) { setOpen(false); router.refresh(); }
      else setError(r.error);
    });
  }

  return (
    <>
      {contact ? (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700">
          <Pencil className="h-3 w-3" /> แก้ไข
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> เพิ่มผู้ติดต่อ</Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div className="max-h-[92svh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{contact ? "แก้ไขผู้ติดต่อ" : "เพิ่มผู้ติดต่อ"}</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
            </div>
            <form action={submit} className="space-y-3">
              {contact && <input type="hidden" name="id" value={contact.id} />}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>ชื่อ (บุคคล/บริษัท) *</Label>
                  <Input name="name" required defaultValue={contact?.name ?? ""} placeholder="เช่น บริษัท ตัวอย่าง จำกัด" />
                </div>
                <div>
                  <Label>ประเภท</Label>
                  <Select name="kind" defaultValue={contact?.kind ?? "customer"}>
                    <option value="customer">ลูกค้า</option>
                    <option value="vendor">ผู้ขาย/ซัพพลายเออร์</option>
                    <option value="both">เป็นทั้งสองอย่าง</option>
                  </Select>
                </div>
                <div>
                  <Label>เลขผู้เสียภาษี (13 หลัก)</Label>
                  <Input name="tax_id" inputMode="numeric" defaultValue={contact?.tax_id ?? ""} placeholder="0000000000000" />
                </div>
                <div>
                  <Label>สาขา</Label>
                  <Input name="branch" defaultValue={contact?.branch ?? ""} placeholder="สำนักงานใหญ่" />
                </div>
                <div>
                  <Label>โทรศัพท์</Label>
                  <Input name="phone" defaultValue={contact?.phone ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <Label>อีเมล</Label>
                  <Input name="email" type="email" defaultValue={contact?.email ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <Label>ที่อยู่ (ขึ้นบนเอกสาร/ใบกำกับภาษี)</Label>
                  <Textarea name="address" className="min-h-16" defaultValue={contact?.address ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <Label>โน้ต</Label>
                  <Input name="notes" defaultValue={contact?.notes ?? ""} placeholder="เช่น เครดิต 30 วัน" />
                </div>
              </div>
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <div className="flex items-center justify-between gap-2 pt-1">
                {contact ? (
                  <button type="button" onClick={archive} disabled={pending}
                    className="text-xs text-red-500 hover:text-red-700">เก็บเข้าคลัง (ซ่อน)</button>
                ) : <span />}
                <Button disabled={pending} className="min-w-28">{pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
