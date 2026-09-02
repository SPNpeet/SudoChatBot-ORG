// โครงโหลดรูปร่างเท่าหน้าจริง: หัวข้อ + แถบปุ่ม + รายการ 3 แถว (กติกาข้อ 9)
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl animate-pulse space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-neutral-200" />
        <div className="space-y-2">
          <div className="h-6 w-36 rounded bg-neutral-200" />
          <div className="h-4 w-80 rounded bg-neutral-100" />
        </div>
      </div>
      <div className="flex gap-2"><div className="h-10 w-32 rounded-xl bg-neutral-200" /><div className="h-10 w-28 rounded-xl bg-neutral-100" /></div>
      <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200/80 bg-white">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 rounded-lg bg-neutral-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-1/2 rounded bg-neutral-100" />
              <div className="h-3 w-3/4 rounded bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
