import { cn } from "@/lib/utils";

// ============================================================
//  ⚠️ ต้องใช้ cn() ไม่ใช่ต่อสตริงเอง
//
//  บั๊กที่เกิดจริง (แก้ 30 ก.ค. 2569): หัวมือถือส่ง className="hidden sm:inline-flex"
//  เข้ามาเพื่อซ่อนโลโก้บนจอแคบ แต่ตัวคอมโพเนนต์มี inline-flex ติดมาด้วย
//  พอต่อสตริงเฉย ๆ จะได้ "inline-flex ... hidden sm:inline-flex" ซึ่ง CSS ตัดสินจาก
//  ลำดับในไฟล์สไตล์ ไม่ใช่ลำดับใน class — และในไฟล์จริง .inline-flex อยู่หลัง .hidden
//  (ตรวจจากไฟล์ที่ deploy แล้ว: .hidden ที่ตำแหน่ง 18219 · .inline-flex ที่ 18298)
//  ผลคือ hidden ไม่มีผลเลย โลโก้โผล่ทุกขนาดจอ ซ้อนกับรูปย่อที่หัวมือถือวางไว้แล้ว
//  = ผู้ใช้เห็นโลโก้สองอันซ้อนกันบนมือถือ
//
//  cn() ใช้ tailwind-merge ซึ่งรู้ว่า inline-flex กับ hidden เป็น utility กลุ่มเดียวกัน
//  แล้วให้ตัวหลังชนะตามที่ผู้เรียกตั้งใจ — กันพลาดแบบนี้ให้ทุกที่ที่เรียกใช้
// ============================================================
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="SudoChatBot" width={28} height={28} className="h-7 w-7 rounded-lg object-cover" />
      <span className="text-[15px] font-bold tracking-tight text-neutral-900">Sudo<span className="text-emerald-600">ChatBot</span></span>
    </span>
  );
}
