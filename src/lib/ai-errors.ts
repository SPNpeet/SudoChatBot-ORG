// ==== แปลง error จากค่าย AI เป็นภาษาไทยที่ชี้ทางแก้ได้ ====
// ใช้ทั้งหน้า ศูนย์ AI (ทดสอบ key), Playground และ import สินค้า

/** ดึงรหัส HTTP จากข้อความ error รูปแบบ "provider 401: {...}" */
function statusOf(raw: string): number | null {
  const m = raw.match(/\b(4\d{2}|5\d{2})\b/);
  return m ? Number(m[1]) : null;
}

export function friendlyAiError(raw: string): string {
  const s = raw.toLowerCase();
  const status = statusOf(raw);

  if (status === 401 || s.includes("incorrect api key") || s.includes("invalid_api_key") ||
      s.includes("authentication_error") || s.includes("invalid x-api-key") || s.includes("api key not valid") ||
      s.includes("unauthorized")) {
    return "API key ไม่ถูกต้องหรือถูกยกเลิกแล้ว — เข้าเว็บของค่ายนั้น สร้าง key ใหม่ แล้วกลับมาวางอีกครั้ง (กด \"เปลี่ยน key\")";
  }
  if (status === 402 || s.includes("insufficient_quota") || s.includes("insufficient balance") ||
      s.includes("exceeded your current quota") || s.includes("billing")) {
    return "บัญชีของค่าย AI นี้ไม่มีเครดิต/ยังไม่ผูกบัตร — เติมเงินหรือผูกบัตรในเว็บของค่ายก่อน แล้วลองใหม่";
  }
  if (status === 429 || s.includes("rate limit") || s.includes("rate_limit")) {
    return "เรียกถี่เกินโควตาของค่าย (rate limit) — รอ 1-2 นาทีแล้วลองใหม่ ถ้าเจอบ่อยให้อัปเกรดแพ็กเกจกับค่ายนั้น";
  }
  if (status === 403 || s.includes("permission")) {
    return "key นี้ไม่มีสิทธิ์ใช้โมเดลที่เลือก — เช็คสิทธิ์ของ key ในเว็บค่าย หรือเลือกโมเดลอื่น";
  }
  if (status === 404 || s.includes("model_not_found") || s.includes("not found")) {
    return "ไม่พบโมเดลนี้ในบัญชีของคุณ — เลือกโมเดลอื่นในเมนู แล้วทดสอบอีกครั้ง";
  }
  if (status !== null && status >= 500) {
    return "ระบบฝั่งค่าย AI ขัดข้องชั่วคราว — รอสักครู่แล้วลองใหม่ (ไม่ใช่ปัญหาที่ key ของคุณ)";
  }
  if (s.includes("fetch failed") || s.includes("econnrefused") || s.includes("network") || s.includes("timeout") || s.includes("timed out")) {
    return "เชื่อมต่อค่าย AI ไม่ได้ (เครือข่ายขัดข้อง) — ลองใหม่อีกครั้ง";
  }
  // ไม่รู้จัก: ตัดให้สั้น อ่านรู้เรื่อง
  return `เกิดข้อผิดพลาดจากค่าย AI: ${raw.slice(0, 160)}`;
}
