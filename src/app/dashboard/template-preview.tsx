"use client";
// ============================================================
//  เอกสารตัวอย่างแบบป๊อบอัพ (5 ก.ย. 2569 คำสั่งเจ้าของ: "เอกสารตัวอย่างควรเป็นป๊อบอัพ/หน้าคั่น")
//
//  เดิมกริด "ออกเอกสารใหม่" กดแล้วพาไปหน้าฟอร์มทันที คนที่ยังไม่รู้ว่าใบแจ้งหนี้กับใบเสร็จ
//  ต่างกันยังไงต้องกดเข้าไปกรอกก่อนถึงจะเห็นหน้าตาเอกสาร = ตัดสินใจโดยไม่เห็นของ
//  ตอนนี้กด "ดูตัวอย่าง" เห็นใบจริง (เรนเดอร์ด้วย DocPreview ตัวเดียวกับที่ใช้ตอนออกจริง)
//  พร้อมปุ่ม "ออกใบแบบนี้" ไปฟอร์ม — เห็นก่อน ค่อยทำ
//
//  ⚠️ ข้อมูลตัวอย่างเป็นชื่อสมมติล้วน ห้ามใช้ชื่อ/เลขภาษีของกิจการจริงหรือลูกค้าจริง
//  (repo สาธารณะ + หน้านี้เห็นได้ทุกบทบาท) และไม่ยิงฐานข้อมูลเลย — เป็นภาพประกอบเท่านั้น
// ============================================================
import { useState } from "react";
import Link from "next/link";
import { Eye, ArrowRight, X } from "lucide-react";
import DocPreview from "@/app/dashboard/finance/doc-preview";
import type { DocType, VatMode } from "@/lib/types/finance";

const SAMPLE = {
  seller: { name: "บริษัท ตัวอย่างการค้า จำกัด", address: "99/9 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพฯ 10110", taxId: "0000000000000", branch: "สำนักงานใหญ่" },
  buyer: { name: "ห้างหุ้นส่วนจำกัด ลูกค้าตัวอย่าง", address: "12 ซอยตัวอย่าง จังหวัดตัวอย่าง 20000", taxId: "0000000000000" },
  rows: [
    { name: "ค่าบริการออกแบบเว็บไซต์", qty: 1, unit: "งาน", unitPrice: 12000 },
    { name: "ค่าดูแลรายเดือน", qty: 2, unit: "เดือน", unitPrice: 1500 },
  ],
};

function totalsOf(vatMode: VatMode, whtRate: number) {
  const subtotal = SAMPLE.rows.reduce((a, r) => a + r.qty * r.unitPrice, 0);
  const exVat = vatMode === "inclusive" ? subtotal / 1.07 : subtotal;
  const vat = vatMode === "none" ? 0 : Math.round(exVat * 0.07 * 100) / 100;
  const total = vatMode === "inclusive" ? subtotal : exVat + vat;
  const wht = Math.round(exVat * (whtRate / 100) * 100) / 100;
  return { subtotal, discount: 0, exVat, vat, total, wht, cashDue: total - wht };
}

export default function TemplatePreview({ docType, href, label }: { docType: DocType; href: string; label: string }) {
  const [open, setOpen] = useState(false);
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const due = new Date(Date.now() + 37 * 864e5).toISOString().slice(0, 10);
  const vatMode: VatMode = "exclusive";
  const whtRate = docType === "invoice" ? 3 : 0;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        aria-label={`ดูตัวอย่าง${label}`}
        className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
        <Eye className="h-3.5 w-3.5" /> ดูตัวอย่าง
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/50 backdrop-blur-[1px]" onClick={() => setOpen(false)}>
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden p-2 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-white px-3 py-2.5 sm:px-4">
              <p className="min-w-0 truncate text-sm font-semibold text-neutral-900">ตัวอย่าง{label} <span className="font-normal text-neutral-400">(ข้อมูลสมมติ)</span></p>
              <div className="flex shrink-0 items-center gap-1.5">
                <Link href={href} className="inline-flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-neutral-900 px-3 text-xs font-semibold text-white hover:bg-neutral-700">
                  ออกใบแบบนี้ <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <button type="button" onClick={() => setOpen(false)} aria-label="ปิดตัวอย่าง"
                  className="grid h-10 w-10 place-items-center rounded-xl text-neutral-500 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
              </div>
            </div>
            {/* มือถือย่อทั้งใบให้พอดีจอ (zoom) — เอกสารกว้างแบบ A4 ถ้าไม่ย่อ คอลัมน์ตัวเลขจะหลุดขวา
                เห็นแต่ป้าย "รวมเป็นเงิน" โดยไม่มีตัวเลข (ภาพจริง 5 ก.ย. 2569) · จอ sm ขึ้นไปขนาดปกติ */}
            <div className="min-h-0 flex-1 overflow-y-auto rounded-b-2xl bg-neutral-100 p-2 sm:p-4">
              <div className="[zoom:0.72] sm:[zoom:1]">
              <DocPreview
                sample
                variant="panel"
                docType={docType}
                seller={SAMPLE.seller}
                buyer={SAMPLE.buyer}
                rows={SAMPLE.rows}
                totals={totalsOf(vatMode, whtRate)}
                issueDate={today} dueDate={due} vatMode={vatMode} whtRate={whtRate}
                notes="ตัวอย่างเพื่อดูรูปแบบเอกสาร — ตัวเลขและชื่อทั้งหมดเป็นข้อมูลสมมติ"
                onClose={() => setOpen(false)}
              />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
