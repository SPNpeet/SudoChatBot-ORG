// ============================================================
//  อ่าน/เขียนไฟล์ตาราง — ฝั่งเบราว์เซอร์เรียกเซิร์ฟเวอร์ทำให้ ไม่มีไลบรารีหนักติดเครื่องผู้ใช้
//
//  เดิมใช้ xlsx (มีช่องโหว่ระดับสูงที่ไม่มี patch เพราะ SheetJS ออกจาก npm ไปแล้ว)
//  เคยลองย้ายมา exceljs ฝั่ง client แล้ววัดได้ว่าลากโค้ด zip ของ Node ติดไป 912 KB
//  ต่อผู้ใช้ทุกคน จึงย้ายงานหนักทั้งหมดไปที่ /api/sheet — ผู้ใช้โหลดเพิ่ม 0 KB
//
//  CSV ยังอ่านในเบราว์เซอร์เหมือนเดิม เพราะไวยากรณ์สั้น เขียนเองได้ครบและเร็วกว่าส่งขึ้นเซิร์ฟเวอร์
// ============================================================

import { saveBlob } from "@/lib/download";

export type SheetAoA = unknown[][];

/** แยกบรรทัด CSV โดยรองรับเครื่องหมายคำพูดและคอมมาในเซลล์ */
function parseCsv(text: string): SheetAoA {
  const rows: SheetAoA = [];
  let row: string[] = [];
  let cell = "";
  let inQuote = false;
  const s = text.replace(/^﻿/, "");   // ตัด BOM ที่ Excel ใส่มา

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuote) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }   // "" = เครื่องหมายคำพูดจริง
        else inQuote = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { inQuote = true; continue; }
    if (c === ",") { row.push(cell); cell = ""; continue; }
    if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    if (c === "\r") continue;
    cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** อ่านไฟล์ CSV/XLSX/XLS เป็น array of array — แถวแรกคือหัวตาราง */
export async function readSheet(file: File): Promise<SheetAoA> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    return parseCsv(await file.text());
  }
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/sheet?action=parse", { method: "POST", body: fd });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error ?? "อ่านไฟล์ไม่สำเร็จ");
  return j.rows as SheetAoA;
}

export interface SheetSpec { name: string; rows: Record<string, unknown>[] }

/**
 * สร้างไฟล์ Excel แล้วดาวน์โหลด — ใส่ได้หลายแท็บในไฟล์เดียว
 * (ใช้ทำ "ชุดส่งสำนักงานบัญชี" ที่รวมทุกรายงานของงวดไว้ในไฟล์เดียวส่งต่อได้เลย)
 */
export async function downloadWorkbook(sheets: SheetSpec[], fileName: string) {
  const usable = sheets.filter((s) => s.rows.length);
  if (!usable.length) throw new Error("ไม่มีข้อมูลให้ส่งออก");

  const res = await fetch("/api/sheet?action=build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, sheets: usable }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.error ?? "สร้างไฟล์ไม่สำเร็จ");
  }
  const blob = await res.blob();
  // ⚠️ อย่าเขียนขั้นตอนโหลดไฟล์เองตรงนี้ — ใช้ saveBlob ที่เดียว
  // เดิมเขียนเอง แล้ว revoke URL ทันทีหลัง click = บนมือถือโหลดไม่ติดเลยสักครั้ง
  saveBlob(blob, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}

/** ส่งออกแท็บเดียว — ทางลัดของ downloadWorkbook */
export async function downloadSheet(rows: Record<string, unknown>[], fileName: string, sheetName = "รายงาน") {
  await downloadWorkbook([{ name: sheetName, rows }], fileName);
}
