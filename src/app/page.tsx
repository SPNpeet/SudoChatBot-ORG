import Link from "next/link";
import { Logo } from "@/components/logo";
import { MessageCircle, Bot, QrCode, FileText, BarChart3, ShieldCheck, ArrowRight, Sparkles, Check } from "lucide-react";

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

// ตัวอย่างบทสนทนา — สะท้อน flow จริงของบอท (ถาม→เช็กสต๊อก→สรุปยอด→QR→ตรวจสลิป)
const demo: { from: "customer" | "bot"; text: string }[] = [
  { from: "customer", text: "มีเสื้อยืดสีดำไซซ์ L ไหมคะ" },
  { from: "bot", text: "มีค่ะ 🖤 เสื้อยืดคอกลม สีดำ ไซซ์ L เหลือ 4 ตัว ราคา 290 บาทค่ะ รับกี่ตัวดีคะ" },
  { from: "customer", text: "เอา 2 ตัวค่ะ ส่งไปเชียงใหม่" },
  { from: "bot", text: "สรุปออเดอร์นะคะ 🧾 เสื้อยืดดำ L ×2 = 580 บาท + ส่ง Flash 40 บาท รวม 620 บาท — ขอชื่อ ที่อยู่ เบอร์โทรได้เลยค่ะ" },
  { from: "bot", text: "รับออเดอร์แล้วค่ะ ✅ สแกน QR พร้อมเพย์นี้ได้เลย โอนแล้วส่งสลิปในแชทนี้ ระบบตรวจให้อัตโนมัติค่ะ" },
  { from: "customer", text: "(ส่งสลิป)" },
  { from: "bot", text: "ยืนยันการชำระเงินเรียบร้อยค่ะ ✅ ออเดอร์ #ORD-0042 ยอด 620 บาท ร้านจะรีบจัดส่งและแจ้งเลขพัสดุนะคะ ขอบคุณที่อุดหนุนค่ะ 💚" },
];

// ราคาตรงกับตาราง plans ในระบบ — แก้ราคาต้องแก้ทั้งสองที่
const plans = [
  { name: "ทดลองใช้", price: "ฟรี", per: "", items: ["ตอบฟรี 100 ข้อความ/เดือน", "1 ช่องทาง", "บอทปิดการขายอัตโนมัติ", "ไม่ต้องใช้บัตรเครดิต"], cta: "เริ่มใช้ฟรี", hot: false },
  { name: "เริ่มต้น", price: "390", per: "บาท/เดือน", items: ["ตอบฟรี 1,500 ข้อความ/เดือน", "3 ช่องทาง", "ตรวจสลิปอัตโนมัติ", "ทีมงาน 5 คน"], cta: "เลือกแพ็กนี้", hot: true },
  { name: "โปร", price: "990", per: "บาท/เดือน", items: ["ตอบฟรี 5,000 ข้อความ/เดือน", "10 ช่องทาง", "โมเดล AI ระดับพรีเมียม", "รายงานเชิงลึก"], cta: "เลือกแพ็กนี้", hot: false },
];

const faqs = [
  { q: "บอทตอบมั่วไหม ถ้าลูกค้าถามนอกเรื่อง?", a: "บอทตอบจากข้อมูลสินค้าและคลังความรู้ของร้านคุณเท่านั้น ราคากับสต๊อกดึงจากระบบสด ๆ ทุกครั้ง ไม่เดาเอง ถ้าไม่รู้จะบอกตรง ๆ แล้วส่งต่อให้แอดมิน และคุณกดสลับมาตอบเองแทนบอทได้ตลอดเวลา" },
  { q: "ต้องเขียนโปรแกรมเป็นไหม?", a: "ไม่ต้องเลย สมัคร เชื่อมเพจ ใส่สินค้า แล้วบอททำงานทันที มีหน้า 'ทดลองบอท' ให้คุยกับบอทตัวเองก่อนเปิดใช้จริง ฟรี ไม่หักเครดิต" },
  { q: "เงินเข้าบัญชีใคร?", a: "เข้าบัญชีพร้อมเพย์ของร้านคุณโดยตรง 100% เราไม่ผ่านเงินของร้าน — ระบบแค่สร้าง QR และตรวจสลิปให้" },
  { q: "ใช้ LINE อย่างเดียวได้ไหม?", a: "ได้ เชื่อม LINE OA ได้เต็มรูปแบบทันที มีตัวช่วยพาทำทีละขั้นตอนในแอป ส่วน Facebook/IG เชื่อมได้ด้วยการกดปุ่มเดียว" },
  { q: "ยกเลิกยากไหม?", a: "ไม่มีสัญญาผูกมัด ลดแพ็กเกจหรือหยุดใช้เมื่อไหร่ก็ได้ ข้อมูลร้านเป็นของคุณ ขอลบได้ตลอดตามนโยบายความเป็นส่วนตัว" },
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <a href="#pricing" className="hidden text-sm text-neutral-500 hover:text-neutral-900 sm:block">ราคา</a>
          <Link href="/login" className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700">
            เข้าสู่ระบบ
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-14">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" /> เริ่มฟรี ตอบ 100 ข้อความแรกไม่มีค่าใช้จ่าย
            </p>
            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
              AI ที่<span className="text-emerald-600">ปิดการขาย</span>ให้ร้านคุณ<br />ตั้งแต่ทักจนโอนเงิน
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-neutral-500 lg:mx-0 mx-auto">
              เชื่อมเพจ Facebook, IG, LINE แล้วปล่อยให้ AI ตอบลูกค้า แนะนำสินค้า สรุปยอด
              ส่ง QR พร้อมเพย์ และตรวจสลิปยืนยันออเดอร์ — อัตโนมัติทั้งหมด เงินเข้าบัญชีคุณตรง
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start justify-center">
              <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500">
                เริ่มใช้ฟรี <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="text-xs text-neutral-400">ไม่ต้องใช้บัตรเครดิต · ไม่ต้องเขียนโค้ด</span>
            </div>
          </div>

          {/* ตัวอย่างบทสนทนา — ให้เห็นก่อนสมัครว่าบอททำอะไรได้จริง */}
          <div className="mx-auto w-full max-w-sm">
            <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 border-b border-neutral-200 pb-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-white"><Bot className="h-4 w-4" /></div>
                <div>
                  <p className="text-xs font-semibold">น้องขายดี — แอดมินร้าน</p>
                  <p className="text-[10px] text-emerald-600">● ตอบทันที ตลอด 24 ชม.</p>
                </div>
              </div>
              <div className="space-y-2">
                {demo.map((m, i) => (
                  <div key={i} className={m.from === "customer" ? "flex justify-end" : "flex justify-start"}>
                    <p className={
                      m.from === "customer"
                        ? "max-w-[80%] rounded-2xl rounded-br-md bg-emerald-600 px-3 py-2 text-[12px] leading-relaxed text-white"
                        : "max-w-[85%] rounded-2xl rounded-bl-md border border-neutral-200 bg-white px-3 py-2 text-[12px] leading-relaxed text-neutral-700"
                    }>{m.text}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-[10px] text-neutral-400">ตัวอย่างบทสนทนา — ลองคุยกับบอทของคุณเองได้ฟรีหลังสมัคร</p>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-14 grid max-w-2xl gap-3 sm:grid-cols-3">
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

      {/* ราคา — ตัวเลขเดียวกับหน้า แพ็กเกจ ในระบบ */}
      <section id="pricing" className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight">ราคาตรงไปตรงมา</h2>
        <p className="mt-2 text-center text-sm text-neutral-500">เริ่มฟรี อัปเกรดเมื่อขายดี ไม่มีสัญญาผูกมัด ยกเลิกได้ตลอด</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.name} className={`relative rounded-2xl border p-6 ${p.hot ? "border-emerald-300 bg-emerald-50/40 shadow-sm" : "border-neutral-200 bg-white"}`}>
              {p.hot && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-[11px] font-medium text-white">ยอดนิยม</span>}
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{p.price}<span className="ml-1 text-sm font-normal text-neutral-400">{p.per}</span></p>
              <ul className="mt-4 space-y-2">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm text-neutral-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {it}
                  </li>
                ))}
              </ul>
              <Link href="/login" className={`mt-5 block rounded-xl py-2.5 text-center text-sm font-medium ${p.hot ? "bg-emerald-600 text-white hover:bg-emerald-500" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"}`}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-neutral-400">ข้อความเกินแพ็กเกจ คิดตามจริง 0.35–0.79 บาท/ข้อความตามแพ็ก · ร้านใหญ่/หลายแบรนด์ ติดต่อแพ็กองค์กรได้ในแอป</p>
      </section>

      {/* FAQ — คำถามที่แม่ค้าถามก่อนตัดสินใจจริง */}
      <section className="border-t border-neutral-100 bg-neutral-50/60 py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">คำถามที่เจอบ่อย</h2>
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-neutral-200 bg-white p-5">
                <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-800 marker:content-none">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-2xl font-bold tracking-tight">พร้อมให้บอทปิดการขายแทนคุณ?</h2>
        <p className="mt-2 text-sm text-neutral-500">สมัครแล้วลองคุยกับบอทของคุณเองได้ทันที ฟรี ไม่ต้องเชื่อมเพจก่อน</p>
        <Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500">
          เริ่มเลย <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="border-t border-neutral-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-xs text-neutral-400">
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            <Link href="/privacy" className="hover:text-neutral-600">นโยบายความเป็นส่วนตัว</Link>
            <Link href="/terms" className="hover:text-neutral-600">เงื่อนไขการใช้งาน</Link>
            <Link href="/data-deletion" className="hover:text-neutral-600">การลบข้อมูล</Link>
            <a href="mailto:support@sudochatbot.online" className="hover:text-neutral-600">ติดต่อเรา</a>
          </div>
          <p>© {new Date().getFullYear()} SudoChatBot — AI Sales-Closing Platform</p>
        </div>
      </footer>
    </main>
  );
}
