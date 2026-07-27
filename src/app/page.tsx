import Link from "next/link";
import { Logo } from "@/components/logo";
import { FileText, ScanLine, BookOpenText, Landmark, Building2, ShieldCheck, ArrowRight, Check, Calculator, Clock, X as XIcon, Lock, Users, Boxes } from "lucide-react";
import LandingSandboxChat from "./landing-sandbox-chat";

const features = [
  { icon: Calculator, title: "ผู้ช่วยบัญชี AI สั่งเป็นภาษาคน", desc: "\"ออกใบแจ้งหนี้ 5,000 ให้บริษัท A บวก VAT\" — พิมพ์แค่นี้ เอกสารออก บัญชีลงให้ครบ" },
  { icon: ScanLine, title: "ถ่ายรูปบิล = ลงบัญชีเสร็จ", desc: "AI อ่านบิล แยก VAT ภาษีซื้อ หัก ณ ที่จ่าย จัดหมวด แล้วลงสมุดรายวันให้อัตโนมัติ" },
  { icon: FileText, title: "เอกสารครบ พร้อมลิงก์เก็บเงิน", desc: "ใบเสนอราคา → ใบแจ้งหนี้ → ใบเสร็จ/ใบกำกับภาษี ส่งลิงก์ให้ลูกค้าสแกน QR จ่าย + อัปสลิป ระบบตรวจเองตัดยอดเอง" },
  { icon: BookOpenText, title: "สมุดรายวันอัตโนมัติ 100%", desc: "ทุกธุรกรรมลงเดบิต/เครดิตเองทันที นักบัญชีแค่รีวิว — งบทดลองพร้อมดูตลอดเวลา" },
  { icon: Landmark, title: "ภาษีไทยครบ พร้อมยื่น", desc: "ภ.พ.30 · 50 ทวิ · ภ.ง.ด.3/53 + ไฟล์ยื่นสรรพากร · ใบลดหนี้/ใบเพิ่มหนี้ ม.86/10, 86/9" },
  { icon: ShieldCheck, title: "ถูกตามกฎหมายตั้งแต่ในโครงสร้าง", desc: "จุดความรับผิด VAT แยกสินค้า/บริการ (ม.78, 78/1) · ล็อกงวดที่ยื่นแล้วแก้ย้อนหลังไม่ได้ · อัตรา VAT ตามวันที่ออกเอกสาร ไม่ฮาร์ดโค้ด" },
  { icon: Boxes, title: "งานสิ้นงวดที่คนมักลืม", desc: "ทะเบียนทรัพย์สิน + ค่าเสื่อมราคาเส้นตรงเฉลี่ยรายวันปีแรก · ปิดบัญชีสิ้นปียกเข้ากำไรสะสมให้เอง" },
  { icon: Building2, title: "สำนักงานบัญชีดูแลหลายบริษัท", desc: "บัญชีเดียวสลับดูแลลูกค้าหลายกิจการ ข้อมูลแยกขาดจากกัน ตรวจย้อนหลังได้ทุกรายการ" },
  { icon: Lock, title: "ตรวจสลิปจริง กันสลิปปลอมและสลิปซ้ำ", desc: "ลูกค้าอัปสลิปเอง ระบบตรวจกับธนาคารว่าโอนจริงและยังไม่เคยใช้ใบนี้ แล้วตัดยอดให้อัตโนมัติ" },
];

const steps = [
  { n: "1", t: "ใส่ข้อมูลกิจการ", d: "ชื่อ เลขผู้เสียภาษี พร้อมเพย์ — 3 นาที" },
  { n: "2", t: "ออกเอกสาร/ถ่ายบิล", d: "พิมพ์สั่ง AI หรือคีย์เองก็ได้" },
  { n: "3", t: "บัญชี-ภาษีเสร็จเอง", d: "สมุดรายวัน รายงาน ไฟล์ยื่นภาษี พร้อมหมด" },
];

// ตัวอย่างการสั่งงานผู้ช่วยบัญชี AI — สะท้อน flow จริง
const demo: { from: "user" | "ai"; text: string }[] = [
  { from: "user", text: "ออกใบแจ้งหนี้ค่าออกแบบเว็บ 25,000 ให้บริษัท สยามเทรด บวก VAT เขาหัก ณ ที่จ่าย 3%" },
  { from: "ai", text: "ออกใบแจ้งหนี้ INV-2026-0042 แล้วค่ะ ✓ ยอดรวม 26,750 บาท (VAT 1,750) หัก ณ ที่จ่าย 750 รับจริง 26,000 บาท — ลงบัญชีตั้งลูกหนี้ให้แล้ว ส่งลิงก์ให้ลูกค้าสแกนจ่ายได้เลยค่ะ" },
  { from: "user", text: "(แนบรูปบิลค่าไฟ)" },
  { from: "ai", text: "อ่านบิลแล้วค่ะ: การไฟฟ้านครหลวง 2,340.51 บาท (รวม VAT) — บันทึกเป็นค่าน้ำ/ค่าไฟ EXP-2026-0018 แยกภาษีซื้อ 153.12 ลงสมุดรายวันเรียบร้อยค่ะ" },
  { from: "user", text: "เดือนนี้ต้องยื่นภาษีอะไรบ้าง" },
  { from: "ai", text: "ภ.พ.30: ภาษีขาย 4,120 − ภาษีซื้อ 1,890 = ชำระ 2,230 บาท · ภ.ง.ด.3 มี 2 ราย 1,150 บาท — ดาวน์โหลดรายงานแนบ + ไฟล์ยื่นได้ที่หน้ารายงานเลยค่ะ" },
];

// ราคาตรงกับตาราง plans ในระบบ — แก้ราคาต้องแก้ทั้งสองที่
// จุดขาย: พนักงานไม่จำกัดทุกแพ็ก — จำกัดที่พลัง AI / โควตาสลิป / จำนวนกิจการ
const plans = [
  { name: "Starter", price: "990", per: "บาท/เดือน", items: ["1 กิจการ · พนักงานไม่จำกัด", "เอกสาร/บัญชี/ภาษี ครบ คีย์เองไม่จำกัด", "ตรวจสลิปอัตโนมัติ 300 สลิป/เดือน", "งาน AI 150 คำสั่ง/เดือน"], cta: "เริ่มเลย", hot: false },
  { name: "Professional", price: "1,990", per: "บาท/เดือน", items: ["สูงสุด 3 กิจการ · พนักงานไม่จำกัด", "สมุดรายวัน + 50 ทวิ + AI อ่านบิล", "ตรวจสลิปอัตโนมัติ 1,000 สลิป/เดือน", "งาน AI 500 คำสั่ง/เดือน"], cta: "เลือกแพ็กนี้", hot: true },
  { name: "AI Executive", price: "3,990", per: "บาท/เดือน", items: ["สูงสุด 5 กิจการ · พนักงานไม่จำกัด", "ไฟล์ยื่นสรรพากร ภ.พ.30 / ภ.ง.ด. (.txt)", "ตรวจสลิปอัตโนมัติ ไม่จำกัด", "งาน AI 2,000 คำสั่ง — คุยกับข้อมูลได้ลึก"], cta: "เลือกแพ็กนี้", hot: false },
  { name: "Agency", price: "9,900", per: "บาท/เดือน", items: ["ไม่จำกัดกิจการ (สำนักงานบัญชี)", "พนักงานไม่จำกัดทั้งสำนักงาน", "ทุกอย่างใน AI Executive", "งาน AI 10,000 คำสั่ง/เดือน"], cta: "เลือกแพ็กนี้", hot: false },
];

// เทียบให้เห็นภาพว่าชีวิตเปลี่ยนยังไง — จุดเจ็บจริงของ SME ไทย
const compare = [
  { before: "เก็บบิลใส่กล่อง สิ้นเดือนมานั่งคีย์ทีเดียว 2 วันเต็ม", after: "ถ่ายรูปบิลตอนได้รับ 5 วินาที ลงบัญชีเสร็จทันที" },
  { before: "ออกใบแจ้งหนี้ใน Excel แล้วมานั่งพิมพ์ซ้ำในโปรแกรมบัญชี", after: "ออกใบเดียว ลงสมุดรายวัน ตัดสต๊อก ตามหนี้ ครบในคลิกเดียว" },
  { before: "ทวงเงินลูกค้าเอง ไล่เช็คสลิปในแชททีละใบ", after: "ส่งลิงก์ให้ลูกค้าสแกนจ่าย ระบบตรวจสลิปจริง/สลิปซ้ำ ตัดยอดเอง" },
  { before: "ใกล้ยื่นภาษีค่อยวิ่งหาเอกสาร ไม่รู้ว่าต้องจ่ายเท่าไหร่", after: "ภ.พ.30 / ภ.ง.ด. อัปเดตสดทุกวัน ดาวน์โหลดไฟล์ยื่นได้เลย" },
  { before: "ลูกค้าคืนของหลังยื่นภาษีไปแล้ว ไม่รู้จะทำยังไง เลยแก้ใบเดิมทิ้ง", after: "ออกใบลดหนี้ตามกฎหมาย ระบบหักภาษีขายให้ในเดือนที่ถูกต้อง" },
  { before: "ยื่นภาษีไปแล้วยังมีคนไปแก้ตัวเลขย้อนหลังได้ ตรวจทีหลังอธิบายไม่ถูก", after: "ปิดงวดแล้วล็อกที่ระดับฐานข้อมูล แก้ไม่ได้ทุกทาง แต่ยังรับชำระใบเก่าได้ปกติ" },
];

const faqs = [
  { q: "ไม่มีความรู้บัญชีเลย ใช้ได้ไหม?", a: "ได้ — คุณแค่ออกเอกสารหรือถ่ายรูปบิล ระบบลงเดบิต/เครดิตให้เองตามหลักบัญชีคู่ ส่วนที่นักบัญชีต้องใช้ (สมุดรายวัน งบทดลอง รายงานภาษี) ระบบเตรียมให้ครบ ส่งต่อสำนักงานบัญชีได้ทันที" },
  { q: "ต่างจากโปรแกรมบัญชีทั่วไปยังไง?", a: "หัวใจคือ AI: พิมพ์สั่งเป็นภาษาคนหรือถ่ายรูปบิลก็ลงบัญชีได้เลย ไม่ต้องเรียนรู้เมนูซับซ้อน และมีลิงก์เก็บเงินที่ลูกค้าสแกน QR จ่ายแล้วอัปสลิปเองได้ ระบบตรวจสลิปจริง/สลิปซ้ำและตัดยอดให้อัตโนมัติ" },
  { q: "สำนักงานบัญชีใช้ดูแลลูกค้าหลายเจ้าได้ไหม?", a: "ได้ — บัญชีเดียวสร้าง/สลับได้หลายกิจการ ข้อมูลแยกขาดจากกันด้วย Row-Level Security ทุกการแก้ไขมี audit log ตรวจย้อนหลังได้ และเชิญพนักงานเข้าทำงานแยกสิทธิ์ตามบทบาทได้" },
  { q: "เงินเข้าบัญชีใคร?", a: "เข้าพร้อมเพย์ของกิจการคุณโดยตรง 100% เราไม่ผ่านเงินของคุณ — ระบบแค่สร้าง QR ตรวจสลิป และลงบัญชีให้" },
  { q: "ตัวเลขเชื่อถือได้แค่ไหน ผิดขึ้นมาใครรับผิดชอบ?", a: "ระบบมีชุดตรวจอัตโนมัติที่รันทุกครั้งก่อนขึ้นระบบจริง ตรวจการปัดเศษ 400,000 เคสว่ามูลค่าก่อนภาษี + VAT เท่ายอดรวมเสมอ · ตรวจว่าฐานหัก ณ ที่จ่ายคิดจากยอดก่อน VAT ไม่ใช่ยอดรวม · ตรวจค่าเสื่อมราคาตลอดอายุทรัพย์สินว่าเหลือราคาซากพอดี และตรวจว่ารายงานภาษีตรงกับสมุดรายวันทุกเดือน ถึงอย่างนั้นระบบเป็นเครื่องมือ ไม่ใช่ผู้ทำบัญชี — ตัวเลขที่ยื่นจริงควรให้ผู้ทำบัญชีหรือผู้สอบบัญชีของคุณตรวจก่อนเสมอ" },
  { q: "อัตรา VAT 7% จะหมดอายุ ระบบรับมือยังไง?", a: "อัตรา 7% มาจากพระราชกฤษฎีกาที่ต่ออายุเป็นรายปี ระบบไม่ได้ฮาร์ดโค้ดเลข 7 ไว้ แต่เก็บเป็นตารางอัตราตามช่วงวันที่ และเลือกอัตราตามวันที่ออกเอกสารแต่ละใบ เอกสารเก่าจึงไม่เปลี่ยนตัวเลขเมื่ออัตราใหม่มีผล · และระบบจงใจไม่เปลี่ยนอัตราเอง แต่ขึ้นแบนเนอร์เตือนล่วงหน้าให้คนไปตรวจประกาศแล้วยืนยัน เพราะการเปลี่ยนอัตราเงียบ ๆ เสียหายกว่า" },
  { q: "ธุรกิจบริการที่ขายเชื่อใช้ได้ไหม?", a: "ได้ — ตอนออกใบแจ้งหนี้เลือกได้ว่าเป็นสินค้าหรือบริการ ถ้าเป็นบริการขายเชื่อ ระบบพักภาษีขายไว้ก่อนตามมาตรา 78/1 แล้วรับรู้เข้า ภ.พ.30 ในเดือนที่ลูกค้าจ่ายเงินจริง รับเงินหลายงวดข้ามเดือนก็แยกให้ถูกตามสัดส่วน" },
  { q: "ยกเลิกยากไหม ข้อมูลเป็นของใคร?", a: "ไม่มีสัญญาผูกมัด หยุดใช้เมื่อไหร่ก็ได้ ข้อมูลเป็นของคุณ ดาวน์โหลดรายงานเป็น Excel ได้ตลอด และขอลบข้อมูลได้ตามนโยบายความเป็นส่วนตัว" },
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <a href="#pricing" className="hidden text-sm text-neutral-500 hover:text-neutral-900 sm:block">ราคา</a>
          <Link href="/login" className="inline-flex h-11 items-center rounded-xl bg-neutral-900 px-5 text-sm font-medium text-white transition-colors hover:bg-neutral-700">
            เข้าสู่ระบบ
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-14">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              ระบบบัญชี + ผู้ช่วย AI — เริ่มฟรี ไม่ต้องใช้บัตร
            </p>
            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
              บัญชีทั้งบริษัท<br /><span className="text-emerald-600">เสร็จด้วยการพิมพ์สั่ง</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-neutral-500 lg:mx-0 mx-auto">
              ออกใบแจ้งหนี้-ใบกำกับภาษี เก็บเงินผ่าน QR ตรวจสลิปอัตโนมัติ ถ่ายรูปบิลให้ AI ลงบัญชี
              สมุดรายวันเดบิต/เครดิตอัตโนมัติ จนถึงรายงาน ภ.พ.30 / ภ.ง.ด. พร้อมยื่น — ครบในระบบเดียว
              ใช้ง่ายทั้งเจ้าของกิจการและสำนักงานบัญชี
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start justify-center">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500">
                เริ่มใช้ฟรี <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#pricing" className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50">
                ดูราคา
              </a>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-neutral-500 lg:justify-start justify-center">
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> ไม่ต้องใช้บัตรเครดิต</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-emerald-600" /> ตั้งค่าเสร็จใน 3 นาที</span>
              <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-emerald-600" /> พนักงานไม่จำกัดทุกแพ็ก</span>
              <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-emerald-600" /> เงินเข้าบัญชีคุณโดยตรง</span>
            </div>
          </div>

          {/* ตัวอย่างสั่งงานผู้ช่วยบัญชี AI */}
          <div className="mx-auto w-full max-w-sm">
            <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 border-b border-neutral-200 pb-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-white"><Calculator className="h-4 w-4" /></div>
                <div>
                  <p className="text-xs font-semibold">ผู้ช่วยบัญชี AI</p>
                  <p className="text-[10px] text-emerald-600">● ลงบัญชีให้ทุกคำสั่ง ตรวจย้อนหลังได้</p>
                </div>
              </div>
              <div className="space-y-2">
                {demo.map((m, i) => (
                  <div key={i} className={m.from === "user" ? "flex justify-end" : "flex justify-start"}>
                    <p className={
                      m.from === "user"
                        ? "max-w-[80%] rounded-2xl rounded-br-md bg-emerald-600 px-3 py-2 text-[12px] leading-relaxed text-white"
                        : "max-w-[85%] rounded-2xl rounded-bl-md border border-neutral-200 bg-white px-3 py-2 text-[12px] leading-relaxed text-neutral-700"
                    }>{m.text}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-[10px] text-neutral-400">ตัวอย่างการใช้งานจริง — สมัครแล้วลองสั่งได้ทันที</p>
            </div>
            <LandingSandboxChat />
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

      {/* เทียบก่อน-หลัง — ให้คนเห็นภาพตัวเองในบรรทัดซ้ายก่อน แล้วค่อยขายทางออก */}
      <section className="border-t border-neutral-100 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight">งานบัญชีที่กินเวลาคุณทุกเดือน</h2>
          <p className="mt-2 text-center text-sm text-neutral-500">เทียบให้เห็นชัดว่าเปลี่ยนไปยังไง</p>
          <div className="mt-8 overflow-hidden rounded-2xl border border-neutral-200">
            <div className="grid grid-cols-2 border-b border-neutral-200 bg-neutral-50 text-xs font-semibold">
              <div className="px-4 py-2.5 text-neutral-500">แบบเดิม</div>
              <div className="border-l border-neutral-200 px-4 py-2.5 text-emerald-700">กับ SudoChatBot</div>
            </div>
            {compare.map((c) => (
              <div key={c.before} className="grid grid-cols-2 border-b border-neutral-100 last:border-0">
                <div className="flex items-start gap-2 px-4 py-3.5 text-[13px] leading-relaxed text-neutral-500">
                  <XIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-300" /> {c.before}
                </div>
                <div className="flex items-start gap-2 border-l border-neutral-100 bg-emerald-50/30 px-4 py-3.5 text-[13px] font-medium leading-relaxed text-neutral-700">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> {c.after}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-neutral-100 bg-neutral-50/60 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">หน้าบ้านใช้ง่าย หลังบ้านไม่ต้องคีย์ซ้ำ</h2>
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
          <p className="mx-auto mt-6 flex max-w-xl items-center justify-center gap-2 text-center text-xs text-neutral-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            ข้อมูลแยกรายกิจการด้วย Row-Level Security · ทุกการแก้ไขมี Audit Log · เอกสารยกเลิกได้แบบกลับรายการ ตรวจสอบย้อนหลังได้เสมอ
          </p>
        </div>
      </section>

      {/* ราคา — ตัวเลขเดียวกับหน้า แพ็กเกจ ในระบบ */}
      <section id="pricing" className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight">ราคาตรงไปตรงมา</h2>
        <p className="mt-2 text-center text-sm text-neutral-500">เริ่มฟรี อัปเกรดเมื่อธุรกิจโต ไม่มีสัญญาผูกมัด ยกเลิกได้ตลอด</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <Link href="/signup" className={`mt-5 block rounded-xl py-2.5 text-center text-sm font-medium ${p.hot ? "bg-emerald-600 text-white hover:bg-emerald-500" : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"}`}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-neutral-400">
          <b>พนักงานใช้ฟรีไม่จำกัดทุกแพ็ก</b> — เชิญทีมขาย ทีมแอดมิน นักบัญชี เข้ามาได้หมด ·
          เริ่มทดลองใช้ฟรีก่อนได้ (AI 30 ครั้ง/วัน) · คีย์เอกสารเองไม่จำกัดทุกแพ็ก
        </p>
      </section>

      {/* FAQ */}
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
        <h2 className="text-2xl font-bold tracking-tight">พร้อมให้บัญชีเสร็จเองทั้งระบบ?</h2>
        <p className="mt-2 text-sm text-neutral-500">สมัครฟรี ออกเอกสารใบแรกได้ใน 3 นาที — สั่งผู้ช่วย AI เป็นภาษาคนได้ทันที</p>
        <Link href="/signup" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500">
          เริ่มเลย <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* แถบ CTA ติดล่างบนมือถือ — เลื่อนอ่านถึงไหนก็สมัครได้ทันที */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
        <Link href="/signup" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[15px] font-semibold text-white active:scale-[0.99]">
          เริ่มใช้ฟรี ไม่ต้องใช้บัตร <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <footer className="border-t border-neutral-100 py-8 pb-24 sm:pb-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-xs text-neutral-400">
          {/* พื้นที่กดต้องสูงพอบนมือถือ — เดิมสูงแค่ 16px กดพลาดตลอด
              inline-flex + min-h ทำให้กดง่ายขึ้นโดยหน้าตายังเหมือนเดิม */}
          <div className="flex flex-wrap justify-center gap-x-4">
            <Link href="/privacy" className="inline-flex min-h-[40px] items-center px-1 hover:text-neutral-600">นโยบายความเป็นส่วนตัว</Link>
            <Link href="/terms" className="inline-flex min-h-[40px] items-center px-1 hover:text-neutral-600">เงื่อนไขการใช้งาน</Link>
            <Link href="/data-deletion" className="inline-flex min-h-[40px] items-center px-1 hover:text-neutral-600">การลบข้อมูล</Link>
            <a href="mailto:support@sudochatbot.online" className="inline-flex min-h-[40px] items-center px-1 hover:text-neutral-600">ติดต่อเรา</a>
          </div>
          <p>© {new Date().getFullYear()} SudoChatBot — AI Accounting & Back-Office Platform</p>
        </div>
      </footer>
    </main>
  );
}
