"use client";
// ============================================================
//  บีบอัดรูปฝั่งเบราว์เซอร์ก่อนอัปโหลด (ไม่ใช้ไลบรารีเพิ่ม — canvas ล้วน)
//  เป้าหมาย: สลิป/บิล/รูปสินค้า เหลือ ~ไม่เกิน 300KB เป็น JPEG
//  ประหยัด Supabase Storage (1GB เก็บสลิปได้เป็นแสนใบ) และอัปโหลดไวขึ้นบนมือถือ
//  PDF/ไฟล์ไม่ใช่รูป/รูปที่เล็กอยู่แล้ว = คืนไฟล์เดิมไม่แตะต้อง
// ============================================================

const TARGET_KB = 300;
const MAX_DIM = 1600; // พอสำหรับ OCR/EasySlip อ่านชัด

export async function compressImage(file: File): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
    if (file.size <= TARGET_KB * 1024) return file;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // พื้นหลังขาวกันรูป PNG โปร่งใสกลายเป็นดำตอนแปลง JPEG
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    // ลดคุณภาพทีละขั้นจนต่ำกว่าเป้า (หรือถึงพื้น 0.5)
    for (const q of [0.8, 0.7, 0.6, 0.5]) {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
      if (!blob) break;
      if (blob.size <= TARGET_KB * 1024 || q === 0.5) {
        if (blob.size >= file.size) return file; // บีบแล้วใหญ่กว่าเดิม (เจอได้กับ jpeg ที่บีบมาแล้ว) — ใช้ของเดิม
        const name = file.name.replace(/\.(png|webp|jpeg|jpg|heic|heif)$/i, "") + ".jpg";
        return new File([blob], name, { type: "image/jpeg" });
      }
    }
    return file;
  } catch {
    return file; // บีบไม่ได้ (เบราว์เซอร์เก่า/ไฟล์แปลก) — อัปโหลดของเดิม
  }
}
