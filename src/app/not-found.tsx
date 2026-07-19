import Link from "next/link";

// หน้า 404 แบรนด์ไทย — แทน default ภาษาอังกฤษของ Next.js
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-6 text-center">
      <p className="text-sm font-semibold text-emerald-600">Sudo<span className="text-neutral-900">ChatBot</span></p>
      <h1 className="mt-4 text-6xl font-bold tracking-tight text-neutral-900">404</h1>
      <p className="mt-3 text-lg font-medium text-neutral-700">ไม่พบหน้าที่คุณกำลังหา</p>
      <p className="mt-1 text-sm text-neutral-400">ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 active:scale-95">
          กลับหน้าแรก
        </Link>
        <Link href="/dashboard" className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 active:scale-95">
          ไปแดชบอร์ด
        </Link>
      </div>
    </main>
  );
}
