// ==== PromptPay QR (มาตรฐาน EMVCo ของธนาคารแห่งประเทศไทย) ====

function tlv(id: string, value: string): string {
  return id + value.length.toString().padStart(2, "0") + value;
}

function crc16(payload: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * สร้าง payload PromptPay แบบ dynamic (ระบุจำนวนเงิน)
 * @param target เบอร์โทร (0812345678) หรือเลขบัตรประชาชน 13 หลัก หรือ e-wallet 15 หลัก
 */
export function promptPayPayload(target: string, amountTHB: number): string {
  const digits = target.replace(/[^0-9]/g, "");
  let accountTag: string;
  if (digits.length === 13) accountTag = tlv("02", digits);            // บัตรประชาชน
  else if (digits.length === 15) accountTag = tlv("03", digits);       // e-wallet
  else accountTag = tlv("01", "0066" + digits.replace(/^0/, ""));      // เบอร์โทร
  const merchantInfo = tlv("29", tlv("00", "A000000677010111") + accountTag);
  const amount = amountTHB.toFixed(2);
  let payload =
    tlv("00", "01") +          // Payload format
    tlv("01", "12") +          // Dynamic QR (ครั้งเดียว)
    merchantInfo +
    tlv("53", "764") +         // สกุลเงิน THB
    tlv("54", amount) +
    tlv("58", "TH");
  payload += "6304";
  return payload + crc16(payload);
}
