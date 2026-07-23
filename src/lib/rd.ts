// ============================================================
//  มาตรฐานไฟล์โอนย้ายข้อมูลกรมสรรพากร (RD Prep)
//  - คั่นคอลัมน์ด้วย pipe | เท่านั้น
//  - ล้างอักขระต้องห้ามในข้อมูล (| ขึ้นบรรทัด แท็บ) กันคอลัมน์เพี้ยน
//  - วันที่ DD/MM/YYYY พุทธศักราช
//  - เข้ารหัสไฟล์ TIS-620 (มาตรฐานภาษาไทยของโปรแกรมสรรพากร)
// ============================================================

/** ล้างข้อความก่อนลงไฟล์ RD: ตัด pipe/ขึ้นบรรทัด/แท็บ + ยุบช่องว่างซ้ำ */
export function rdClean(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/[|\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** "2026-07-23" -> "23/07/2569" (พ.ศ.) */
export function rdDateBE(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear() + 543;
  return `${dd}/${mm}/${yyyy}`;
}

/** จำนวนเงินบนไฟล์ RD: ทศนิยม 2 ตำแหน่ง ไม่มีคอมมา */
export function rdAmount(n: number | string | null | undefined): string {
  return (Math.round(Number(n ?? 0) * 100) / 100).toFixed(2);
}

/**
 * เข้ารหัสข้อความเป็น TIS-620 (single-byte):
 * ASCII < 0x80 ตรงตัว · อักษรไทย U+0E01–U+0E5B -> 0xA1–0xFB · อื่น ๆ แทนด้วยช่องว่าง
 */
export function encodeTis620(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out[n++] = cp;
    else if (cp >= 0x0e01 && cp <= 0x0e5b) out[n++] = cp - 0x0e01 + 0xa1;
    else out[n++] = 0x20;
  }
  return out.slice(0, n);
}
