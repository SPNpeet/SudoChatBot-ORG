// ============================================================
//  บันทึกไฟล์ลงเครื่องผู้ใช้ — ที่เดียวของทั้งระบบ
//
//  ⚠️ ทำไมต้องมีไฟล์นี้ (9 ส.ค. 2569)
//  เจ้าของแจ้งว่าบนมือถือ "ส่งรายงานไม่ได้เลยสักใบ" — ไล่ดูแล้วพบว่าโค้ดโหลดไฟล์
//  ถูกก๊อปไว้ 4 ที่ และทั้ง 4 ที่ทำ 2 อย่างที่พังเฉพาะบนมือถือ:
//
//    1. ไม่ได้เอา <a> ใส่ DOM ก่อนสั่ง click — element ที่ยังไม่อยู่ในเอกสาร
//       บางเบราว์เซอร์ไม่ยิง event ให้เลย (พฤติกรรมนี้ต่างกันในแต่ละเครื่อง)
//    2. เรียก revokeObjectURL ทันทีบรรทัดถัดจาก click — เดสก์ท็อปเริ่มโหลดทัน
//       จึงรอด แต่มือถือช้ากว่านั้น พอ URL ถูกเพิกถอนก่อน = กดแล้วเงียบสนิท
//       ไม่มี error ไม่มี toast ไม่มีอะไรเลย ผู้ใช้จึงสรุปว่า "ระบบส่งไม่ได้"
//
//  ⚠️ ห้ามเอา revokeObjectURL กลับไปไว้ติดกับ click อีก — นั่นคือตัวบั๊ก
//  ปล่อย URL ค้าง 1 นาทีแลกกับไฟล์ที่โหลดติดจริง เป็นการแลกที่คุ้มกว่ามาก
//
//  หมายเหตุที่ยังไม่ได้พิสูจน์: เบราว์เซอร์ในแอป (LINE/Facebook) บางรุ่นไม่ยอม
//  โหลด blob: เลยไม่ว่าเขียนถูกแค่ไหน — เคสนั้นต้องให้เซิร์ฟเวอร์ส่งไฟล์ตรง ๆ
//  ผ่าน URL แบบ GET (ดู saveFromUrl) ไม่ใช่แก้ที่ฝั่งเบราว์เซอร์
// ============================================================

/** เพิกถอน blob URL ช้า ๆ — เร็วกว่านี้แล้วมือถือโหลดไม่ทัน (ดูหมายเหตุหัวไฟล์) */
const REVOKE_AFTER_MS = 60_000;

/** สั่งเบราว์เซอร์บันทึกไฟล์จาก Blob ที่สร้างไว้แล้ว */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  try {
    triggerDownload(url, fileName);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
  }
}

/**
 * สั่งบันทึกไฟล์จาก URL ของเซิร์ฟเวอร์ตรง ๆ (endpoint ต้องตอบ Content-Disposition)
 * ทางนี้เชื่อถือได้กว่า blob บนมือถือ เพราะเป็นการโหลดไฟล์ปกติที่ระบบปฏิบัติการรับช่วงต่อได้
 */
export function saveFromUrl(url: string, fileName?: string) {
  triggerDownload(url, fileName);
}

function triggerDownload(url: string, fileName?: string) {
  const a = document.createElement("a");
  a.href = url;
  if (fileName) a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  // ต้องอยู่ใน DOM ตอนกด — เหตุผลข้อ 1 ในหมายเหตุหัวไฟล์
  document.body.appendChild(a);
  a.click();
  a.remove();
}
