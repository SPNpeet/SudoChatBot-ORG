// skeleton กลางของทุกหน้า dashboard — โชว์ทันทีที่กดเมนู ระหว่างรอ server render
// (ไม่มีไฟล์นี้ = กดแล้วจอนิ่งจนกว่า query จะจบ ดูเหมือนเว็บค้าง)
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="กำลังโหลด">
      <div>
        <div className="h-6 w-40 rounded-lg bg-neutral-200" />
        <div className="mt-2 h-4 w-64 rounded-lg bg-neutral-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-neutral-100 bg-white p-5">
            <div className="h-3 w-20 rounded bg-neutral-100" />
            <div className="mt-3 h-6 w-24 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-neutral-100 bg-white p-5">
        <div className="h-4 w-32 rounded bg-neutral-100" />
        <div className="mt-4 h-44 rounded-xl bg-neutral-50" />
      </div>
    </div>
  );
}
