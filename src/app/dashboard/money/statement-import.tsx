"use client";
// นำเข้า statement ธนาคาร (CSV/Excel) -> จับคู่เงินเข้ากับใบแจ้งหนี้ค้างรับ -> ยืนยันทีละแถว
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Check } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { baht } from "@/lib/utils";
import { recordPayment } from "../finance/actions";

interface InvoiceLite { docId: string; docNumber: string; contact: string | null; outstanding: number; due: string | null }
interface StmtRow { idx: number; date: string; desc: string; amount: number; matched?: InvoiceLite; docId: string; done?: boolean; error?: string }

export default function StatementImport({ shopId, invoices }: { shopId: string; invoices: InvoiceLite[] }) {
  const [rows, setRows] = useState<StmtRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFile(f: File) {
    setError(null);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (!raw.length) { setError("อ่านไฟล์ไม่ได้หรือไฟล์ว่าง"); return; }

      // เดาคอลัมน์: วันที่ / รายละเอียด / ยอดเงินเข้า (รองรับหัวตารางไทย-อังกฤษของธนาคารทั่วไป)
      const keys = Object.keys(raw[0]);
      const findKey = (cands: string[]) => keys.find((k) => cands.some((c) => k.toLowerCase().replace(/\s/g, "").includes(c)));
      const dateKey = findKey(["date", "วันที่", "วัน/เดือน/ปี"]) ?? keys[0];
      const descKey = findKey(["desc", "รายละเอียด", "รายการ", "detail", "memo", "หมายเหตุ", "channel"]) ?? keys[1];
      const inKey = findKey(["deposit", "credit", "ฝาก", "เงินเข้า", "รับ"]) ?? findKey(["amount", "จำนวนเงิน", "ยอด"]);

      const parsed: StmtRow[] = raw.map((r, i) => {
        const amtRaw = String(inKey ? r[inKey] : "").replace(/[^0-9.\-]/g, "");
        const amount = Math.round((Number(amtRaw) || 0) * 100) / 100;
        return { idx: i, date: String(r[dateKey] ?? "").slice(0, 20), desc: String(r[descKey] ?? "").slice(0, 80), amount, docId: "" };
      }).filter((r) => r.amount > 0).slice(0, 100);

      if (!parsed.length) { setError("ไม่พบแถวเงินเข้า (ยอด > 0) ในไฟล์ — เช็คว่ามีคอลัมน์ยอดเงินฝาก/เงินเข้า"); return; }

      // จับคู่ยอดตรงกับใบแจ้งหนี้ค้างรับ
      for (const row of parsed) {
        const exact = invoices.filter((iv) => Math.abs(iv.outstanding - row.amount) <= 0.01);
        if (exact.length === 1) { row.matched = exact[0]; row.docId = exact[0].docId; }
      }
      setRows(parsed);
    } catch {
      setError("อ่านไฟล์ไม่สำเร็จ — ใช้ไฟล์ CSV หรือ Excel จากธนาคาร");
    }
  }

  function confirmRow(row: StmtRow) {
    start(async () => {
      const r = await recordPayment(shopId, {
        doc_id: row.docId || null, direction: "in", method: "transfer",
        amount: row.amount, statement_ref: `stmt:${row.date}:${row.idx}`,
      });
      setRows((rs) => rs.map((x) => x.idx === row.idx
        ? { ...x, done: r.ok, error: r.ok ? undefined : r.error }
        : x));
      if (r.ok) router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>🏦 นำเข้า Statement ธนาคาร — กระทบยอดอัตโนมัติ</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
          <FileSpreadsheet className="h-4 w-4" /> เลือกไฟล์ Statement (CSV/Excel)
        </Button>
        <p className="text-xs text-neutral-400">
          ระบบอ่านแถวเงินเข้า จับคู่กับใบแจ้งหนี้ที่ยอดค้างตรงกันให้อัตโนมัติ — กดยืนยันทีละแถวเพื่อบันทึกรับเงิน
        </p>

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
                      <Button size="sm" disabled={pending} onClick={() => confirmRow(row)}>บันทึก</Button>
                    </div>
                  )}
                </div>
                {row.matched && !row.done && <p className="mt-0.5 text-[11px] text-emerald-600">จับคู่อัตโนมัติ: {row.matched.docNumber} ({row.matched.contact ?? "-"})</p>}
                {row.error && <p className="mt-0.5 text-[11px] text-red-500">{row.error}</p>}
              </div>
            ))}
          </div>
        )}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
