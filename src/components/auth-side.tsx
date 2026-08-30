// แผงข้างของหน้า login/signup (เดสก์ท็อปเท่านั้น) — 30 ส.ค. 2569 ตามภาพอ้างอิงของเจ้าของ
//
// เดิมหน้า auth เป็นการ์ดเดี่ยวลอยกลางจอเปล่า จอ 1440px เหลือพื้นที่ว่างมหาศาล
// และคนที่มาจากโฆษณามักเข้าหน้านี้เป็นหน้าแรก — พื้นที่ครึ่งจอควรเล่าว่าระบบทำอะไรได้
// มือถือไม่แสดง (จอเล็กเอาไว้ให้ฟอร์ม) — ฟอร์มเดิมไม่ถูกแตะเลย แค่ถูกจัดที่ใหม่
import Mascot from "@/components/mascot";
import { FileText, ScanLine, Landmark } from "lucide-react";

const POINTS = [
  { icon: FileText, text: "ออกใบเสนอราคา ใบแจ้งหนี้ ใบกำกับภาษี — พิมพ์สั่งเป็นภาษาคนได้" },
  { icon: ScanLine, text: "ถ่ายรูปบิลแล้ว AI อ่าน แยก VAT และลงบัญชีให้ถูกหมวด" },
  { icon: Landmark, text: "สรุป ภ.พ.30 · ภ.ง.ด.3/53 พร้อมไฟล์ยื่นสรรพากรทุกเดือน" },
];

export default function AuthSide() {
  return (
    <div className="relative hidden flex-col justify-between overflow-clip rounded-3xl bg-neutral-900 p-10 text-white lg:flex">
      {/* วงแสงเขียวจาง ๆ ให้มีมิติ โดยไม่ต้องพึ่งภาพประกอบหนัก ๆ */}
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />

      <div>
        <p className="text-sm font-semibold text-emerald-400">SudoChatBot</p>
        <h2 className="mt-3 text-[26px] font-bold leading-snug tracking-tight">
          บัญชีทั้งกิจการ<br />จบด้วยการพิมพ์บอก AI
        </h2>
        <ul className="mt-8 space-y-4">
          {POINTS.map((p) => (
            <li key={p.text} className="flex items-start gap-3 text-sm leading-relaxed text-neutral-300">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-500/15">
                <p.icon className="h-3.5 w-3.5 text-emerald-400" />
              </span>
              {p.text}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-end justify-between gap-4">
        <p className="text-xs leading-relaxed text-neutral-500">
          ข้อมูลเข้ารหัสระหว่างทาง แยกรายกิจการที่ระดับฐานข้อมูล และสำรองอัตโนมัติทุกวัน
        </p>
        <Mascot size={104} className="shrink-0" />
      </div>
    </div>
  );
}
