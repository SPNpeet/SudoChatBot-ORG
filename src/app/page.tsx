import Link from "next/link";
import { MessageCircle, Bot, QrCode, FileText, BarChart3, ShieldCheck } from "lucide-react";

const features = [
  { icon: Bot, title: "AI พนักงานขาย 24 ชม.", desc: "ตอบทุกแชทใน 5 วินาที แนะนำสินค้า เช็กสต๊อกจริง ไม่ตอบมั่ว ไม่หลุดราคา" },
  { icon: QrCode, title: "ปิดการขายอัตโนมัติ", desc: "สรุปออเดอร์ ส่ง QR พร้อมเพย์ ตรวจสลิปเอง ตัดสต๊อกทันทีเมื่อเงินเข้า" },
  { icon: FileText, title: "สอนบอทด้วยไฟล์ PDF", desc: "อัปโหลดข้อมูลร้าน นโยบาย FAQ ระบบ OCR อ่านและจำให้บอทตอบได้ทันที" },
  { icon: MessageCircle, title: "ครบทุกช่องทาง", desc: "Facebook Messenger, Instagram DM และ LINE OA ในแดชบอร์ดเดียว" },
  { icon: BarChart3, title: "เห็นยอดขายชัดเจน", desc: "รายได้ ออเดอร์ที่บอทปิดเอง ต้นทุน AI — ครบในหน้าเดียว" },
  { icon: ShieldCheck, title: "ปลอดภัยระดับองค์กร", desc: "ข้อมูลแยกรายร้าน เข้ารหัส token กันสลิปปลอม/สลิปซ้ำอัตโนมัติ" },
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold">Sudo<span className="text-emerald-600">ChatBot</span></span>
        <Link href="/login" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
          เข้าสู่ระบบ
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
        <p className="mb-4 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          สำหรับร้านค้าออนไลน์ที่ตอบแชทไม่ทัน
        </p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          AI ที่<span className="text-emerald-600">ปิดการขาย</span>ให้ร้านคุณ<br />ตั้งแต่ทักจนโอนเงิน
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-neutral-500">
          เชื่อมเพจ Facebook, IG, LINE แล้วปล่อยให้ AI ตอบลูกค้า แนะนำสินค้า สรุปยอด
          ส่ง QR พร้อมเพย์ และตรวจสลิปยืนยันออเดอร์ — อัตโนมัติทั้งหมด คุณแค่แพ็กของส่ง
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/login" className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500">
            เริ่มใช้ฟรี — เชื่อมเพจใน 5 นาที
          </Link>
        </div>
      </section>

      <section className="border-t border-neutral-100 bg-neutral-50/60 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-neutral-200 bg-white p-6">
              <f.icon className="h-6 w-6 text-emerald-600" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="py-10 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} SudoChatBot — AI Sales-Closing Platform
      </footer>
    </main>
  );
}
