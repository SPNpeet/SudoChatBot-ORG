"use client";
// นำเข้า statement ธนาคาร (CSV/Excel) -> จับคู่เงินเข้ากับใบแจ้งหนี้ค้างรับ -> ยืนยันทีละแถว
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Check, Landmark, Download, Loader2, TriangleAlert } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitleIcon } from "@/components/ui";
import { baht } from "@/lib/utils";
import { recordPayment } from "../finance/actions";
import { parseStatementPdf } from "./statement-actions";
import { useToast } from "@/components/toast";
import { matchColumns, STATEMENT_FIELDS } from "@/lib/column-map";
import { saveBlob } from "@/lib/download";

interface InvoiceLite { docId: string; docNumber: string; contact: string | null; outstanding: number; due: string | null }
interface StmtRow { idx: number; date: string; desc: string; amount: number; matched?: InvoiceLite; docId: string; done?: boolean; error?: string }

export default function StatementImport({ shopId, invoices }: { shopId: string; invoices: InvoiceLite[] }) {
  const [rows, setRows] = useState<StmtRow[]>([]);
  // ขั้นจับคู่คอลัมน์ — มีค่าเมื่ออ่านไฟล์ตารางเสร็จแต่ยังไม่ยืนยันคอลัมน์
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<unknown[][]>([]);
  const [map, setMap] = useState<{ date: number; desc: number; amountIn: number }>({ date: -1, desc: -1, amountIn: -1 });
  const [guessed, setGuessed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function downloadTemplate() {
    const csv = "﻿วันที่,รายละเอียด,เงินเข้า,เงินออก\n2026-07-01,โอนจากลูกค้า A,5350.00,\n2026-07-02,ค่าธรรมเนียม,,25.00\n2026-07-03,รับชำระ INV-2026-0001,12840.00,\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    // ⚠️ ใช้ saveBlob เท่านั้น — เดิมเขียนเองแล้วโหลดไม่ติดบนมือถือ (ดู src/lib/download.ts)
    saveBlob(blob, "statement-template.csv");
  }

  /** จับคู่ยอดตรงกับใบแจ้งหนี้ค้างรับ — ใช้ร่วมกันทั้งทาง CSV/Excel และ PDF */
  function autoMatch(parsed: StmtRow[]) {
    for (const row of parsed) {
      const exact = invoices.filter((iv) => Math.abs(iv.outstanding - row.amount) <= 0.01);
      if (exact.length === 1) { row.matched = exact[0]; row.docId = exact[0].docId; }
    }
    return parsed;
  }

  /** PDF ต้องแกะฝั่งเซิร์ฟเวอร์ (pdf.js ในเบราว์เซอร์ต้องตั้ง worker เอง = พังง่าย) */
  async function onPdf(f: File) {
    setReading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await parseStatementPdf(shopId, fd);
      if (!r.ok) { setError(r.error); return; }
      setNote(r.note ?? null);
      setRows(autoMatch(r.rows.map((x, i) => ({ idx: i, date: x.date, desc: x.desc, amount: x.amount, docId: "" }))));
    } finally {
      setReading(false);
    }
  }

  async function onFile(f: File) {
    setError(null);
    setNote(null);
    setRows([]);
    if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") { await onPdf(f); return; }
    try {
      const { readSheet } = await import("@/lib/excel");
      const aoa = await readSheet(f);
      if (aoa.length < 2) { setError("อ่านไฟล์ไม่ได้ หรือไฟล์มีแต่หัวตาราง"); return; }

      // ⚠️ ห้ามเดาคอลัมน์แบบมั่วอีกแล้ว (แก้ 8 ส.ค. 2569)
      // ของเดิม: หาไม่เจอให้ใช้คอลัมน์ที่ 0 กับ 1 และยอดเงินหาไม่เจอก็ปล่อยเป็น 0
      // ผลคือไฟล์ที่หัวคอลัมน์ไม่ตรงแบบจะ "นำเข้าสำเร็จ" โดยอ่านยอดจากคอลัมน์ผิด
      // ไม่มี error ให้เห็นเลย ตัวเลขแค่ผิด — อันตรายที่สุดในงานเงิน
      // ตอนนี้: เดาให้ก่อน แล้วให้คนยืนยัน/แก้เองได้ทุกช่อง ก่อนเห็นตัวเลขจริง
      const hd = aoa[0].map((h) => String(h ?? ""));
      const guess = matchColumns(hd, STATEMENT_FIELDS);
      setHeaders(hd);
      setDataRows(aoa.slice(1));
      setMap({
        date: guess.date.index,
        desc: guess.desc.index,
        // ไฟล์คอลัมน์เดียว (มีแต่ "จำนวนเงิน") ก็ใช้เป็นเงินเข้าได้
        amountIn: guess.amountIn.index >= 0 ? guess.amountIn.index : guess.amount.index,
      });
      setGuessed(guess.date.confidence !== "none" || guess.amountIn.confidence !== "none");
    } catch {
      setError("อ่านไฟล์ไม่สำเร็จ — ลองใช้ไฟล์ CSV, Excel หรือ PDF ที่โหลดจากแอปธนาคารโดยตรง");
    }
  }

  /** แปลงตามคอลัมน์ที่ผู้ใช้ยืนยันแล้ว — เรียกตอนกดปุ่ม ไม่ใช่ตอนอ่านไฟล์ */
  function applyMapping() {
    if (map.date < 0 || map.amountIn < 0) {
      setError("เลือกให้ครบว่าคอลัมน์ไหนคือวันที่ และคอลัมน์ไหนคือยอดเงินเข้า");
      return;
    }
    setError(null);
    const parsed: StmtRow[] = dataRows.map((r, i) => {
      const amtRaw = String(r[map.amountIn] ?? "").replace(/[^0-9.\-]/g, "");
      return {
        idx: i,
        date: String(r[map.date] ?? "").slice(0, 20),
        desc: map.desc >= 0 ? String(r[map.desc] ?? "").slice(0, 80) : "",
        amount: Math.round((Number(amtRaw) || 0) * 100) / 100,
        docId: "",
      };
    }).filter((r) => r.amount > 0).slice(0, 100);

    if (!parsed.length) {
      setError(`คอลัมน์ "${headers[map.amountIn] || `ที่ ${map.amountIn + 1}`}" ไม่มีตัวเลขที่มากกว่า 0 เลยสักแถว — น่าจะเลือกคอลัมน์ผิด ลองเลือกใหม่`);
      return;
    }
    setHeaders([]); setDataRows([]);
    setRows(autoMatch(parsed));
  }

  function confirmRow(row: StmtRow) {
    if (savingIdx !== null || row.done) return;   // กันกดซ้ำระหว่างรอ = บันทึกรับเงินซ้ำ
    setSavingIdx(row.idx);
    start(async () => {
      try {
        const r = await recordPayment(shopId, {
          doc_id: row.docId || null, direction: "in", method: "transfer",
          amount: row.amount, statement_ref: `stmt:${row.date}:${row.idx}`,
        });
        setRows((rs) => rs.map((x) => x.idx === row.idx
          ? { ...x, done: r.ok, error: r.ok ? undefined : r.error }
          : x));
        if (r.ok) {
          toast({ tone: "success", text: `บันทึกรับเงิน ${baht(row.amount)} แล้ว` });
          router.refresh();
        } else {
          toast({ tone: "error", text: r.error ?? "บันทึกไม่สำเร็จ" });
        }
      } finally { setSavingIdx(null); }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitleIcon icon={Landmark} desc="โหลดไฟล์เดินบัญชีจากแอปธนาคารมาทีเดียวทั้งเดือน ระบบจับคู่กับใบแจ้งหนี้ให้เอง">
          นำเข้ารายการเดินบัญชีธนาคาร
        </CardTitleIcon>
      </CardHeader>
      <CardContent className="space-y-3">
        <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx,.pdf,application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1" disabled={reading} onClick={() => fileRef.current?.click()}>
            {reading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> กำลังอ่านไฟล์…</>
              : <><FileSpreadsheet className="h-4 w-4" /> เลือกไฟล์รายการเดินบัญชี (PDF, Excel, CSV)</>}
          </Button>
          <button onClick={downloadTemplate} type="button"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 px-4 text-xs font-medium text-neutral-500 transition-colors hover:border-emerald-400 hover:text-emerald-700 sm:h-10">
            <Download className="h-3.5 w-3.5" />ไฟล์ตัวอย่าง
          </button>
        </div>
        <p className="text-xs leading-relaxed text-neutral-400">
          <b className="text-neutral-500">ปลอดภัย 100%:</b> ระบบแค่อ่านมาให้ดูก่อน — ไม่มีอะไรลงบัญชีจนกว่าคุณจะกดบันทึกทีละแถว ·
          โหลดไฟล์จากแอปธนาคารได้เลย ระบบเดาคอลัมน์วันที่/รายการ/เงินเข้าให้เอง
        </p>

        {note && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />{note}
          </p>
        )}

        {/* ⚠️ ขั้นยืนยันคอลัมน์ — ขั้นนี้ห้ามข้าม (8 ส.ค. 2569)
            ไฟล์ที่ลูกค้าเอามาไม่มีวันหน้าตาเหมือนกัน ระบบเดาให้ได้แต่ต้องให้คนตรวจก่อน
            เพราะเดาผิดแล้วเงียบ = ยอดผิดทั้งไฟล์โดยไม่มีใครรู้
            โชว์ตัวอย่าง 3 แถวแรกของคอลัมน์ที่เลือกไว้ด้วย จะได้เห็นด้วยตาว่าเลือกถูกไหม */}
        {headers.length > 0 && (
          <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
            <div>
              <p className="text-sm font-semibold text-neutral-800">ตรวจว่าคอลัมน์ตรงไหม</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {guessed
                  ? "ระบบเดาให้แล้วจากหัวตารางในไฟล์ — ดูตัวอย่างข้างล่างว่าตรงไหม แล้วกดอ่านรายการ"
                  : "ไฟล์นี้หัวตารางไม่ตรงแบบที่ระบบรู้จัก เลือกเองว่าคอลัมน์ไหนคืออะไร"}
              </p>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {([
                ["date", "วันที่ *"],
                ["amountIn", "ยอดเงินเข้า *"],
                ["desc", "รายละเอียด"],
              ] as const).map(([field, label]) => (
                <div key={field}>
                  <label className="text-xs font-medium text-neutral-600">{label}</label>
                  <select
                    className="mt-1 h-11 w-full rounded-xl border border-neutral-300 bg-white px-2.5 text-sm"
                    value={map[field]}
                    onChange={(e) => setMap((m) => ({ ...m, [field]: Number(e.target.value) }))}>
                    <option value={-1}>— ไม่มีในไฟล์ —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>{h.trim() || `คอลัมน์ที่ ${i + 1}`}</option>
                    ))}
                  </select>
                  <p className="mt-1 truncate text-xs text-neutral-400">
                    {map[field] >= 0
                      ? `ตัวอย่าง: ${dataRows.slice(0, 3).map((r) => String(r[map[field]] ?? "").trim()).filter(Boolean).join(" · ") || "(ว่าง)"}`
                      : "ยังไม่ได้เลือก"}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={applyMapping}>อ่านรายการตามนี้</Button>
              <Button size="sm" variant="outline" onClick={() => { setHeaders([]); setDataRows([]); setError(null); }}>ยกเลิก</Button>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {rows.map((row) => (
              <div key={row.idx} className="rounded-xl border border-neutral-100 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-emerald-700">+{baht(row.amount)}</span>
                    <span className="ml-2 text-xs text-neutral-400">{row.date} {row.desc}</span>
                  </div>
                  {row.done ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3.5 w-3.5" /> บันทึกแล้ว</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select className="h-8 rounded-lg border border-neutral-300 px-2 text-xs"
                        value={row.docId}
                        onChange={(e) => setRows((rs) => rs.map((x) => x.idx === row.idx ? { ...x, docId: e.target.value } : x))}>
                        <option value="">ไม่ผูกเอกสาร</option>
                        {invoices.map((iv) => (
                          <option key={iv.docId} value={iv.docId}>{iv.docNumber} ค้าง {baht(iv.outstanding)}</option>
                        ))}
                      </select>
                      <Button size="sm" disabled={pending} onClick={() => confirmRow(row)}>
                        {savingIdx === row.idx ? <><Loader2 className="h-3 w-3 animate-spin" />กำลังบันทึก</> : "บันทึก"}
                      </Button>
                    </div>
                  )}
                </div>
                {row.matched && !row.done && <p className="mt-0.5 text-xs text-emerald-600">จับคู่อัตโนมัติ: {row.matched.docNumber} ({row.matched.contact ?? "-"})</p>}
                {row.error && <p className="mt-0.5 text-xs text-red-500">{row.error}</p>}
              </div>
            ))}
          </div>
        )}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
