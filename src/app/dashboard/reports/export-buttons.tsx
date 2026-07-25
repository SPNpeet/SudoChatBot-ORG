"use client";
// ปุ่มดาวน์โหลดรายงาน — Excel (SheetJS ในเครื่อง) และไฟล์ .txt โอนย้ายข้อมูลสรรพากร
// .txt เข้ารหัส TIS-620 (มาตรฐาน RD Prep อ่านภาษาไทยได้ตรง) + CRLF
import { Download, FileText, Lock, Loader2 } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { encodeTis620 } from "@/lib/rd";

export default function ExportButtons({ rows, xlsxName, txtName, txtContent, txtLocked }: {
  rows: Record<string, unknown>[];
  xlsxName: string;
  txtName?: string;
  txtContent?: string;
  txtLocked?: boolean;   // แพ็กเกจยังไม่ปลดล็อกไฟล์ยื่นสรรพากร
}) {
  const [busy, setBusy] = useState(false);

  async function downloadXlsx() {
    if (!rows.length) return;
    const { downloadSheet } = await import("@/lib/excel");
    await downloadSheet(rows, xlsxName);
  }

  function downloadTxt() {
    if (!txtContent) return;
    const bytes = encodeTis620(txtContent.replace(/\r?\n/g, "\r\n"));
    const blob = new Blob([bytes as unknown as BlobPart], { type: "text/plain;charset=TIS-620" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = txtName ?? "export.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {/* xlsx โหลดแบบ dynamic import (หลายร้อย KB) ถ้าไม่ล็อกไว้ กดรัว = ได้ไฟล์ซ้ำหลายใบ */}
      <button onClick={async () => { if (busy) return; setBusy(true); try { await downloadXlsx(); } finally { setBusy(false); } }}
        disabled={!rows.length || busy}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-xs text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {busy ? "กำลังสร้างไฟล์…" : "Excel"}
      </button>
      {txtName && (
        txtLocked ? (
          <Link href="/dashboard/billing" title="ไฟล์ยื่นสรรพากรปลดล็อกในแพ็ก AI Executive ขึ้นไป"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-xs text-amber-700 hover:bg-amber-100">
            <Lock className="h-3.5 w-3.5" /> ไฟล์ยื่น .txt — อัปเกรด
          </Link>
        ) : (
          <button onClick={downloadTxt} disabled={!txtContent}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-xs text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40">
            <FileText className="h-3.5 w-3.5" /> ไฟล์ยื่นสรรพากร (.txt)
          </button>
        )
      )}
    </div>
  );
}
