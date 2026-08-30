// มาสคอต "น้องซูโด้" — วาดเป็น SVG ในโค้ดล้วน (30 ส.ค. 2569 เจ้าของขอให้มีตามภาพอ้างอิง)
//
// หลักการวาด: เรขาคณิตเรียบ โทนสีแบรนด์เท่านั้น ไม่มีไล่เฉดฉูดฉาด
// ใช้ประกอบ "จุดต้อนรับ" เท่านั้น (hero แชท/หน้า login/การ์ดอัปเกรด) ไม่โปรยทั่วแอป
// — ภาพประกอบที่โผล่ทุกหน้าจะกลายเป็นเสียงรบกวน ไม่ใช่บุคลิก
//
// ⚠️ ต้องมี aria-hidden เสมอ: เป็นของตกแต่ง โปรแกรมอ่านหน้าจอไม่ควรเสียเวลากับมัน
export default function Mascot({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true" className={className}>
      {/* เงาพื้น */}
      <ellipse cx="48" cy="88" rx="26" ry="5" fill="#0F1311" opacity="0.08" />
      {/* ตัว */}
      <rect x="26" y="52" width="44" height="32" rx="14" fill="#FFFFFF" stroke="#0F1311" strokeWidth="2.5" />
      {/* ป้ายเครื่องหมายบัญชีบนอก — เล่าว่าเป็นผู้ช่วยบัญชี ไม่ใช่หุ่นทั่วไป */}
      <rect x="40" y="60" width="16" height="12" rx="3" fill="#ECFDF5" stroke="#047857" strokeWidth="2" />
      <path d="M43.5 66l2.5 2.5 6-5" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* แขน */}
      <path d="M26 62c-6 1-9 5-9 10" stroke="#0F1311" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M70 62c6 1 9 5 9 10" stroke="#0F1311" strokeWidth="2.5" strokeLinecap="round" />
      {/* หัว */}
      <rect x="20" y="14" width="56" height="40" rx="18" fill="#FFFFFF" stroke="#0F1311" strokeWidth="2.5" />
      {/* จอหน้า */}
      <rect x="27" y="21" width="42" height="26" rx="12" fill="#0F1311" />
      {/* ตา */}
      <circle cx="41" cy="33" r="4" fill="#34D399" />
      <circle cx="55" cy="33" r="4" fill="#34D399" />
      {/* ยิ้ม */}
      <path d="M42 40c2 2.5 10 2.5 12 0" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" />
      {/* เสาอากาศ */}
      <path d="M48 14V8" stroke="#0F1311" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="48" cy="6" r="3.5" fill="#047857" />
      {/* หูสองข้าง */}
      <rect x="14" y="28" width="6" height="12" rx="3" fill="#047857" />
      <rect x="76" y="28" width="6" height="12" rx="3" fill="#047857" />
    </svg>
  );
}
