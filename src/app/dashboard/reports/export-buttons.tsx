"use client";
// ปุ่มดาวน์โหลดรายงาน — Excel (SheetJS ในเครื่อง) และไฟล์ .txt สำหรับยื่นภาษี
import { Download, FileText } from "lucide-react";

export default function ExportButtons({ rows, xlsxName, txtName, txtContent }: {
  rows: Record<string, unknown>[];
  xlsxName: string;
  txtName?: string;
  txtContent?: string;
}) {
  async function downloadXlsx() {
    if (!rows.length) return;
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายงาน");
    XLSX.writeFile(wb, xlsxName);
  }

  function downloadTxt() {
    if (!txtContent) return;
    // BOM เพื่อให้ Excel/โปรแกรมสรรพากรอ่านไทย UTF-8 ถูก
    const blob = new Blob(["﻿" + txtContent], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = txtName ?? "export.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex gap-1.5">
      <button onClick={downloadXlsx} disabled={!rows.length}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-40">
        <Download className="h-3.5 w-3.5" /> Excel
      </button>
      {txtName && (
        <button onClick={downloadTxt} disabled={!txtContent}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-40">
          <FileText className="h-3.5 w-3.5" /> ไฟล์ยื่น .txt
        </button>
      )}
    </div>
  );
}
