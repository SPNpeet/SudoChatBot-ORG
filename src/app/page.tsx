import Link from "next/link";
import { Logo } from "@/components/logo";
import HeroCommand from "./hero-command";
import HeroTilt from "./hero-tilt";
import PricingCards from "./pricing-cards";
import { FileText, ScanLine, BookOpenText, Landmark, ShieldCheck, ArrowRight, Check, Calculator, Clock, X as XIcon, Lock, Users } from "lucide-react";
import LandingSandboxChat from "./landing-sandbox-chat";

// 6 ใบ ไม่ใช่ 9 — เดิมยาวเกินจนคนกวาดตาผ่านโดยไม่อ่านสักใบ
// ยุบที่ทับซ้อนกันเข้าด้วยกัน (สมุดรายวัน + งานสิ้นงวด) และตัดที่ซ้ำกับส่วนอื่นของหน้า
// (สำนักงานบัญชีหลายบริษัท กับ ตรวจสลิป มีอยู่ในตารางเปรียบเทียบด้านบนแล้ว)
// แต่ละใบเหลือหัวข้อสั้น + ประโยคเดียว ให้อ่านจบทั้งบล็อกได้จริง
const features = [
  { icon: Calculator, title: "สั่งเป็นภาษาคน", desc: "พิมพ์ว่าจะออกใบอะไรให้ใคร เท่าไหร่ — เอกสารออกและบัญชีลงให้ครบในคำสั่งเดียว" },
  { icon: ScanLine, title: "ถ่ายรูปบิล บัญชีเสร็จ", desc: "AI อ่านบิล แยก VAT และหัก ณ ที่จ่าย จัดหมวด ลงสมุดรายวันให้เอง" },
  { icon: FileText, title: "เอกสารครบ เก็บเงินได้ในใบเดียว", desc: "ใบเสนอราคาถึงใบกำกับภาษี ส่งลิงก์ให้ลูกค้าสแกนจ่าย ระบบตรวจสลิปแล้วตัดยอดเอง" },
  { icon: Landmark, title: "ภาษีไทยพร้อมยื่น", desc: "ภ.พ.30 · ภ.ง.ด.3/53 · 50 ทวิ · ใบลดหนี้ พร้อมไฟล์สำหรับโปรแกรมของสรรพากร" },
  { icon: BookOpenText, title: "บัญชีคู่และงานสิ้นงวดอัตโนมัติ", desc: "เดบิต/เครดิตลงเองทุกรายการ พร้อมค่าเสื่อมราคาและปิดบัญชีสิ้นปี" },
  { icon: ShieldCheck, title: "ถูกกฎหมายตั้งแต่โครงสร้าง", desc: "จุดความรับผิด VAT แยกสินค้า/บริการ · ล็อกงวดที่ยื่นแล้ว · อัตราภาษีตามวันที่ออกเอกสาร" },
];

const steps = [
  { n: "1", t: "ใส่ข้อมูลกิจการ", d: "ชื่อ เลขผู้เสียภาษี พร้อมเพย์ — 3 นาที" },
  { n: "2", t: "ออกเอกสาร/ถ่ายบิล", d: "พิมพ์สั่ง AI หรือคีย์เองก็ได้" },
  { n: "3", t: "บัญชี-ภาษีเสร็จเอง", d: "สมุดรายวัน รายงาน ไฟล์ยื่นภาษี พร้อมหมด" },
];

// ตัวอย่างการสั่งงานผู้ช่วยบัญชี AI — สะท้อน flow จริง
const demo: { from: "user" | "ai"; text: string }[] = [
  { from: "user", text: "ออกใบแจ้งหนี้ค่าออกแบบเว็บ 25,000 ให้บริษัท สยามเทรด บวก VAT เขาหัก ณ ที่จ่าย 3%" },
  { from: "ai", text: "ออกใบแจ้งหนี้ INV-2026-0042 แล้วค่ะ ยอดรวม 26,750 บาท (VAT 1,750) หัก ณ ที่จ่าย 750 รับจริง 26,000 บาท — ลงบัญชีตั้งลูกหนี้ให้แล้ว ส่งลิงก์ให้ลูกค้าสแกนจ่ายได้เลยค่ะ" },
  { from: "user", text: "(แนบรูปบิลค่าไฟ)" },
  { from: "ai", text: "อ่านบิลแล้วค่ะ: การไฟฟ้านครหลวง 2,340.51 บาท (รวม VAT) — บันทึกเป็นค่าน้ำ/ค่าไฟ EXP-2026-0018 แยกภาษีซื้อ 153.12 ลงสมุดรายวันเรียบร้อยค่ะ" },
  { from: "user", text: "เดือนนี้ต้องยื่นภาษีอะไรบ้าง" },
  { from: "ai", text: "ภ.พ.30: ภาษีขาย 4,120 − ภาษีซื้อ 1,890 = ชำระ 2,230 บาท · ภ.ง.ด.3 มี 2 ราย 1,150 บาท — ดาวน์โหลดรายงานแนบ + ไฟล์ยื่นได้ที่หน้ารายงานเลยค่ะ" },
];

// ราคาตรงกับตาราง plans ในระบบ — แก้ราคาต้องแก้ทั้งสองที่
// จุดขาย: พนักงานไม่จำกัดทุกแพ็ก — จำกัดที่พลัง AI / โควตาสลิป / จำนวนกิจการ
const plans = [
  { name: "เริ่มต้น", price: "99", per: "บาท/เดือน", yearly: "990", items: ["1 กิจการ · พนักงานไม่จำกัด", "เอกสาร/บัญชี/ภาษี ครบ คีย์เองไม่จำกัด", "ตรวจสลิปอัตโนมัติ 100 สลิป/เดือน", "งาน AI 100 คำสั่ง/เดือน"], cta: "เริ่มเลย", hot: false },
  { name: "ธุรกิจ", price: "199", per: "บาท/เดือน", yearly: "1,990", items: ["สูงสุด 3 กิจการ · พนักงานไม่จำกัด", "สมุดรายวัน + 50 ทวิ + AI อ่านบิล", "ตรวจสลิปอัตโนมัติ 200 สลิป/เดือน", "งาน AI 400 คำสั่ง/เดือน — ถูกกว่าเจ้าตลาด และได้ AI ที่เขาไม่มี"], cta: "เลือกแพ็กนี้", hot: true },
  { name: "สำนักงานบัญชี", price: "499", per: "บาท/เดือน", yearly: "4,990", items: ["สูงสุด 10 กิจการ · พนักงานไม่จำกัด", "ไฟล์ยื่นสรรพากร ภ.พ.30 / ภ.ง.ด. (.txt)", "ตรวจสลิปอัตโนมัติ 500 สลิป/เดือน", "งาน AI 1,000 คำสั่ง/เดือน"], cta: "เลือกแพ็กนี้", hot: false },
  { name: "สำนักงานบัญชีใหญ่", price: "999", per: "บาท/เดือน", yearly: "9,990", items: ["ไม่จำกัดจำนวนกิจการ", "ทุกอย่างในสำนักงานบัญชี", "ตรวจสลิปอัตโนมัติไม่จำกัด", "งาน AI 3,000 คำสั่ง/เดือน"], cta: "เลือกแพ็กนี้", hot: false },
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
    // พื้นหลังขาว (5 ส.ค. 2569 เจ้าของเคาะเอง) — เดิมเป็นครีม #F5F4EE แล้วรู้สึกหม่น
    // ขาวทำให้การ์ด bg-neutral-50 กับแถบสลับ section กลายเป็นตัวสร้างจังหวะแทน (แนว apple.com)
    // ห้ามเปลี่ยนกลับเป็นครีมโดยไม่ถามเจ้าของ
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
        {/* items-start ไม่ใช่ items-center — คอลัมน์ขวา (ตัวอย่างแชท) สูงกว่าคอลัมน์ซ้ายมาก
            ถ้าจัดกึ่งกลางแนวตั้ง ข้อความฝั่งซ้ายจะถูกดันลงไปลอยอยู่กลางช่อง
            เกิดช่องว่างก้อนใหญ่เหนือหัวเรื่องบนจอกว้าง ซึ่งคือที่มาของความรู้สึก "ขัดตา"
            ให้สองคอลัมน์เริ่มที่บรรทัดบนสุดพร้อมกัน สายตาจะจับหัวเรื่องได้ทันที */}
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            {/* ไม่มีป้ายแคปซูลบอกว่า "นี่คือระบบบัญชี + AI" แล้ว
                ป้ายแบบนั้นเป็นองค์ประกอบที่หน้าเว็บซึ่ง AI สร้างมีเหมือนกันแทบทุกอัน
                และมันบรรยายสินค้าแทนที่จะพิสูจน์ — ให้ช่องสั่งงานพิสูจน์แทน */}
            <h1 className="text-[34px] font-extrabold leading-[1.08] tracking-[-.03em] text-neutral-900 sm:text-[52px]">
              พิมพ์สั่ง<br />
              <span className="relative whitespace-nowrap text-[#0B6B4A]">
                บัญชีเสร็จทั้งบริษัท
                <span aria-hidden className="absolute inset-x-0 bottom-[.08em] -z-10 h-[.16em] rounded bg-[#0B6B4A]/15" />
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-600 lg:mx-0 mx-auto">
              ใบกำกับภาษีถูกตามกฎหมาย สมุดรายวันเดบิต–เครดิต และรายงานยื่นภาษี
              เกิดขึ้นพร้อมกันจากประโยคเดียว — ใช้ง่ายทั้งเจ้าของกิจการและสำนักงานบัญชี
            </p>

            {/* พระเอกของหน้า: ลองสั่งได้เลยตั้งแต่วินาทีแรก ไม่ต้องสมัคร */}
            <HeroCommand />

            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row lg:justify-start justify-center">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-700">
                เริ่มใช้ฟรี <ArrowRight className="h-4 w-4" />
              </Link>
              {/* คนที่ยังไม่เชื่อว่าระบบดีจะไม่ยอมสมัครเพื่อมาดู — ให้ลองออกเอกสารจริงก่อนได้เลย
                  ต้องอยู่ข้างปุ่มสมัคร ไม่ใช่ซ่อนท้ายหน้า ไม่งั้นเท่ากับไม่มี */}
              <Link href="/try" className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/60 px-5 py-3 text-sm font-semibold text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-50">
                ลองออกเอกสารก่อน ไม่ต้องสมัคร
              </Link>
              <a href="#pricing" className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-white">
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

          {/* ตัวอย่างสั่งงานผู้ช่วยบัญชี AI — ห่อด้วย HeroTilt: เอียง 3D ตามเมาส์ (CSS ล้วน)
              ป้ายผลลัพธ์สองใบ translateZ คนละชั้น = เห็นความลึกจริงตอนการ์ดเอียง
              จอสัมผัสเห็นป้ายลอยช้า ๆ แทน (keyframes hero-float ใน globals.css) */}
          <div className="mx-auto w-full max-w-sm">
            <HeroTilt>
            <div className="relative">
            <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 border-b border-neutral-200 pb-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-white"><Calculator className="h-4 w-4" /></div>
                <div>
                  <p className="text-xs font-semibold">ผู้ช่วยบัญชี AI</p>
                  <p className="text-[10px] text-emerald-600">ลงบัญชีให้ทุกคำสั่ง ตรวจย้อนหลังได้</p>
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
            {/* ป้ายผลลัพธ์ 3D — aria-hidden เพราะเป็นการตกแต่ง เนื้อหาจริงอยู่ในบทสนทนาแล้ว */}
            <div aria-hidden className="pointer-events-none absolute -left-2 top-24 [transform:translateZ(45px)] sm:-left-5">
              <div className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-700 shadow-lg [animation:hero-float_5s_ease-in-out_infinite]">
                <BookOpenText className="h-3.5 w-3.5 text-emerald-600" /> ลงสมุดรายวันแล้ว
              </div>
            </div>
            <div aria-hidden className="pointer-events-none absolute -right-2 bottom-28 [transform:translateZ(60px)] sm:-right-5">
              <div className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-700 shadow-lg [animation:hero-float_6s_ease-in-out_infinite] [animation-delay:1.4s]">
                <Landmark className="h-3.5 w-3.5 text-emerald-600" /> ภ.พ.30 พร้อมยื่น
              </div>
            </div>
            </div>
            </HeroTilt>
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
      <section id="pricing" className="mx-auto max-w-5xl scroll-mt-16 px-6 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight">ราคาตรงไปตรงมา</h2>
        <p className="mt-2 text-center text-sm text-neutral-500">เริ่มฟรี อัปเกรดเมื่อธุรกิจโต ไม่มีสัญญาผูกมัด ยกเลิกได้ตลอด</p>
        <PricingCards plans={plans} />
        <p className="mt-4 text-center text-xs text-neutral-400">
          <b>พนักงานใช้ฟรีไม่จำกัดทุกแพ็ก</b> — เชิญทีมขาย ทีมแอดมิน นักบัญชี เข้ามาได้หมด ·
          เริ่มทดลองใช้ฟรีก่อนได้ (AI 15 คำสั่ง/เดือน) · คีย์เอกสารเองไม่จำกัดทุกแพ็ก
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
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500">
            เริ่มเลย <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/try" className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-700 hover:border-neutral-400">
            ขอลองออกเอกสารดูก่อน
          </Link>
        </div>
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
