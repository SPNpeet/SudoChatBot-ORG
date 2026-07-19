"use client";
// error boundary ของ dashboard — query พัง/เน็ตสะดุดต้องไม่เจอจอ error ดิบของ Next
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 text-center">
        <p className="text-3xl">😵</p>
        <h2 className="mt-3 text-base font-bold">หน้านี้โหลดไม่สำเร็จ</h2>
        <p className="mt-1 text-sm text-neutral-500">
          อาจเป็นปัญหาเครือข่ายชั่วคราว ลองใหม่ได้เลย — ข้อมูลของร้านคุณปลอดภัยไม่หายไปไหน
        </p>
        {error.digest && <p className="mt-2 text-[11px] text-neutral-300">รหัสอ้างอิง: {error.digest}</p>}
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={reset}
            className="h-10 rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-500">
            ลองอีกครั้ง
          </button>
          <a href="/dashboard"
            className="flex h-10 items-center rounded-xl border border-neutral-300 px-5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            กลับหน้าภาพรวม
          </a>
        </div>
      </div>
    </div>
  );
}
