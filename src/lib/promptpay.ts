// ==== PromptPay QR payload (มาตรฐาน EMVCo) — ใช้ทั้งหน้าเติมเงินและเอกสารขาย ====
function tlv(id: string, v: string) { return id + v.length.toString().padStart(2, "0") + v; }
function crc16(p: string) {
  let c = 0xffff;
  for (let i = 0; i < p.length; i++) { c ^= p.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = (c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1) & 0xffff; }
  return c.toString(16).toUpperCase().padStart(4, "0");
}
/** target = เบอร์ 10 หลัก / บัตรประชาชน 13 หลัก / e-wallet 15 หลัก */
export function promptPayPayload(target: string, amount: number) {
  const d = target.replace(/[^0-9]/g, "");
  const acct = d.length === 13 ? tlv("02", d) : d.length === 15 ? tlv("03", d) : tlv("01", "0066" + d.replace(/^0/, ""));
  let p = tlv("00", "01") + tlv("01", "12") + tlv("29", tlv("00", "A000000677010111") + acct) + tlv("53", "764") + tlv("54", amount.toFixed(2)) + tlv("58", "TH") + "6304";
  return p + crc16(p);
}
