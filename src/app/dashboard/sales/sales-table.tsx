"use client";
// ============================================================
//  ตารางเอกสารขาย + เลือกหลายใบทำพร้อมกัน (เพิ่ม 28 ส.ค. 2569 ตามผลตรวจภายนอก)
//
//  โจทย์จริงคือ "สิ้นเดือนต้องส่งใบแจ้งหนี้สิบใบ" — เดิมต้องเข้าไปทีละใบ
//  กดคัดลอกลิงก์ทีละครั้ง สิบใบ = สามสิบกว่าคลิก ตอนนี้ติ๊กแล้วคัดลอกทีเดียว
//
//  ⚠️ งานเลือกหลายใบมีเฉพาะฝั่ง "อ่าน/ส่งออก" (คัดลอกลิงก์ · CSV) โดยตั้งใจ
//  ห้ามเพิ่ม "ยกเลิกหลายใบพร้อมกัน" — การยกเลิกกลับรายการบัญชีจริง
//  พลาดทีเดียวเสียหายหลายใบ ต้องบังคับทำทีละใบให้เห็นหน้าเอกสารก่อนเสมอ
// ============================================================
import { useRef, useState } from "react";
import Link from "next/link";
import { Badge, Table, Th, Td } from "@/components/ui";
import { baht, dateOnlyTH, cn } from "@/lib/utils";
import { DOC_TYPE_TH, docStatusLabel, docStatusTone } from "@/lib/finance";
import type { DocStatus, DocType } from "@/lib/types/finance";
import RowLink from "@/components/row-link";
import { useToast } from "@/components/toast";
import { saveBlob } from "@/lib/download";
import { authOrigin } from "@/lib/app-origin";
import { Copy, FileDown, X, ExternalLink, Printer } from "lucide-react";
import { useRouter } from "next/navigation";

export interface SalesRow {
  id: string; doc_number: string; doc_type: string; contact_name: string | null;
  issue_date: string; total: number; outstanding: number; status: string; share_key: string | null;
}

export default function SalesTable({ rows }: { rows: SalesRow[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toast = useToast();
  const router = useRouter();
  // เมนูลัดของแถว — คลิกขวา (เดสก์ท็อป) หรือกดค้าง ~0.6 วิ (มือถือ) ตามผลตรวจ 28 ส.ค. 2569
  // มีเฉพาะงาน "อ่าน/ส่งออก" เช่นเดียวกับแถบเลือกหลายใบ — งานอันตรายยังต้องเข้าหน้าเอกสาร
  const [menu, setMenu] = useState<{ x: number; y: number; row: SalesRow } | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function openMenu(e: { clientX: number; clientY: number }, row: SalesRow) {
    // กันเมนูตกขอบจอ: จอแคบสุด 320px เมนูกว้าง ~208px
    setMenu({ x: Math.min(e.clientX, window.innerWidth - 216), y: Math.min(e.clientY, window.innerHeight - 170), row });
  }
  function startPress(e: React.TouchEvent, row: SalesRow) {
    const t = e.touches[0];
    const at = { clientX: t.clientX, clientY: t.clientY };
    pressTimer.current = setTimeout(() => openMenu(at, row), 600);
  }
  function cancelPress() {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  }
  async function copyOneLink(row: SalesRow) {
    if (!row.share_key) {
      toast({ tone: "error", text: "ใบนี้ยังไม่มีลิงก์ส่งลูกค้า — เปิดเอกสารแล้วกด “ลิงก์ส่งลูกค้า” ก่อน" });
      return;
    }
    try {
      await navigator.clipboard.writeText(`${authOrigin()}/doc/${row.share_key}`);
      toast({ tone: "success", text: `คัดลอกลิงก์ ${row.doc_number} แล้ว` });
    } catch { toast({ tone: "error", text: "คัดลอกไม่สำเร็จ ลองใหม่อีกครั้ง" }); }
  }
  const picked = rows.filter((r) => sel.has(r.id));

  function toggle(id: string) {
    setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setSel((s) => s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));
  }

  async function copyLinks() {
    const withKey = picked.filter((r) => r.share_key);
    if (!withKey.length) {
      toast({ tone: "error", text: "ใบที่เลือกยังไม่มีลิงก์ส่งลูกค้า — เปิดเอกสารแล้วกด “ลิงก์ส่งลูกค้า” ก่อน" });
      return;
    }
    const text = withKey
      .map((r) => `${DOC_TYPE_TH[r.doc_type as DocType]} ${r.doc_number}${r.contact_name ? ` (${r.contact_name})` : ""}: ${authOrigin()}/doc/${r.share_key}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      const skipped = picked.length - withKey.length;
      toast({ tone: "success", text: `คัดลอกลิงก์ ${withKey.length} ใบแล้ว — วางส่งใน LINE/อีเมลได้เลย${skipped ? ` (ข้าม ${skipped} ใบที่ยังไม่มีลิงก์)` : ""}` });
    } catch {
      toast({ tone: "error", text: "คัดลอกไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
  }

  function exportCsv() {
    // BOM นำหน้าเพื่อให้ Excel ไทยเปิดแล้วไม่เป็นตัวยึกยือ (เหตุผลเดียวกับไฟล์ยื่นสรรพากร)
    const head = "เลขที่,ประเภท,ลูกค้า,วันที่,ยอดรวม,ค้างรับ,สถานะ";
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const body = picked.map((r) => [
      esc(r.doc_number), esc(DOC_TYPE_TH[r.doc_type as DocType] ?? r.doc_type), esc(r.contact_name ?? ""),
      r.issue_date, r.total.toFixed(2), r.outstanding.toFixed(2),
      esc(docStatusLabel(r.doc_type as DocType, r.status as DocStatus)),
    ].join(","));
    saveBlob(new Blob(["﻿" + [head, ...body].join("\n")], { type: "text/csv;charset=utf-8" }), "เอกสารขายที่เลือก.csv");
    toast({ tone: "success", text: `ดาวน์โหลด ${picked.length} รายการแล้ว` });
  }

  return (
    <div className="relative">
      {/* ============================================================
          มือถือ = การ์ดสรุป 3 บรรทัด · เดสก์ท็อป = ตาราง (แก้ 29 ส.ค. 2569)

          ⚠️ เดิมปล่อยให้ .rtable แปลงตารางเป็นการ์ดอัตโนมัติ ซึ่งกางทุกคอลัมน์
          เป็นบรรทัด "ชื่อฟิลด์ : ค่า" = 7 บรรทัดต่อเอกสาร 1 ใบ
          เจ้าของแคปมาจริง: จอ 390px เห็นเอกสารได้ 2 ใบครึ่ง ต้องเลื่อนยาวมากกว่าจะเจอใบที่ต้องการ
          และข้อมูลที่คนหาจริง ๆ (เลขที่ · ยอด · จ่ายหรือยัง) จมอยู่กับคำว่า "ประเภท/วันที่" ที่ไม่ได้ช่วยอะไร

          รูปแบบนี้ลอกจากการ์ด "เอกสารล่าสุด" ในหน้าภาพรวมที่ใช้อยู่แล้ว
          ไม่ได้คิดของใหม่ — ทั้งแอปควรอ่านเหมือนกัน
          ============================================================ */}
      <div className="space-y-2 px-4 pb-4 sm:hidden">
        {rows.map((d) => (
          <div key={d.id}
            className={cn("flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white p-3",
              sel.has(d.id) && "border-emerald-500 bg-emerald-50/40",
              d.status === "void" && "opacity-50")}
            onContextMenu={(e) => { e.preventDefault(); openMenu(e, d); }}
            onTouchStart={(e) => startPress(e, d)} onTouchEnd={cancelPress} onTouchMove={cancelPress}>
            {/* เป้ากด 44px ตามกติกาหน้าตา — ช่องติ๊กเล็ก ๆ บนมือถือกดพลาดตลอด */}
            <label className="-m-2 grid h-11 w-11 shrink-0 cursor-pointer place-items-center p-2">
              <input type="checkbox" aria-label={`เลือก ${d.doc_number}`} checked={sel.has(d.id)}
                onChange={() => toggle(d.id)} className="h-4 w-4 accent-emerald-600" />
            </label>
            <Link href={`/dashboard/sales/${d.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="min-w-0 flex-1">
                {/* ป้ายสถานะห้ามตัดบรรทัด — "รอชำระ" ที่หักเป็น "รอ / ชำระ" อ่านแล้วสะดุด
                    ให้เลขที่เอกสารเป็นตัวที่ย่อแทน เพราะย่อแล้วยังเดาออกจากท้ายเลข */}
                <span className="flex items-center gap-2">
                  <span className={cn("truncate text-[13px] font-semibold text-neutral-900",
                    d.status === "void" && "text-neutral-400 line-through")}>{d.doc_number}</span>
                  <span className="shrink-0 whitespace-nowrap">
                    <Badge tone={docStatusTone(d.status as DocStatus)}>{docStatusLabel(d.doc_type as DocType, d.status as DocStatus)}</Badge>
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-neutral-500">
                  {DOC_TYPE_TH[d.doc_type as DocType]} · {d.contact_name ?? "ไม่ระบุลูกค้า"}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[13px] font-semibold tabular-nums text-neutral-900">{baht(d.total)}</span>
                {/* ค้างรับโชว์เฉพาะตอนมีจริง — บรรทัด "ค้างรับ: -" ไม่ได้บอกอะไรนอกจากกินที่ */}
                {d.outstanding > 0
                  ? <span className="block text-xs font-medium tabular-nums text-amber-600">ค้าง {baht(d.outstanding)}</span>
                  : <span className="block text-xs text-neutral-400">{dateOnlyTH(d.issue_date)}</span>}
              </span>
            </Link>
          </div>
        ))}
      </div>

      <div className="hidden sm:block">
      <Table>
        <thead><tr>
          <Th className="w-10">
            <input type="checkbox" aria-label="เลือกทั้งหมด" checked={sel.size === rows.length && rows.length > 0}
              onChange={toggleAll} className="h-4 w-4 accent-emerald-600" />
          </Th>
          <Th>เลขที่</Th><Th>ประเภท</Th><Th>ลูกค้า</Th><Th>วันที่</Th>
          <Th className="text-right">ยอด</Th><Th className="text-right">ค้างรับ</Th><Th>สถานะ</Th>
        </tr></thead>
        <tbody>
          {rows.map((d) => (
            <RowLink key={d.id} href={`/dashboard/sales/${d.id}`} className={cn(d.status === "void" && "opacity-50")}
              onContextMenu={(e) => { e.preventDefault(); openMenu(e, d); }}
              onTouchStart={(e) => startPress(e, d)} onTouchEnd={cancelPress} onTouchMove={cancelPress}>
              {/* ช่องติ๊กต้องไม่พาไปหน้าเอกสาร — หยุด event ก่อนถึง RowLink */}
              {/* บนมือถือตารางกลายเป็นการ์ด (ดู .rtable) — ใส่ label ให้ช่องติ๊กอ่านออกว่าคืออะไร */}
              <Td label="เลือกใบนี้" onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggle(d.id); }}>
                <input type="checkbox" aria-label={`เลือก ${d.doc_number}`} checked={sel.has(d.id)}
                  onChange={() => toggle(d.id)} onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 accent-emerald-600" />
              </Td>
              <Td><Link href={`/dashboard/sales/${d.id}`}
                className={cn("font-medium text-emerald-700 hover:underline", d.status === "void" && "text-neutral-400 line-through")}>
                {d.doc_number}
              </Link></Td>
              <Td label="ประเภท">{DOC_TYPE_TH[d.doc_type as DocType]}</Td>
              <Td label="ลูกค้า">{d.contact_name ?? "-"}</Td>
              <Td label="วันที่" className="text-neutral-400">{dateOnlyTH(d.issue_date)}</Td>
              <Td label="ยอด" className="text-right">{baht(d.total)}</Td>
              <Td label="ค้างรับ" className="text-right">{d.outstanding > 0 ? <span className="font-medium text-amber-600">{baht(d.outstanding)}</span> : "-"}</Td>
              <Td label="สถานะ"><Badge tone={docStatusTone(d.status as DocStatus)}>{docStatusLabel(d.doc_type as DocType, d.status as DocStatus)}</Badge></Td>
            </RowLink>
          ))}
        </tbody>
      </Table>
      </div>

      {/* เมนูลัดของแถว — ฉากหลังโปร่งเต็มจอไว้ปิดเมนูเมื่อกดที่อื่น */}
      {menu && (
        <div className="fixed inset-0 z-50" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}>
          <div className="absolute w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-xl"
            style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
            <p className="border-b border-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-500">{menu.row.doc_number}</p>
            <button type="button" onClick={() => { setMenu(null); router.push(`/dashboard/sales/${menu.row.id}`); }}
              className="flex min-h-[40px] w-full items-center gap-2 px-3 text-left text-sm text-neutral-700 hover:bg-neutral-50">
              <ExternalLink className="h-3.5 w-3.5 text-neutral-400" /> เปิดเอกสาร
            </button>
            <button type="button" onClick={() => { copyOneLink(menu.row); setMenu(null); }}
              className="flex min-h-[40px] w-full items-center gap-2 px-3 text-left text-sm text-neutral-700 hover:bg-neutral-50">
              <Copy className="h-3.5 w-3.5 text-neutral-400" /> คัดลอกลิงก์ส่งลูกค้า
            </button>
            <button type="button" onClick={() => { setMenu(null); window.open(`/dashboard/print/${menu.row.id}`, "_blank"); }}
              className="flex min-h-[40px] w-full items-center gap-2 px-3 text-left text-sm text-neutral-700 hover:bg-neutral-50">
              <Printer className="h-3.5 w-3.5 text-neutral-400" /> พิมพ์ / บันทึก PDF
            </button>
          </div>
        </div>
      )}

      {/* แถบงานกลุ่ม — ลอยล่างจอเมื่อเลือกอย่างน้อย 1 ใบ อยู่เหนือปุ่ม + ลอย */}
      {sel.size > 0 && (
        <div className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 shadow-lg sm:bottom-6">
          <span className="text-sm font-semibold text-neutral-800">เลือกแล้ว {sel.size} ใบ</span>
          <span className="min-w-0 flex-1" />
          <button type="button" onClick={copyLinks}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500">
            <Copy className="h-3.5 w-3.5" /> คัดลอกลิงก์ส่งลูกค้า
          </button>
          <button type="button" onClick={exportCsv}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-neutral-300 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
            <FileDown className="h-3.5 w-3.5" /> CSV
          </button>
          <button type="button" aria-label="ยกเลิกการเลือก" onClick={() => setSel(new Set())}
            className="grid h-10 w-10 place-items-center rounded-xl text-neutral-400 hover:bg-neutral-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
