// ============================================================
//  โครงหน้าระหว่างรอข้อมูล — Next โชว์ให้ทันทีที่กดเมนู (ไฟล์ loading.tsx)
//  ผู้ใช้เห็นรูปร่างหน้าเลย ไม่ใช่จอขาวค้าง = รู้สึกเร็วขึ้นมากทั้งที่เวลาจริงเท่าเดิม
//
//  ⚠️ กติกาสำคัญ: โครงกระดูกต้อง "สูงและกว้างเท่าของจริง"
//  โครงที่รูปร่างไม่ตรงหน้าจริง แย่กว่าไม่มีโครงเลย เพราะพอข้อมูลมาถึง
//  เนื้อหาจะกระโดด (Cumulative Layout Shift) ผู้ใช้ที่กำลังจะกดปุ่มจะกดพลาด
//
//  ของเดิมพลาด 2 อย่างที่แก้ในไฟล์นี้
//   1. ทุกหน้าใช้ ListSkeleton ตัวเดียวกันหมด ทั้งที่บางหน้าไม่มีกล่องคำแนะนำ
//      และบางหน้าไม่มีแถบตัวกรอง -> ส่วนเกินหายไปตอนโหลดเสร็จ เนื้อหาเลื่อนขึ้น
//   2. FormSkeleton ตั้ง max-w-3xl ไว้แต่ไม่มี mx-auto ขณะที่หน้าจริงจัดกลางแล้ว
//      -> โหลดเสร็จเนื้อหากระโดดจากซ้ายไปกลางจอ
// ============================================================
import { cn } from "@/lib/utils";

export function Bar({ className }: { className?: string }) {
  return <div className={cn("h-4 animate-pulse rounded-md bg-neutral-100 motion-reduce:animate-none", className)} />;
}

/** ส่วนหัวหน้า — ต้องตรงกับ <PageHeader> ทั้งความสูงและลำดับ */
function Head({ hint }: { hint?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Bar className="h-[26px] w-44" />
          <Bar className="h-4 w-56" />
        </div>
        <Bar className="h-11 w-full rounded-xl sm:w-36" />
      </div>
      {hint && <Bar className="h-[52px] w-full rounded-xl" />}
    </div>
  );
}

function Filters() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 4 }).map((_, i) => <Bar key={i} className="h-9 w-24 rounded-full" />)}
    </div>
  );
}

function Rows({ rows }: { rows: number }) {
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-neutral-50 px-4 py-3.5 last:border-0">
          <Bar className="w-28 shrink-0" />
          <Bar className="hidden flex-1 sm:block" />
          <Bar className="ml-auto w-20 shrink-0" />
          <Bar className="hidden w-16 shrink-0 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

/**
 * หน้าที่เป็นรายการ/ตาราง
 * @param head   หน้านี้มีหัวเรื่อง (PageHeader) ไหม
 * @param hint   หัวเรื่องมีกล่องคำแนะนำใต้ชื่อไหม (prop `help` ของ PageHeader)
 * @param filters หน้านี้มีแถบปุ่มตัวกรองไหม
 * ทั้งสามอย่างต้องตรงกับหน้าจริง ไม่งั้นเนื้อหาจะกระโดดตอนโหลดเสร็จ
 */
export function ListSkeleton({
  rows = 6, head = true, hint = true, filters = true,
}: { rows?: number; head?: boolean; hint?: boolean; filters?: boolean }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="กำลังโหลด">
      {head && <Head hint={hint} />}
      {filters && <Filters />}
      <Rows rows={rows} />
    </div>
  );
}

/** แดชบอร์ด: ทักทาย + การ์ดตัวเลข 4 ใบ + กราฟ + ตาราง */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="กำลังโหลด">
      <div className="space-y-2">
        <Bar className="h-3 w-40" />
        <Bar className="h-7 w-64" />
        <Bar className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-neutral-200/80 bg-white p-5">
            <div className="flex items-start justify-between">
              <Bar className="h-3 w-24" /><Bar className="h-8 w-8 rounded-xl" />
            </div>
            <Bar className="mt-3 h-7 w-28" />
            <Bar className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-5">
        <Bar className="h-4 w-48" />
        <Bar className="mt-4 h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}

/**
 * หน้าที่เป็นการ์ดฟอร์ม เช่น ตั้งค่า แพ็กเกจ รายละเอียดเอกสาร
 * @param width ต้องตรงกับความกว้างที่หน้าจริงใช้ ไม่งั้นเนื้อหาจะขยับด้านข้างตอนโหลดเสร็จ
 */
export function FormSkeleton({
  head = true, hint = false, tabs = false, fields = 4, width = "max-w-3xl",
}: { head?: boolean; hint?: boolean; tabs?: boolean; fields?: number; width?: string }) {
  return (
    // mx-auto ต้องมี — หน้าจริงจัดกลางแล้ว ถ้าโครงชิดซ้ายจะกระโดดตอนสลับ
    <div className={cn("mx-auto w-full space-y-5", width)} aria-busy="true" aria-label="กำลังโหลด">
      {head && <Head hint={hint} />}
      {tabs && <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => <Bar key={i} className="h-10 w-28 rounded-xl" />)}
      </div>}
      <div className="space-y-4 rounded-2xl border border-neutral-200/80 bg-white p-5">
        <Bar className="h-5 w-56" />
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5"><Bar className="h-3 w-24" /><Bar className="h-11 w-full rounded-xl" /></div>
        ))}
      </div>
    </div>
  );
}
