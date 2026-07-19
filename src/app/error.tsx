"use client";
// error boundary ระดับแอป (นอก dashboard เช่น login/หน้าแรก)
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 text-center">
        <h2 className="text-base font-bold">เกิดข้อผิดพลาดชั่วคราว</h2>
        <p className="mt-1 text-sm text-neutral-500">รีเฟรชหรือลองใหม่อีกครั้งได้เลย</p>
        {error.digest && <p className="mt-2 text-[11px] text-neutral-300">รหัสอ้างอิง: {error.digest}</p>}
        <button onClick={reset}
          className="mt-4 h-10 rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-500">
          ลองอีกครั้ง
        </button>
      </div>
    </main>
  );
}
