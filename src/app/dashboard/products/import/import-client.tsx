"use client";
// ============================================================
//  นำเข้าสินค้าจากไฟล์ — Excel/CSV (parse ในเครื่อง แม่น 100%)
//  และ PDF/รูปแคตตาล็อก (AI อ่านผ่าน /api/products/import-extract)
//  ทุกเส้นทางจบที่ตารางพรีวิวแก้ไขได้ก่อนบันทึกจริง
// ============================================================
import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button, Card, CardContent, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { bulkImportProducts, type BulkRow } from "./actions";
import { FileSpreadsheet, FileText, Upload, CheckCircle2, X, ArrowLeft } from "lucide-react";

type Step = "pick" | "reading" | "preview" | "done";
interface PreviewRow extends BulkRow { include: boolean }

// ---- จับคู่หัวคอลัมน์อัตโนมัติ (ไทย/อังกฤษ) ----
const HEADER_SYNONYMS: Record<string, string[]> = {
  name: ["ชื่อสินค้า", "ชื่อ", "สินค้า", "รายการ", "name", "product", "title", "item"],
  price: ["ราคาขาย", "ราคา", "price", "บาท", "amount"],
  stock: ["สต๊อก", "สต็อก", "จำนวน", "คงเหลือ", "stock", "qty", "quantity"],
  sku: ["sku", "รหัสสินค้า", "รหัส", "code", "barcode"],
  category: ["หมวดหมู่", "หมวด", "ประเภท", "category", "type"],
  description: ["รายละเอียด", "คำอธิบาย", "จุดเด่น", "description", "desc", "detail"],
};
const FIELD_LABELS: Record<string, string> = {
  name: "ชื่อสินค้า *", price: "ราคา *", stock: "สต๊อก", sku: "SKU", category: "หมวดหมู่", description: "รายละเอียด",
};

function autoMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const low = String(h ?? "").trim().toLowerCase();
    if (!low) return;
    for (const [field, syns] of Object.entries(HEADER_SYNONYMS)) {
      if (map[field] !== undefined) continue;
      if (syns.some((s) => low === s || low.includes(s))) { map[field] = i; break; }
    }
  });
  return map;
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  return Number(String(v ?? "").replace(/[^0-9.\-]/g, "")) || 0;
}

export default function ImportClient({ shopId }: { shopId: string }) {
  const [step, setStep] = useState<Step>("pick");
  const [err, setErr] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [engine, setEngine] = useState<string | null>(null); // AI engine ที่ใช้ (pdf/รูป)
  // spreadsheet state
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  // preview state
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [skipDup, setSkipDup] = useState(true);
  const [asDraft, setAsDraft] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSheet = headers.length > 0;

  // ---- แปลง AOA + mapping -> พรีวิว (spreadsheet เปลี่ยน mapping แล้วคำนวณใหม่ได้) ----
  const sheetRows = useMemo<PreviewRow[]>(() => {
    if (!isSheet || mapping.name === undefined) return [];
    return dataRows
      .map((r) => ({
        include: true,
        name: String(r[mapping.name] ?? "").trim(),
        price: mapping.price !== undefined ? toNumber(r[mapping.price]) : 0,
        stock: mapping.stock !== undefined ? Math.max(0, Math.floor(toNumber(r[mapping.stock]))) : 0,
        sku: mapping.sku !== undefined ? String(r[mapping.sku] ?? "").trim() || undefined : undefined,
        category: mapping.category !== undefined ? String(r[mapping.category] ?? "").trim() || undefined : undefined,
        description: mapping.description !== undefined ? String(r[mapping.description] ?? "").trim() || undefined : undefined,
      }))
      .filter((r) => r.name)
      .slice(0, 300);
  }, [isSheet, dataRows, mapping]);
  const previewRows = isSheet ? sheetRows : rows;
  const setPreviewRow = (i: number, patch: Partial<PreviewRow>) => {
    // spreadsheet แก้ผ่าน state rows แยก เพื่อไม่ชน useMemo — สลับเข้าโหมด manual เมื่อแก้ครั้งแรก
    if (isSheet) { setHeaders([]); setDataRows([]); setRows(sheetRows.map((r, j) => (j === i ? { ...r, ...patch } : r))); }
    else setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  async function handleFile(file: File) {
    setErr(null); setFileName(file.name); setEngine(null);
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (["csv", "xlsx", "xls"].includes(ext)) {
      try {
        setStep("reading");
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
        const nonEmpty = aoa.filter((r) => r.some((c) => String(c ?? "").trim()));
        if (nonEmpty.length < 2) { setErr("ไฟล์ว่างหรือมีแต่หัวตาราง — ต้องมีข้อมูลอย่างน้อย 1 แถว"); setStep("pick"); return; }
        const hd = nonEmpty[0].map((h) => String(h ?? ""));
        setHeaders(hd); setDataRows(nonEmpty.slice(1)); setMapping(autoMap(hd)); setRows([]);
        setStep("preview");
      } catch {
        setErr("อ่านไฟล์ไม่สำเร็จ — เช็คว่าเป็นไฟล์ Excel/CSV จริง"); setStep("pick");
      }
    } else if (["pdf", "png", "jpg", "jpeg", "webp"].includes(ext)) {
      try {
        setStep("reading");
        const fd = new FormData();
        fd.append("shop_id", shopId);
        fd.append("file", file);
        const res = await fetch("/api/products/import-extract", { method: "POST", body: fd });
        const j = await res.json();
        if (!j.ok) { setErr(j.error ?? "อ่านไฟล์ไม่สำเร็จ"); setStep("pick"); return; }
        if (!j.rows?.length) { setErr("AI อ่านไฟล์แล้วแต่ไม่พบรายการสินค้า — เช็คว่าไฟล์มีตาราง/รายการสินค้าจริง"); setStep("pick"); return; }
        setHeaders([]); setDataRows([]);
        setRows((j.rows as BulkRow[]).map((r) => ({ ...r, include: true })));
        setEngine(j.engine ?? null);
        setStep("preview");
      } catch {
        setErr("เชื่อมต่อไม่สำเร็จ — ลองใหม่อีกครั้ง"); setStep("pick");
      }
    } else {
      setErr("รองรับ: Excel (.xlsx/.xls), CSV, PDF, รูปภาพ (PNG/JPG/WebP)");
    }
  }

  function doImport() {
    const chosen = previewRows.filter((r) => r.include && r.name.trim());
    if (!chosen.length) { setErr("เลือกอย่างน้อย 1 รายการ"); return; }
    setErr(null);
    start(async () => {
      const r = await bulkImportProducts(shopId, chosen.map(({ include: _include, ...rest }) => rest), { skipDuplicates: skipDup, asDraft });
      if (!r.ok) { setErr(r.error); return; }
      setResult({ imported: r.imported, skipped: r.skipped });
      setStep("done");
    });
  }

  const includedCount = previewRows.filter((r) => r.include && r.name.trim()).length;

  // ================= UI =================
  if (step === "done" && result) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <p className="mt-3 text-lg font-bold">นำเข้าสำเร็จ {result.imported} รายการ</p>
          {result.skipped > 0 && <p className="mt-1 text-sm text-neutral-400">ข้ามชื่อซ้ำ {result.skipped} รายการ</p>}
          <div className="mt-5 flex gap-2">
            <Link href="/dashboard/products"><Button>ดูสินค้าทั้งหมด</Button></Link>
            <Button variant="outline" onClick={() => { setStep("pick"); setRows([]); setResult(null); }}>นำเข้าไฟล์อื่นต่อ</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "pick" || step === "reading") {
    return (
      <Card>
        <CardContent className="py-8">
          <div
            className={cn("flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center",
              step === "reading" ? "border-emerald-300 bg-emerald-50/50" : "border-neutral-200 hover:border-emerald-400")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (step === "pick" && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          >
            {step === "reading" ? (
              <>
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                <p className="mt-3 text-sm font-medium">กำลังอ่าน {fileName}...</p>
                <p className="mt-1 text-xs text-neutral-400">PDF/รูป ใช้ AI อ่าน อาจใช้เวลาถึง 1 นาที</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-neutral-300" />
                <p className="mt-3 text-sm font-medium">ลากไฟล์มาวาง หรือกดเลือกไฟล์</p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-neutral-400">
                  <span className="flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> Excel / CSV — อ่านตรง แม่น 100%</span>
                  <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> PDF / รูปแคตตาล็อก — AI อ่านให้ (≤4MB)</span>
                </div>
                <Button className="mt-4" onClick={() => inputRef.current?.click()}>เลือกไฟล์</Button>
                <input ref={inputRef} type="file" hidden accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </>
            )}
          </div>
          {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
          <p className="mt-4 text-[11px] text-neutral-400">
            ตัวอย่างหัวตารางที่ระบบจับคู่ให้อัตโนมัติ: ชื่อสินค้า · ราคา · สต๊อก · SKU · หมวดหมู่ · รายละเอียด (สลับลำดับ/ภาษาอังกฤษก็ได้)
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---- preview ----
  return (
    <div className="space-y-4">
      {/* mapping (เฉพาะ spreadsheet) */}
      {isSheet && (
        <Card>
          <CardContent className="pt-5">
            <p className="mb-2 text-sm font-medium">จับคู่คอลัมน์จากไฟล์ &ldquo;{fileName}&rdquo; (ระบบเดาให้แล้ว — แก้ได้)</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {Object.keys(FIELD_LABELS).map((f) => (
                <div key={f}>
                  <p className="mb-1 text-[11px] text-neutral-400">{FIELD_LABELS[f]}</p>
                  <Select value={mapping[f] ?? -1}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMapping((m) => {
                        const next = { ...m };
                        if (v < 0) delete next[f]; else next[f] = v;
                        return next;
                      });
                    }}>
                    <option value={-1}>— ไม่ใช้ —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `คอลัมน์ ${i + 1}`}</option>)}
                  </Select>
                </div>
              ))}
            </div>
            {mapping.name === undefined && <p className="mt-2 text-xs text-red-600">ต้องเลือกคอลัมน์ &ldquo;ชื่อสินค้า&rdquo; ก่อน</p>}
          </CardContent>
        </Card>
      )}

      {engine && (
        <p className="text-xs text-neutral-400">อ่านด้วย AI ({engine}) จาก &ldquo;{fileName}&rdquo; — ตรวจความถูกต้องก่อนบันทึกทุกครั้ง</p>
      )}

      <Card>
        <CardContent className="px-0 pb-0 pt-0">
          <div className="max-h-[26rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white shadow-[0_1px_0_0_#e5e5e5]">
                <tr className="text-left text-[11px] text-neutral-400">
                  <th className="px-3 py-2">
                    <input type="checkbox" checked={includedCount === previewRows.length && previewRows.length > 0}
                      onChange={(e) => {
                        const on = e.target.checked;
                        if (isSheet) { setHeaders([]); setDataRows([]); setRows(sheetRows.map((r) => ({ ...r, include: on }))); }
                        else setRows((rs) => rs.map((r) => ({ ...r, include: on })));
                      }} />
                  </th>
                  <th className="px-2 py-2">ชื่อสินค้า *</th><th className="px-2 py-2">SKU</th><th className="px-2 py-2">หมวด</th>
                  <th className="px-2 py-2">ราคา *</th><th className="px-2 py-2">สต๊อก</th><th className="px-2 py-2">รายละเอียด</th><th className="px-2 py-2">ตัวเลือกย่อย</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} className={cn("border-t border-neutral-50", !r.include && "opacity-40")}>
                    <td className="px-3 py-1.5"><input type="checkbox" checked={r.include} onChange={(e) => setPreviewRow(i, { include: e.target.checked })} /></td>
                    <td className="px-2 py-1.5"><Input value={r.name} onChange={(e) => setPreviewRow(i, { name: e.target.value })} className="h-8 min-w-40 text-xs" /></td>
                    <td className="px-2 py-1.5"><Input value={r.sku ?? ""} onChange={(e) => setPreviewRow(i, { sku: e.target.value || undefined })} className="h-8 w-24 text-xs" /></td>
                    <td className="px-2 py-1.5"><Input value={r.category ?? ""} onChange={(e) => setPreviewRow(i, { category: e.target.value || undefined })} className="h-8 w-24 text-xs" /></td>
                    <td className="px-2 py-1.5"><Input type="number" min={0} step="0.01" value={r.price} onChange={(e) => setPreviewRow(i, { price: Number(e.target.value) })} className="h-8 w-24 text-xs" /></td>
                    <td className="px-2 py-1.5"><Input type="number" min={0} value={r.stock ?? 0} onChange={(e) => setPreviewRow(i, { stock: Math.max(0, parseInt(e.target.value || "0", 10) || 0) })} className="h-8 w-20 text-xs" /></td>
                    <td className="px-2 py-1.5"><Input value={r.description ?? ""} onChange={(e) => setPreviewRow(i, { description: e.target.value || undefined })} className="h-8 min-w-44 text-xs" /></td>
                    <td className="px-2 py-1.5 text-[11px] text-sky-600">
                      {r.variants?.length ? `${r.variants.length} ตัวเลือก: ${r.variants.map((v) => v.name).join(", ").slice(0, 40)}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} /> ข้ามชื่อที่ซ้ำกับสินค้าเดิม</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={asDraft} onChange={(e) => setAsDraft(e.target.checked)} /> นำเข้าเป็นสถานะพักก่อน (ยังไม่ขึ้นตอนออกเอกสาร)</label>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setStep("pick"); setRows([]); setHeaders([]); setDataRows([]); setErr(null); }}>
            <X className="h-4 w-4" /> เริ่มใหม่
          </Button>
          <Button onClick={doImport} disabled={pending || includedCount === 0 || (isSheet && mapping.name === undefined)}>
            {pending ? "กำลังนำเข้า..." : `นำเข้า ${includedCount} รายการ`}
          </Button>
        </div>
      </div>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
      <Link href="/dashboard/products" className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700">
        <ArrowLeft className="h-3.5 w-3.5" /> กลับหน้าสินค้า
      </Link>
    </div>
  );
}
