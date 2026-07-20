// ==== แปล error จาก Meta Marketing API เป็นไทยชี้ทางแก้ (สไตล์เดียวกับ ai-errors.ts) ====

export function friendlyAdsError(raw: string): string {
  const s = (raw ?? "").toLowerCase();

  if (s.includes("code\":190") || s.includes("session has expired") || s.includes("access token") && s.includes("expired")) {
    return "การเชื่อมต่อบัญชีโฆษณาหมดอายุแล้ว — กด \"เชื่อมต่อใหม่\" ที่หัวหน้านี้ (Meta ให้ token อายุ ~60 วัน)";
  }
  if (s.includes("code\":10") && s.includes("permission")) {
    return "แอปยังไม่มีสิทธิ์จัดการโฆษณาของบัญชีนี้ — เชื่อมต่อใหม่แล้วกดยอมรับสิทธิ์ ads_management";
  }
  if (s.includes("funding") || s.includes("payment method") || s.includes("no payment")) {
    return "บัญชีโฆษณายังไม่ผูกวิธีชำระเงิน — เข้า Meta Ads Manager > Billing เพิ่มบัตร แล้วลองใหม่ (ค่าแอดจ่ายตรงกับ Meta)";
  }
  if (s.includes("account_disabled") || s.includes("disabled") && s.includes("account")) {
    return "บัญชีโฆษณาถูก Meta ระงับ — เข้า Ads Manager เพื่อยื่นอุทธรณ์กับ Meta ก่อน";
  }
  if (s.includes("daily_budget") && (s.includes("minimum") || s.includes("too low") || s.includes("below"))) {
    return "งบต่อวันต่ำกว่าขั้นต่ำที่ Meta กำหนดสำหรับบัญชีนี้ — เพิ่มงบแล้วลองใหม่";
  }
  if (s.includes("rate limit") || s.includes("code\":17") || s.includes("too many calls")) {
    return "เรียก Meta ถี่เกินไป (rate limit) — รอ 5 นาทีแล้วลองใหม่";
  }
  if (s.includes("code\":100")) {
    return "Meta ปฏิเสธคำขอ (พารามิเตอร์ไม่ถูกต้อง) — ลองใหม่ ถ้ายังไม่ได้ให้แจ้งทีมงานผ่านปุ่มแนะนำ/ติชม";
  }
  return `ทำรายการกับ Meta ไม่สำเร็จ: ${raw.slice(0, 200)}`;
}
