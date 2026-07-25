// ============================================================
//  โครงหน้าระหว่างรอข้อมูล — Next จะโชว์ให้ทันทีที่กดเมนู (ไฟล์ loading.tsx)
//  ผู้ใช้เห็นรูปร่างหน้าเลย ไม่ใช่จอขาวค้าง = รู้สึกเร็วขึ้นมากทั้งที่เวลาจริงเท่าเดิม
//  ใช้ pulse เบาๆ และเคารพ prefers-reduced-motion
// ============================================================
import { cn } from "@/lib/utils";

export function Bar({ className }: { className?: string }) {
  return <div className={cn("h-4 animate-pulse rounded-md bg-neutral-100 motion-reduce:animate-none", className)} />;
}

/** หน้าที่เป็นตาราง: หัวเรื่อง + แถบตัวกรอง + ตาราง */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="กำลังโหลด">
      <div className="space-y-2">
        <Bar className="h-7 w-44" />
        <Bar className="h-4 w-64" />
        <Bar className="h-12 w-full rounded-xl" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => <Bar key={i} className="h-9 w-24 rounded-full" />)}
      </div>
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-neutral-50 px-4 py-3.5 last:border-0">
            <Bar className="w-28 shrink-0" />
            <Bar className="hidden flex-1 sm:block" />
            <Bar className="ml-auto w-20 shrink-0" />
            <Bar className="hidden w-16 shrink-0 sm:block rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** แดชบอร์ด: ทักทาย + การ์ดตัวเลข 4 ใบ + กราฟ */
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

/** หน้าที่เป็นการ์ดฟอร์ม เช่น ตั้งค่า */
export function FormSkeleton() {
  return (
    <div className="max-w-3xl space-y-5" aria-busy="true" aria-label="กำลังโหลด">
      <div className="space-y-2"><Bar className="h-7 w-40" /><Bar className="h-4 w-72" /></div>
      <div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <Bar key={i} className="h-10 w-32 rounded-xl" />)}</div>
      <div className="space-y-4 rounded-2xl border border-neutral-200/80 bg-white p-5">
        <Bar className="h-5 w-56" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5"><Bar className="h-3 w-24" /><Bar className="h-11 w-full rounded-xl" /></div>
        ))}
      </div>
    </div>
  );
}
