// ชื่อแพ็กภาษาไทยตามรหัส — ไฟล์ข้อมูลล้วน ไม่ import อะไรเลย
//
// ⚠️ ทำไมต้องแยกไฟล์ (30 ส.ค. 2569): เดิม export จาก plans.ts ซึ่ง import supabase server
// พอ client component (ai-quota-bar) ดึงไป build ล้มทั้งระบบด้วย error "next/headers"
// ไฟล์นี้จึงต้องสะอาดจาก dependency ตลอดไป — ใครมาเติม import ที่นี่ = พังแบบเดิมซ้ำ
//
// แหล่งความจริงเดียว: FALLBACK ใน plans.ts อ้างชื่อจากแมปนี้ ห้ามพิมพ์ชื่อซ้ำสองที่
export const PLAN_NAME_TH: Record<string, string> = {
  free: "ทดลองใช้",
  starter: "เริ่มต้น",
  professional: "ธุรกิจ",
  executive: "สำนักงานบัญชี",
  agency: "สำนักงานบัญชีใหญ่",
};
