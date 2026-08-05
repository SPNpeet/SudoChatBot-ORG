// ============================================================
//  QR ชั้นฟรี — อ่าน mini-QR บนสลิปโอนเงินไทย (มาตรฐานตรวจสลิปของธนาคาร)
//
//  ทำหน้าที่เดียว: ดึง transRef ออกจากรูปสลิปโดยไม่เสียเงิน API
//  เพื่อกันสลิปซ้ำทั้งแพลตฟอร์ม (ตาราง slip_refs) ก่อนถึงด่าน SlipOK/EasySlip
//  = ประหยัดโควตาแพ็กฟรี 100 สลิป/เดือน และตัดสลิปเวียนทิ้งตั้งแต่ต้นทาง
//
//  ⚠️ กติกาความปลอดภัยของชั้นนี้: "ปฏิเสธได้ อนุมัติไม่ได้"
//  QR บอกได้แค่ว่ารูปนี้มีเลขอ้างอิงธุรกรรม — ไม่ได้พิสูจน์ว่าเงินเข้าจริง/ยอดเท่าไหร่
//  การอนุมัติยังต้องผ่าน API ธนาคาร (SlipOK/EasySlip) หรือคนยืนยันเสมอ
//  อ่าน QR ไม่ออก (รูปครอป/เบลอ) = ข้ามชั้นนี้เฉย ๆ ห้าม reject
// ============================================================
import jsQR from "jsqr";

export interface SlipQr {
  transRef: string;      // เลขอ้างอิงธุรกรรมจากธนาคารผู้โอน — unique ต่อการโอนหนึ่งครั้ง
  sendingBank: string;   // รหัสธนาคารผู้โอน 3 หลัก (เช่น 004 = กสิกร)
}

// CRC-16/CCITT-FALSE — สูตรเดียวกับ QR พร้อมเพย์ (EMVCo)
function crc16(p: string): string {
  let c = 0xffff;
  for (let i = 0; i < p.length; i++) {
    c ^= p.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) c = (c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1) & 0xffff;
  }
  return c.toString(16).toUpperCase().padStart(4, "0");
}

// TLV: [tag 2 หลัก][ความยาว 2 หลัก][ค่า] ต่อกันไปเรื่อย ๆ
function parseTlv(s: string): Map<string, string> | null {
  const out = new Map<string, string>();
  let i = 0;
  while (i + 4 <= s.length) {
    const tag = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    if (!/^\d\d$/.test(s.slice(i + 2, i + 4)) || i + 4 + len > s.length) return null;
    out.set(tag, s.slice(i + 4, i + 4 + len));
    i += 4 + len;
  }
  return i === s.length ? out : null;
}

/** แกะข้อความใน QR ว่าเป็น mini-QR สลิปธนาคารไทยหรือไม่ — ไม่ใช่คืน null เฉย ๆ */
export function parseSlipMiniQr(text: string): SlipQr | null {
  if (!/^[\x20-\x7E]+$/.test(text) || text.length < 20) return null;
  const root = parseTlv(text);
  if (!root) return null;

  // tag 91 = CRC ของทั้ง payload (รวม "9104") — สลิปจริงจากธนาคารต้องตรงเสมอ
  const crc = root.get("91");
  if (!crc || crc.toUpperCase() !== crc16(text.slice(0, text.length - 4))) return null;

  // tag 00 = กล่องข้อมูลธุรกรรม: 00=API ID "000001" · 01=รหัสธนาคารผู้โอน · 02=transRef
  const inner = root.get("00");
  if (!inner) return null;
  const tx = parseTlv(inner);
  if (!tx || tx.get("00") !== "000001") return null;
  const transRef = tx.get("02") ?? "";
  const sendingBank = tx.get("01") ?? "";
  if (!/^[A-Za-z0-9]{10,35}$/.test(transRef)) return null;
  return { transRef, sendingBank };
}

/**
 * อ่าน mini-QR จากรูปสลิป — คืน null เมื่ออ่านไม่ได้ไม่ว่าด้วยเหตุใด (ห้าม throw)
 * ลองสองขนาด: 1280 ก่อน (เร็ว ครอบคลุมสลิปส่วนใหญ่) แล้วค่อย 2048
 * เผื่อสลิปที่เป็นภาพแคปทั้งจอแล้ว QR เหลือเล็ก
 */
export async function decodeSlipQr(bytes: Uint8Array): Promise<SlipQr | null> {
  let sharp: (typeof import("sharp"))["default"];
  try {
    sharp = (await import("sharp")).default;
  } catch {
    return null;
  }
  // ⚠️ try ต้องอยู่ "ในลูป" ไม่ใช่ครอบทั้งลูป
  // บั๊กที่เจอตอนตรวจซ้ำ: รูปพังที่ขนาดแรกแล้ว throw -> ขนาดที่สองไม่ถูกลองเลย
  // ทั้งที่ขนาดที่สองมีไว้เพื่อกรณีแบบนั้นพอดี
  for (const width of [1280, 2048]) {
    try {
      const { data, info } = await sharp(Buffer.from(bytes), { failOn: "none" })
        .rotate()               // เคารพ EXIF — รูปถ่ายจากมือถือหมุนมาบ่อย
        .toColourspace("srgb")  // สลิปที่สแกนเป็นขาวดำมี 1 ช่องสี + ensureAlpha = 2 ช่อง
        .ensureAlpha()          // แต่ jsQR ต้องการ RGBA 4 ช่องเป๊ะ ไม่งั้นโยน "Malformed data"
        .raw()
        .toBuffer({ resolveWithObject: true });
      if (data.length !== info.width * info.height * 4) continue;  // กันไว้อีกชั้น ไม่ให้ jsQR โยน
      const code = jsQR(
        new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
        info.width, info.height,
      );
      if (code?.data) {
        const parsed = parseSlipMiniQr(code.data);
        if (parsed) return parsed;
      }
    } catch {
      // ขนาดนี้อ่านไม่ได้ ลองขนาดถัดไป — ชั้นนี้เป็นตัวช่วย ไม่ใช่ด่านบังคับ
    }
  }
  return null;
}
