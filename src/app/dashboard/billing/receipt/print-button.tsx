"use client";

export function PrintButton() {
  return (
    // min-h 44px = เป้ากดขั้นต่ำบนมือถือ — ปุ่มนี้คือปุ่มเดียวของหน้าใบเสร็จ กดพลาดไม่ได้
    <button type="button" onClick={() => window.print()}
      className="inline-flex min-h-[44px] items-center rounded-xl border border-neutral-300 px-4 py-2 text-sm transition-colors hover:bg-neutral-50">
      พิมพ์ / บันทึก PDF
    </button>
  );
}
