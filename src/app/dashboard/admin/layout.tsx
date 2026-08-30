// ============================================================
//  โซนผู้ดูแลแพลตฟอร์ม — แยกหน้าตาออกจากระบบร้านชัดเจน (30 ส.ค. 2569 คำสั่งเจ้าของ:
//  "ระบบ admin ต้องแยกออกมาให้ชัดเจนเป็นของมันเฉพาะไปเลย")
//
//  ทำไมต้องแยกให้เห็นด้วยตา ไม่ใช่แค่แยกด้วยสิทธิ์:
//  ข้อมูลในโซนนี้เป็น "ระดับแพลตฟอร์ม" (รายได้รวม ผู้ใช้ทุกร้าน คีย์ AI)
//  ส่วนหน้าอื่นเป็น "ระดับร้านเดียว" — สองโลกนี้หน้าตาเหมือนกันเมื่อไหร่
//  วันหนึ่งจะอ่านเลขแพลตฟอร์มนึกว่าเลขร้านตัวเอง (เจ้าของเองก็สลับสองบทบาทตลอด)
//  ธีมโซนนี้จึงเป็นแถบเข้ม + ป้าย "โหมดผู้ดูแล" ที่มองแวบเดียวรู้ว่าออกจากโลกร้านแล้ว
//
//  ⚠️ ด่านสิทธิ์จริงยังอยู่ที่ page แต่ละหน้า (is_platform_admin) — layout เป็นแค่เปลือก
//  แต่กันคนหลงทางไว้ชั้นหนึ่ง: ไม่ใช่แอดมินให้เด้งกลับตั้งแต่เปลือกเลย ไม่ต้องรอ page ปฏิเสธ
// ============================================================
import { isPlatformAdmin } from "@/lib/shop";
import { redirect } from "next/navigation";
import AdminTabs from "./admin-tabs";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isPlatformAdmin())) redirect("/dashboard");

  return (
    <div className="space-y-4">
      {/* แถบประจำโซน — สีเข้มตัดกับทั้งแอปที่เป็นพื้นขาว บอกว่ากำลังดูข้อมูลระดับแพลตฟอร์ม */}
      <div className="overflow-clip rounded-2xl bg-neutral-900 text-white">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15">
            <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-tight">ศูนย์ผู้ดูแลแพลตฟอร์ม</p>
            <p className="mt-0.5 text-xs text-neutral-400">
              ข้อมูลระดับแพลตฟอร์มทุกร้าน — ไม่ใช่ข้อมูลของกิจการที่เลือกอยู่ในเมนูซ้าย
            </p>
          </div>
          <Link href="/dashboard"
            className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white">
            กลับโหมดร้าน
          </Link>
        </div>
        <AdminTabs />
      </div>

      {children}
    </div>
  );
}
