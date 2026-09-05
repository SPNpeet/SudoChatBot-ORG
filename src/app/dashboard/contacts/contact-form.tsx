"use client";
// ฟอร์มเพิ่ม/แก้ผู้ติดต่อ — bottom-sheet บนมือถือ modal บนจอใหญ่
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X } from "lucide-react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { upsertContact, archiveContact } from "../finance/actions";
import { RECIPIENT_KINDS, guessRecipientKind, isValidTaxId, type RecipientKind } from "@/lib/tax-th";
import type { Contact } from "@/lib/types/finance";
import { useDismiss } from "@/components/use-dismiss";

/**
 * ชื่อประเภทผู้ติดต่อ — ใช้ในป้ายกำกับปุ่มแก้ไข
 *
 * ⚠️ ทำไมต้องมี (27 ส.ค. 2569): ผู้ติดต่อชื่อซ้ำกันได้จริง และในข้อมูลจริงเจอสองรายชื่อ
 * เหมือนกันเป๊ะ ต่างกันแค่เป็นลูกค้ากับเป็นผู้ขาย คนตาดีแยกออกจากป้ายในแถว
 * แต่โปรแกรมอ่านหน้าจอได้ยินว่า "แก้ไข ชื่อเดียวกัน" สองครั้งโดยไม่มีอะไรต่างกันเลย
 * ประเภทคือตัวแยกที่มีอยู่จริงในข้อมูล ไม่ใช่การเติมรหัสมั่ว ๆ เข้าไปให้ไม่ซ้ำ
 */
const KIND_TH: Record<string, string> = { customer: "ลูกค้า", vendor: "ผู้ขาย", both: "ลูกค้า+ผู้ขาย" };

// canArchive: archiveContact ฝั่ง server รับเฉพาะเจ้าของ/ผู้ดูแล — พนักงานแก้ข้อมูลได้แต่ซ่อนปุ่มเก็บเข้าคลัง
export default function ContactForm({ shopId, contact, canArchive = true }: { shopId: string; contact?: Contact; canArchive?: boolean }) {
  const [open, setOpen] = useState(false);
  useDismiss(open, () => setOpen(false));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  // ประเภทผู้รับเงินเป็นตัวตัดสินว่ารายนี้เข้า ภ.ง.ด.3 หรือ 53
  // ระบบเดาให้จากเลขผู้เสียภาษีได้ แต่ต้องให้คนแก้ทับได้ เพราะคณะบุคคลกับนิติบุคคล
  // ใช้เลขขึ้นต้นเหมือนกันแต่ยื่นคนละแบบ — เดาผิดแล้วยื่นผิดแบบทั้งปี
  const [taxId, setTaxId] = useState(contact?.tax_id ?? "");
  const [kind, setKind] = useState<RecipientKind>(
    (contact?.recipient_kind as RecipientKind | undefined) ?? guessRecipientKind(contact?.tax_id),
  );
  const [touchedKind, setTouchedKind] = useState(!!contact?.recipient_kind);
  const taxDigits = taxId.replace(/\D/g, "");
  const taxOk = isValidTaxId(taxId);

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
        // ⚠️ ปุ่มในแถวต้องบอกด้วยว่าแก้ไข "ใคร" (แก้ 27 ส.ค. 2569)
        // หน้ารายชื่อมีปุ่มชื่อ "แก้ไข" เท่ากับจำนวนแถว ด่าน check:dupbuttons จับได้ว่า
        // บนจอ 390px มีปุ่มชื่อซ้ำกันหลายปุ่มในหน้าเดียว และโปรแกรมอ่านหน้าจอ
        // จะอ่านว่า "แก้ไข" ซ้ำ ๆ โดยไม่มีอะไรบอกว่าเป็นของผู้ติดต่อรายไหน
        <button onClick={() => setOpen(true)} aria-label={`แก้ไข ${KIND_TH[contact.kind] ?? ""} ${contact.name}${contact.tax_id ? ` เลขผู้เสียภาษี ${contact.tax_id}` : contact.phone ? ` โทร ${contact.phone}` : ""}`.replace(/\s+/g, " ").trim()}
          // ⚠️ เป้ากด 44px (วัดจริง 5 ก.ย. 2569 ได้ 16px — นิ้วกดพลาดไปโดนลิงก์ข้างบนแทน)
          // กติกาข้อ 9 ของโปรเจกต์: เป้ากดขั้นต่ำ 44px ในหน้าที่ลูกค้าใช้
          className="-mx-2 inline-flex min-h-11 items-center gap-1 px-2 text-xs text-neutral-400 hover:text-neutral-700">
          <Pencil className="h-3.5 w-3.5" /> แก้ไข
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> เพิ่มผู้ติดต่อ</Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 pb-10 pt-14 sm:items-center" onClick={() => setOpen(false)}>
          <div className="w-full rounded-2xl bg-white p-5 sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
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
                    <option value="vendor">ผู้ขาย</option>
                    <option value="both">เป็นทั้งสองอย่าง</option>
                  </Select>
                </div>
                <div>
                  <Label>เลขผู้เสียภาษี (13 หลัก)</Label>
                  <Input name="tax_id" inputMode="numeric" value={taxId} placeholder="0105561000000"
                    onChange={(e) => {
                      const v = e.target.value;
                      setTaxId(v);
                      // เดาประเภทให้ก่อนเฉพาะตอนผู้ใช้ยังไม่เคยเลือกเอง — เลือกแล้วห้ามเปลี่ยนทับ
                      if (!touchedKind) setKind(guessRecipientKind(v));
                    }} />
                  {taxDigits.length === 13 && !taxOk && (
                    <p className="mt-1 text-xs text-red-600">เลขนี้ไม่ผ่านการตรวจหลักสุดท้าย ลองทานอีกครั้ง — เลขผิดจะติดไปถึงไฟล์ที่ยื่นสรรพากร</p>
                  )}
                  {taxDigits.length > 0 && taxDigits.length !== 13 && (
                    <p className="mt-1 text-xs text-neutral-400">กรอกแล้ว {taxDigits.length} หลัก (ต้องครบ 13)</p>
                  )}
                </div>
                <div>
                  <Label>สาขา</Label>
                  <Input name="branch" defaultValue={contact?.branch ?? ""} placeholder="สำนักงานใหญ่" />
                  <p className="mt-1 text-xs text-neutral-400">ว่างไว้ = สำนักงานใหญ่ · สาขาให้กรอกเลข เช่น 1</p>
                </div>
                <div className="sm:col-span-2">
                  <Label>ประเภทผู้รับเงิน (ใช้เลือกแบบยื่นหัก ณ ที่จ่าย)</Label>
                  <Select name="recipient_kind" value={kind}
                    onChange={(e) => { setKind(e.target.value as RecipientKind); setTouchedKind(true); }}>
                    {RECIPIENT_KINDS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </Select>
                  <p className="mt-1 text-xs text-neutral-400">
                    {RECIPIENT_KINDS.find((r) => r.value === kind)?.hint} · หักภาษีให้รายนี้จะเข้าแบบ{" "}
                    <span className="font-semibold text-neutral-600">{RECIPIENT_KINDS.find((r) => r.value === kind)?.form}</span>
                  </p>
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
                {contact && canArchive ? (
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
