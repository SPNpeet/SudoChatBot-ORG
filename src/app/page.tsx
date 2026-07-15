import Link from "next/link";
import { Logo } from "@/components/logo";
import { MessageCircle, Bot, QrCode, FileText, BarChart3, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

const features = [
  { icon: Bot, title: "AI พนักงานขาย 24 ชม.", desc: "ตอบทุกแชทใน 5 วินาที เช็กสต๊อกจริง ไม่ตอบมั่ว ไม่หลุดราคา" },
  { icon: QrCode, title: "ปิดการขายอัตโนมัติ", desc: "สรุปออเดอร์ ส่ง QR พร้อมเพย์ ตรวจสลิปเอง ตัดสต๊อกทันทีเมื่อเงินเข้า" },
  { icon: FileText, title: "สอนบอทด้วยไฟล์ PDF", desc: "อัปโหลดข้อมูลร้าน นโยบาย FAQ ระบบ OCR อ่านและจำให้ตอบได้ทันที" },
  { icon: MessageCircle, title: "ครบทุกช่องทาง", desc: "Facebook Messenger, Instagram DM และ LINE OA ในที่เดียว" },
  { icon: BarChart3, title: "เห็นยอดขายชัด", desc: "รายได้ ออเดอร์ที่บอทปิดเอง ต้นทุน AI — ครบในหน้าเดียว" },
  { icon: ShieldCheck, title: "ปลอดภัยระดับองค์กร", desc: "ข้อมูลแยกรายร้าน เข้ารหัส token กันสลิปปลอม/สลิปซ้ำอัตโนมัติ" },
];

const steps = [
  { n: "1", t: "เชื่อมเพจ", d: "Facebook / IG / LINE ใน 5 นาที" },
  { n: "2", t: "ใส่สินค้า + สอนบอท", d: "อัปโหลด PDF หรือพิมพ์เอง" },
  { n: "3", t: "ปล่อยให้บอทปิดการขาย", d: "คุณแค่แพ็กของส่ง" },
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <Link href="/login" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700">
          เข้าสู่ระบบ
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-20 pt-14 text-center">
        <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <Sparkles className="h-3.5 w-3.5" /> เริ่มฟรี ตอบ 100 ข้อความแรกไม่มีค่าใช้จ่าย
        </p>
        <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
          AI ที่<span className="text-emerald-600">ปิดการขาย</span>ให้ร้านคุณ<br />ตั้งแต่ทักจนโอนเงิน
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-neutral-500">
          เชื่อมเพจ Facebook, IG, LINE แล้วปล่อยให้ AI ตอบลูกค้า แนะนำสินค้า สรุปยอด
          ส่ง QR พร้อมเพย์ และตรวจสลิปยืนยันออเดอร์ — อัตโนมัติทั้งหมด
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500">
            เริ่มใช้ฟรี <ArrowRight className="h-4 w-4" />
          </Link>
          <span className="text-xs text-neutral-400">ไม่ต้องใช้บัตรเครดิต · เชื่อมเพจได้ทันที</span>
        </div>

        <div className="mx-auto mt-12 grid max-w-2xl gap-3 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 text-left">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">{s.n}</span>
              <p className="mt-2 text-sm font-semibold">{s.t}</p>
              <p className="text-xs text-neutral-500">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-neutral-100 bg-neutral-50/60 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">ทุกอย่างที่ร้านต้องใช้ ในที่เดียว</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-sm">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50">
                  <f.icon className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-2xl font-bold tracking-tight">พร้อมให้บอทปิดการขายแทนคุณ?</h2>
        <p className="mt-2 text-sm text-neutral-500">เชื่อมเพจแรกวันนี้ ทดลองฟรี 100 ข้อความ</p>
        <Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500">
          เริ่มเลย <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="border-t border-neutral-100 py-8 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} SudoChatBot — AI Sales-Closing Platform
      </footer>
    </main>
  );
}
