"use client";
// ============================================================
//  นำเข้าเลขพัสดุแบบชุด — ไฟล์ Excel/CSV หรือรูป/PDF ฉลากพัสดุ (AI อ่าน)
//  พรีวิวจับคู่ก่อนยืนยันเสมอ -> bulkMarkShipped แจ้งลูกค้าอัตโนมัติ
// ============================================================
import { useRef, useState, useTransition } from "react";
import { FileUp, X, Loader2 } from "lucide-react";
import { bulkMarkShipped, type TrackingRow } from "../actions";
import { useRouter } from "next/navigation";

interface PreviewRow {
  orderNumber: string;   // ค่าที่จะใช้จริง (แก้ได้)
  tracking: string;
  source: string;        // ที่มา: ไฟล์/AI + วิธีจับคู่
  known: boolean;        // เจอในรายการออเดอร์รอจัดส่งไหม (แค่คำใบ้ — server ตรวจจริงอีกที)
}

// map หัวคอลัมน์ไทย/อังกฤษ (pattern เดียวกับ products/import)
const ORDER_HEADERS = ["order", "order_number", "ออเดอร์", "เลขออเดอร์", "หมายเลขออเดอร์", "เลขที่ออเดอร์", "no"];
const TRACK_HEADERS = ["tracking", "tracking_number", "เลขพัสดุ", "แทรค", "แทรคกิ้ง", "เลขขนส่ง", "awb"];

export default function TrackingImportModal({ shopId, openOrderNumbers }: {
  shopId: string;
  openOrderNumbers: string[]; // ออเดอร์สถานะ paid/confirmed สำหรับคำใบ้จับคู่ + dropdown
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ shipped: number; skipped: { orderNumber: string; reason: string }[] } | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const knownSet = new Set(openOrderNumbers.map((n) => n.trim().toLowerCase()));

  function reset() {
    setRows([]); setErr(null); setResult(null); setBusy(false);
  }

  async function handleFile(file: File) {
    setErr(null); setResult(null); setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (["csv", "xlsx", "xls"].includes(ext)) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
        if (aoa.length < 2) { setErr("ไฟล์ว่าง หรือไม่มีข้อมูล (ต้องมีหัวตาราง + อย่างน้อย 1 แถว)"); return; }
        const headers = (aoa[0] as unknown[]).map((h) => String(h).trim().toLowerCase());
        const oi = headers.findIndex((h) => ORDER_HEADERS.some((k) => h.includes(k)));
        const ti = headers.findIndex((h) => TRACK_HEADERS.some((k) => h.includes(k)));
        if (oi < 0 || ti < 0) {
          setErr('ไม่พบคอลัมน์ที่ต้องใช้ — หัวตารางต้องมี "เลขออเดอร์" และ "เลขพัสดุ" (หรือ order / tracking)');
          return;
        }
        const parsed: PreviewRow[] = aoa.slice(1)
          .map((r) => ({
            orderNumber: String((r as unknown[])[oi] ?? "").trim(),
            tracking: String((r as unknown[])[ti] ?? "").trim(),
            source: "ไฟล์",
            known: knownSet.has(String((r as unknown[])[oi] ?? "").trim().toLowerCase()),
          }))
          .filter((r) => r.orderNumber && r.tracking)
          .slice(0, 200);
        if (!parsed.length) { setErr("ไม่พบแถวที่มีทั้งเลขออเดอร์และเลขพัสดุ"); return; }
        setRows(parsed);
      } else if (["png", "jpg", "jpeg", "webp", "pdf"].includes(ext)) {
        const fd = new FormData();
        fd.set("shop_id", shopId);
        fd.set("file", file);
        const res = await fetch("/api/orders/tracking-extract", { method: "POST", body: fd });
        const j = await res.json();
        if (!j.ok) { setErr(j.error ?? "อ่านไฟล์ไม่สำเร็จ"); return; }
        const parsed: PreviewRow[] = (j.rows as {
          tracking_number: string; matched_order_number?: string; order_number?: string; customer_name?: string; match_by?: string;
        }[]).map((r) => ({
          orderNumber: r.matched_order_number ?? r.order_number ?? "",
          tracking: r.tracking_number,
          source: r.match_by === "name" ? `AI (จับคู่จากชื่อ: ${r.customer_name})`
            : r.match_by === "phone" ? "AI (จับคู่จากเบอร์)"
            : r.match_by === "order_number" ? "AI (เลขออเดอร์ตรง)"
            : `AI${r.customer_name ? ` (ผู้รับ: ${r.customer_name})` : ""} — เลือกออเดอร์เอง`,
          known: !!r.matched_order_number,
        })).slice(0, 200);
        if (!parsed.length) { setErr("AI อ่านไม่พบเลขพัสดุในไฟล์ — ลองถ่ายให้ชัดขึ้น หรือกรอกเอง"); return; }
        setRows(parsed);
      } else {
        setErr("รองรับ: Excel (.xlsx/.xls), CSV, รูป (PNG/JPG/WebP), PDF");
      }
    } catch {
      setErr("อ่านไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function confirm() {
    setErr(null);
    const payload: TrackingRow[] = rows
      .filter((r) => r.orderNumber && r.tracking)
      .map((r) => ({ orderNumber: r.orderNumber, tracking: r.tracking }));
    if (!payload.length) { setErr("ไม่มีแถวที่พร้อมนำเข้า — ทุกแถวต้องมีเลขออเดอร์"); return; }
    start(async () => {
      const r = await bulkMarkShipped(shopId, payload);
      if (!r.ok) { setErr(r.error); return; }
      setResult({ shipped: r.shipped, skipped: r.skipped });
      setRows([]);
      router.refresh();
    });
  }

  return (
    <>
      <button onClick={() => { reset(); setOpen(true); }}
        className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
        <FileUp className="h-4 w-4" /> นำเข้าเลขพัสดุ
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">นำเข้าเลขพัสดุแบบชุด</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              ไฟล์ Excel/CSV (คอลัมน์ เลขออเดอร์ + เลขพัสดุ) หรือรูป/PDF ฉลากพัสดุให้ AI อ่าน — ระบบแจ้งลูกค้าอัตโนมัติทุกออเดอร์ที่บันทึก
            </p>

            {result ? (
              <div className="mt-4 space-y-3">
                <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  ✓ บันทึกจัดส่ง + แจ้งลูกค้าแล้ว {result.shipped} ออเดอร์
                </p>
                {result.skipped.length > 0 && (
                  <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
                    <p className="font-medium">ข้าม {result.skipped.length} รายการ:</p>
                    <ul className="mt-1 list-inside list-disc">
                      {result.skipped.map((s, i) => <li key={i}>{s.orderNumber} — {s.reason}</li>)}
                    </ul>
                  </div>
                )}
                <button onClick={() => setOpen(false)} className="w-full rounded-xl bg-neutral-900 py-2.5 text-sm font-medium text-white hover:bg-neutral-700">ปิด</button>
              </div>
            ) : rows.length === 0 ? (
              <div className="mt-4">
                <button disabled={busy} onClick={() => inputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-neutral-200 py-10 text-neutral-400 hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-50">
                  {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
                  <span className="text-sm">{busy ? "กำลังอ่านไฟล์..." : "เลือกไฟล์ Excel/CSV หรือรูปฉลากพัสดุ"}</span>
                  <span className="text-[11px]">รูป/PDF ไม่เกิน 4MB</span>
                </button>
                <input ref={inputRef} type="file" hidden accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="max-h-72 overflow-y-auto rounded-xl border border-neutral-100">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-neutral-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-neutral-500">ออเดอร์</th>
                        <th className="px-3 py-2 text-left font-medium text-neutral-500">เลขพัสดุ</th>
                        <th className="px-3 py-2 text-left font-medium text-neutral-500">ที่มา</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-t border-neutral-50">
                          <td className="px-3 py-1.5">
                            {r.known ? (
                              <span className="font-medium text-emerald-700">{r.orderNumber}</span>
                            ) : (
                              <select value={r.orderNumber}
                                onChange={(e) => setRows((prev) => prev.map((x, j) => j === i ? { ...x, orderNumber: e.target.value, known: !!e.target.value } : x))}
                                className="h-7 rounded-lg border border-amber-300 bg-amber-50 px-1.5 text-xs outline-none">
                                <option value="">— เลือกออเดอร์ —</option>
                                {r.orderNumber && !openOrderNumbers.includes(r.orderNumber) && <option value={r.orderNumber}>{r.orderNumber} (ตามไฟล์)</option>}
                                {openOrderNumbers.map((n) => <option key={n} value={n}>{n}</option>)}
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-1.5 font-mono">{r.tracking}</td>
                          <td className="px-3 py-1.5 text-neutral-400">{r.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  <button onClick={confirm} disabled={pending}
                    className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                    {pending ? "กำลังบันทึก..." : `ยืนยันจัดส่ง ${rows.filter((r) => r.orderNumber).length} ออเดอร์ + แจ้งลูกค้า`}
                  </button>
                  <button onClick={reset} className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50">เลือกไฟล์ใหม่</button>
                </div>
              </div>
            )}
            {err && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{err}</p>}
          </div>
        </div>
      )}
    </>
  );
}
