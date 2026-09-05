// ลิงก์เอกสารสาธารณะที่หาไม่เจอ — ลูกค้าของร้าน (คนนอกระบบ) เป็นคนเปิด
// ต้องบอกเป็นภาษาคนว่าเกิดอะไรขึ้นและควรทำอะไรต่อ ไม่ใช่ 404 เปล่า ๆ
import { Logo } from "@/components/logo";

export default function DocNotFound() {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-4 text-lg font-bold text-neutral-900">ไม่พบเอกสารตามลิงก์นี้</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          ลิงก์อาจถูกยกเลิก พิมพ์ไม่ครบ หรือเอกสารยังเป็นฉบับร่างอยู่ — กรุณาขอลิงก์ใหม่จากผู้ออกเอกสาร
        </p>
      </div>
    </main>
  );
}
