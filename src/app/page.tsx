import Link from "next/link";
import { Logo } from "@/components/logo";
import HeroCommand from "./hero-command";
import HeroTilt from "./hero-tilt";
import PricingCards from "./pricing-cards";
import { ArrowRight, Check, ShieldCheck, ChevronDown, ChevronUp, FileText, BookOpenText, Landmark, Receipt } from "lucide-react";
import LandingSandboxChat from "./landing-sandbox-chat";
import { getPublicPlans } from "@/lib/plans";

// ============================================================
//  หน้าแรก — แปลงโฉม 6 ส.ค. 2569
//
//  ⚠️ ทำไมรื้อ (เจ้าของสรุปเอง): "ดู AI ทำไปมาก · รกมาก · อันไหนควรอยู่ตรงไหนก็ผิดที่หมด"
//
//  ของเดิมมี 8 บล็อก และมี "ตัวสาธิต 2 อันซ้อนกัน" ในคอลัมน์เดียว —
//  การ์ดแชทตัวอย่างที่เป็นภาพนิ่ง วางทับอยู่บนกล่องลองแชทของจริง
//  สองอันทำหน้าที่เดียวกันเป๊ะ คือ "โชว์ว่าสั่งงานยังไง" ต่างกันแค่อันหนึ่งปลอม
//  เมื่อมีของจริงให้ลองอยู่แล้ว ของปลอมคือความรกล้วน ๆ จึงตัดทิ้ง
//
//  บล็อกที่ยุบรวม: การ์ดฟีเจอร์ 6 ใบ + ตารางเทียบก่อน/หลัง 6 แถว
//  ทั้งสองตอบคำถามเดียวกัน ("ชีวิตเปลี่ยนยังไง") ด้วยวิธีต่างกัน = พูดซ้ำสองรอบ
//  แทนด้วยตารางเส้นทางเดียว: พิมพ์อะไร -> ระบบทำอะไร -> ได้เอกสารอะไรกลับมา
//  ซึ่งเป็นสิ่งที่คู่แข่งไม่มีและเป็นเหตุผลเดียวที่คนจะย้ายมา
//
//  ⚠️ การ์ดฟีเจอร์ 6 ใบเรียงกริด 3 คอลัมน์ คือหน้าตาที่หน้าเว็บซึ่ง AI สร้างมีเหมือนกันทุกอัน
//  ห้ามเอากลับมา — ถ้าต้องอธิบายความสามารถ ให้อธิบายด้วย "ผลลัพธ์ที่ได้จริง" เป็นตาราง
//
//  ภาษาภาพที่เลือก: กระดาษทำการบัญชี — เส้นตาราง ตัวเลขกำกับ ตัวอักษรคมชัด
//  สีเน้นสีเดียว (#0B6B4A) ใช้เท่าที่จำเป็น ไม่มี gradient ไม่มีป้ายแคปซูลลอย
// ============================================================

import { getLang, homeCopy } from "@/lib/i18n";
import LangToggle from "@/components/lang-toggle";

const BRAND = "#0B6B4A";

// เส้นทางจริงของงาน 1 รอบ — คอลัมน์กลางคือสิ่งที่คู่แข่งให้คนทำเอง
const FLOW = [
  {
    n: "01",
    say: "ออกใบแจ้งหนี้ค่าออกแบบเว็บ 25,000 ให้บริษัท สยามเทรด บวก VAT หัก ณ ที่จ่าย 3%",
    does: "คิด VAT และหัก ณ ที่จ่ายตามกฎหมาย ตั้งลูกหนี้ ลงเดบิต–เครดิตให้ครบ",
    gets: ["ใบแจ้งหนี้ + ใบกำกับภาษี", "ลิงก์ให้ลูกค้าสแกนจ่าย", "บันทึกในสมุดรายวัน"],
  },
  {
    n: "02",
    say: "(ถ่ายรูปบิลค่าไฟส่งเข้าไป)",
    does: "อ่านยอด แยกภาษีซื้อ จัดหมวดค่าใช้จ่าย ถามกลับถ้าอ่านไม่ชัด ไม่เดาเอง",
    gets: ["รายการค่าใช้จ่ายพร้อมภาษีซื้อ", "ไฟล์บิลแนบไว้ตรวจย้อนหลัง"],
  },
  {
    n: "03",
    say: "ลูกค้าโอนมาแล้ว ตัดยอดให้ที",
    does: "จับคู่สลิปกับใบแจ้งหนี้ ตรวจสลิปซ้ำทั้งระบบ ตัดยอดค้างรับ",
    gets: ["ใบเสร็จรับเงิน", "ยอดลูกหนี้อัปเดตทันที"],
  },
  {
    n: "04",
    say: "เดือนนี้ต้องยื่นภาษีอะไรบ้าง",
    does: "สรุปภาษีขาย–ภาษีซื้อจากสมุดรายวันจริง ไม่ใช่คีย์ซ้ำอีกรอบ",
    gets: ["ภ.พ.30 · ภ.ง.ด.3/53 · 50 ทวิ", "ไฟล์อัปโหลดเข้าโปรแกรมสรรพากร"],
  },
];

// เอกสารที่ได้กลับมาจริง — ใช้เป็นภาพ 3 มิติแทนภาพตกแต่งที่ไม่ได้บอกอะไร
const OUTPUTS = [
  { icon: Receipt, label: "ใบกำกับภาษี", sub: "ครบตาม ม.86/4" },
  { icon: BookOpenText, label: "สมุดรายวัน", sub: "เดบิต–เครดิตอัตโนมัติ" },
  { icon: Landmark, label: "ภ.พ.30 พร้อมยื่น", sub: "ไฟล์เข้าโปรแกรมสรรพากร" },
];

const AUDIENCE = [
  {
    title: "เจ้าของกิจการ",
    lead: "ไม่ต้องรู้บัญชีก็ทำได้ครบ",
    points: [
      "พิมพ์สั่งหรือถ่ายรูปบิล ไม่ต้องเรียนเมนู",
      "ส่งลิงก์ให้ลูกค้าสแกนจ่าย ระบบตัดยอดเอง",
      "รู้ล่วงหน้าว่าเดือนนี้ต้องจ่ายภาษีเท่าไหร่",
      "ส่งต่อสำนักงานบัญชีเป็น Excel ได้ทั้งงวด",
    ],
  },
  {
    title: "สำนักงานบัญชี",
    lead: "ดูหลายกิจการในบัญชีเดียว",
    points: [
      "สลับกิจการได้ ข้อมูลแยกขาดด้วย Row-Level Security",
      "ไฟล์ยื่น ภ.พ.30 / ภ.ง.ด. ครบทุกลูกค้า",
      "ปิดงวดแล้วล็อกที่ระดับฐานข้อมูล แก้ย้อนหลังไม่ได้",
      "ทุกการแก้ไขมี Audit Log ตรวจได้ว่าใครทำอะไร",
    ],
  },
];

const faqs = [
  { q: "ไม่มีความรู้บัญชีเลย ใช้ได้ไหม?", a: "ได้ — คุณแค่ออกเอกสารหรือถ่ายรูปบิล ระบบลงเดบิต/เครดิตให้เองตามหลักบัญชีคู่ ส่วนที่นักบัญชีต้องใช้ (สมุดรายวัน งบทดลอง รายงานภาษี) ระบบเตรียมให้ครบ ส่งต่อสำนักงานบัญชีได้ทันที" },
  { q: "ต่างจากโปรแกรมบัญชีทั่วไปยังไง?", a: "หัวใจคือ AI: พิมพ์สั่งเป็นภาษาคนหรือถ่ายรูปบิลก็ลงบัญชีได้เลย ไม่ต้องเรียนรู้เมนูซับซ้อน และมีลิงก์เก็บเงินที่ลูกค้าสแกน QR จ่ายแล้วอัปสลิปเองได้ ระบบตรวจสลิปจริง/สลิปซ้ำและตัดยอดให้อัตโนมัติ" },
  { q: "สำนักงานบัญชีใช้ดูแลลูกค้าหลายเจ้าได้ไหม?", a: "ได้ — บัญชีเดียวสร้าง/สลับได้หลายกิจการ ข้อมูลแยกขาดจากกันด้วย Row-Level Security ทุกการแก้ไขมี audit log ตรวจย้อนหลังได้ และเชิญพนักงานเข้าทำงานแยกสิทธิ์ตามบทบาทได้" },
  { q: "เงินเข้าบัญชีใคร?", a: "เข้าบัญชีของคุณโดยตรง — ลิงก์จ่ายเงินที่ส่งให้ลูกค้าใช้พร้อมเพย์ของกิจการคุณเอง เราไม่ได้เป็นตัวกลางถือเงิน และไม่หักเปอร์เซ็นต์จากยอดขายของคุณ" },
  { q: "ตัวเลขเชื่อถือได้แค่ไหน ผิดขึ้นมาใครรับผิดชอบ?", a: "ระบบมีชุดตรวจอัตโนมัติที่รันทุกครั้งก่อนขึ้นระบบจริง ตรวจการปัดเศษ 400,000 เคสว่ามูลค่าก่อนภาษี + VAT เท่ายอดรวมเสมอ · ตรวจว่าฐานหัก ณ ที่จ่ายคิดจากยอดก่อน VAT ไม่ใช่ยอดรวม · ตรวจค่าเสื่อมราคาตลอดอายุทรัพย์สินว่าเหลือราคาซากพอดี และตรวจว่ารายงานภาษีตรงกับสมุดรายวันทุกเดือน ถึงอย่างนั้นระบบเป็นเครื่องมือ ไม่ใช่ผู้ทำบัญชี — ตัวเลขที่ยื่นจริงควรให้ผู้ทำบัญชีหรือผู้สอบบัญชีของคุณตรวจก่อนเสมอ" },
  { q: "อัตรา VAT 7% จะหมดอายุ ระบบรองรับไหม?", a: "รองรับ — อัตราภาษีเก็บเป็นตารางที่มีวันเริ่ม/วันสิ้นสุด เอกสารแต่ละใบใช้อัตราตามวันที่ออกเอกสารของตัวเอง ไม่ใช่อัตราคงที่ในโค้ด ถ้าประกาศใหม่ยังไม่ออก ระบบจะบอกว่ายังไม่ทราบอัตราแทนที่จะเดาให้" },
  { q: "ธุรกิจบริการที่ขายเชื่อใช้ได้ไหม?", a: "ได้ — ตอนออกใบแจ้งหนี้เลือกได้ว่าเป็นสินค้าหรือบริการ ถ้าเป็นบริการขายเชื่อ ระบบพักภาษีขายไว้ก่อนตามมาตรา 78/1 แล้วรับรู้เข้า ภ.พ.30 ในเดือนที่ลูกค้าจ่ายเงินจริง รับเงินหลายงวดข้ามเดือนก็แยกให้ถูกตามสัดส่วน" },
  { q: "ยกเลิกยากไหม ข้อมูลเป็นของใคร?", a: "ไม่มีสัญญาผูกมัด หยุดใช้เมื่อไหร่ก็ได้ ข้อมูลเป็นของคุณ ดาวน์โหลดรายงานเป็น Excel ได้ตลอด และขอลบข้อมูลได้ตามนโยบายความเป็นส่วนตัว" },
];

// ⚠️ หน้าแรกต้องประกาศ canonical ของตัวเอง (8 ส.ค. 2569)
// เดิม canonical ถูกตั้งไว้ที่ layout ซึ่งสืบทอดไปทุกหน้า ทำให้หน้าอื่นประกาศว่า
// ตัวเองคือสำเนาของหน้าแรก — ย้ายมาไว้ที่หน้าเจ้าของ ไม่ให้รั่วไปหน้าอื่นอีก
export const metadata = {
  alternates: { canonical: "https://sudochatbot.online" },
};

// ราคามาจากตาราง plans โดยตรง · แคช 1 ชั่วโมง — หน้าแรกไม่ต้องยิงฐานข้อมูลทุก request
export const revalidate = 3600;

/**
 * ข้อมูลโครงสร้าง FAQ สำหรับ Google
 *
 * ⚠️ ต้องสร้างจากตัวแปร faqs ตัวเดียวกับที่แสดงบนหน้าเท่านั้น
 * Google กำหนดว่าคำถาม-คำตอบใน structured data ต้องตรงกับที่ผู้ใช้เห็นบนหน้าจริง
 * ถ้าเขียนแยกกันสองชุด วันหนึ่งจะแก้ที่หน้าแล้วลืมแก้ที่นี่ = ส่งข้อมูลไม่ตรงให้ Google
 * ซึ่งโดนตัดสิทธิ์ rich result และเสียความน่าเชื่อถือของทั้งโดเมน
 */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default async function Landing() {
  // ⚠️ ฉบับไทยคือข้อความเดิมในไฟล์นี้ (c เป็น null) — ห้ามย้ายข้อความไทยไป i18n
  // เพื่อไม่ให้หน้าที่ลูกค้าปัจจุบันใช้อยู่เปลี่ยนไปแม้แต่ตัวอักษรเดียว
  const lang = await getLang();
  const c = homeCopy(lang);

  const plans = await getPublicPlans();
  // ⚠️ หัวหน้าแรกใช้ "ราคารายเดือนที่ถูกที่สุด" ไม่ใช่ราคาเฉลี่ยรายปี
  // เพราะเป็นคำโฆษณาที่คนอ่านผ่าน ๆ ตัวเลขที่มีเงื่อนไขซ่อน ("ถ้าจ่ายทั้งปีก่อน")
  // ในตำแหน่งนี้คือการโฆษณาราคาที่ผู้อ่านจ่ายจริงไม่ได้ — ส่วนราคาด้านล่างมีสวิตช์งวดให้เห็นเงื่อนไขอยู่แล้ว
  const cheapestMonthly = plans
    .filter((p) => !p.free)
    .map((p) => Number(p.price.replace(/,/g, "")))
    .filter((n) => n > 0)
    .sort((a, b) => a - b)[0];

  // ราคาเริ่มต้นที่ถูกที่สุดหลังลด — ใช้พาดหัวส่วนราคา ห้ามพิมพ์เลขตายตัว
  const cheapest = plans
    .filter((p) => !p.free && p.yearly)
    .map((p) => Math.round(Number(p.yearly!.replace(/,/g, "")) / 12))
    .sort((a, b) => a - b)[0];

  return (
    // พื้นหลังขาว (5 ส.ค. 2569 เจ้าของเคาะเอง) — ห้ามเปลี่ยนกลับเป็นครีมโดยไม่ถาม
    <main className="min-h-screen bg-white">
      {/* FAQ ให้ Google แสดงเป็นคำถาม-คำตอบใต้ผลค้นหา — กินพื้นที่บนหน้าผลลัพธ์มากกว่าผลธรรมดา
          และตอบคำถามที่คนไทยค้นจริง ("โปรแกรมบัญชีไม่มีความรู้บัญชีใช้ได้ไหม") ตั้งแต่ในหน้าค้นหา */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <header className="sticky top-0 z-30 border-b border-neutral-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Logo />
          <div className="flex items-center gap-2">
            <a href="#pricing" className="hidden min-h-[44px] items-center px-3 text-sm text-neutral-500 hover:text-neutral-900 sm:inline-flex">{c?.nav.pricing ?? "ราคา"}</a>
            <LangToggle lang={lang} />
            <Link href="/login" className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: BRAND }}>
              {c?.nav.login ?? "เข้าสู่ระบบ"}
            </Link>
          </div>
        </div>
      </header>

      {/* ================= 1. หัวหน้า ================= */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 sm:pt-16">
        <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
          <div>
            <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-.03em] text-neutral-900 sm:text-[50px]">
              {c?.hero.line1 ?? "AI ทำบัญชีให้"}<br />
              {/* ⚠️ ห้ามใส่ whitespace-nowrap กลับมาที่บรรทัดนี้
                  ข้อความเดิม ("บัญชีเสร็จทั้งบริษัท") สั้นพอจะไม่ล้นตอน nowrap
                  ของใหม่ยาวกว่าเกือบเท่าตัว ใส่ nowrap แล้วจะดันจอล้นแนวนอนบนมือถือทันที */}
              <span className="relative" style={{ color: BRAND }}>
                {c?.hero.line2 ?? "ไม่ต้องไปสมัคร AI ที่ไหนเพิ่ม"}
                <span aria-hidden className="absolute inset-x-0 bottom-[.08em] -z-10 h-[.16em] rounded" style={{ backgroundColor: "rgba(11,107,74,.15)" }} />
              </span>
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-neutral-600">
              {c?.hero.lead ?? "ผู้ช่วยบัญชี AI อยู่ในเว็บนี้เลย เปิดแล้วพิมพ์สั่งได้ทันที ไม่ต้องมีบัญชี ChatGPT หรือ Claude ของตัวเอง — และใบกำกับภาษี สมุดรายวันเดบิต–เครดิต กับรายงานยื่นสรรพากร เกิดขึ้นพร้อมกันจากคำสั่งเดียวนั้น"}
            </p>

            {/* พระเอกของหน้า: ลองสั่งได้ตั้งแต่วินาทีแรก ไม่ต้องสมัคร */}
            <HeroCommand cmd={c?.heroCmd} />

            {/* ⚠️ 2 ปุ่ม ไม่ใช่ 3 — ของเดิมมีปุ่มระดับเดียวกันสามอันเรียงกัน
                (เริ่มใช้ฟรี / ลองออกเอกสารก่อน / ดูราคา) ทางเลือกที่มากเกินทำให้ไม่เลือกอะไรเลย
                "ดูราคา" ย้ายไปอยู่บนแถบหัวซึ่งเป็นที่ที่คนไปหามันอยู่แล้ว */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: BRAND }}>
                {c?.hero.ctaPrimary ?? "เริ่มใช้ฟรี"} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/try"
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-neutral-300 bg-white px-6 text-[15px] font-semibold text-neutral-800 transition-colors hover:border-neutral-400">
                {c?.hero.ctaSecondary ?? "ลองออกเอกสารก่อน"}
              </Link>
            </div>

            <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-500">
              {[
                c
                  ? `${c.hero.pricePrefix} ${(cheapestMonthly ?? 99).toLocaleString("en-US")} ${c.hero.priceSuffix}`
                  : `เดือนละ ${(cheapestMonthly ?? 99).toLocaleString("th-TH")} บาท`,
                // ⚠️ ตัด "ลองฟรี 3 ครั้ง ไม่ต้องสมัคร" ออกจากแถบนี้โดยตั้งใจ
                // ช่องสั่งงาน (HeroCommand) ที่อยู่เหนือขึ้นไป 1 นิ้วเขียนประโยคนี้อยู่แล้ว
                // เขียนซ้ำในระยะสายตาเดียวกันทำให้หน้ารก และเป็นปัญหาเดียวกับที่รื้อหน้าแรกไปแล้วรอบหนึ่ง
                ...(c?.hero.trust ?? ["ไม่ต้องใช้บัตรเครดิต", "เงินเข้าบัญชีคุณโดยตรง"]),
              ].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" style={{ color: BRAND }} /> {t}
                </span>
              ))}
            </p>
          </div>

          {/* ⚠️ คอลัมน์นี้เหลือ (c?.flowHead.real ?? "ของจริง") อันเดียว
              เดิมมีการ์ดแชทตัวอย่างแบบภาพนิ่งวางทับกล่องลองแชทจริง = โชว์เรื่องเดียวกันสองรอบ
              เมื่อให้ลองของจริงได้ฟรีอยู่แล้ว ภาพนิ่งไม่ได้เพิ่มความเชื่อ มีแต่เพิ่มความรก */}
          <div className="lg:pt-2">
            <LandingSandboxChat copy={c?.guestChat} />
          </div>
        </div>
      </section>

      {/* ================= 2. เส้นทางงานจริง 1 รอบ ================= */}
      <section className="border-t border-neutral-100 bg-neutral-50/70 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="max-w-2xl text-[26px] font-bold leading-tight tracking-tight text-neutral-900">
            {c?.flowIntro.title ?? "สิ่งที่คุณพิมพ์ กับสิ่งที่ได้กลับมา"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">
            {c?.flowIntro.lead ?? "คอลัมน์กลางคืองานที่โปรแกรมบัญชีทั่วไปให้คุณทำเอง — ที่นี่ระบบทำให้ตั้งแต่ประโยคแรก"}
          </p>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            {/* ตารางเส้นทาง — ภาษาภาพแบบกระดาษทำการ: เส้นคั่น ตัวเลขกำกับ ไม่มีการ์ดลอย */}
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              <div className="hidden grid-cols-[auto_1.1fr_1fr_1fr] gap-4 border-b border-neutral-200 bg-neutral-50 px-5 py-2.5 text-xs font-semibold text-neutral-500 sm:grid">
                <span className="w-7" />
                <span>{c?.flowHead.say ?? "คุณพิมพ์"}</span>
                <span>{c?.flowHead.does ?? "ระบบทำให้"}</span>
                <span style={{ color: BRAND }}>{c?.flowHead.gets ?? "ได้กลับมา"}</span>
              </div>
              {(c?.flow ?? FLOW).map((f) => (
                // ⚠️ บนมือถือกริดยุบเหลือคอลัมน์เดียวและหัวตารางถูกซ่อน
                // ถ้าไม่ติดป้ายกำกับไว้ ผู้ใช้จะเห็นข้อความสามย่อหน้าเรียงกันโดยไม่รู้ว่าอันไหนคืออะไร
                // ป้ายจึงต้องโผล่เฉพาะจอเล็ก (sm:hidden) ไม่ใช่ซ้ำกับหัวตารางบนจอกว้าง
                <div key={f.n} className="grid gap-3 border-b border-neutral-100 px-5 py-4 last:border-0 sm:grid-cols-[auto_1.1fr_1fr_1fr] sm:gap-4">
                  <span className="text-sm font-bold tabular-nums text-neutral-300 sm:w-7">{f.n}</span>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-neutral-400 sm:hidden">{c?.flowHead.say ?? "คุณพิมพ์"}</p>
                    <p className="text-[13px] font-medium leading-relaxed text-neutral-900">&ldquo;{f.say}&rdquo;</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-neutral-400 sm:hidden">{c?.flowHead.does ?? "ระบบทำให้"}</p>
                    <p className="text-[13px] leading-relaxed text-neutral-500">{f.does}</p>
                  </div>
                  <ul className="space-y-1">
                    <li className="mb-1 list-none text-xs font-semibold sm:hidden" style={{ color: BRAND }}>{c?.flowHead.gets ?? "ได้กลับมา"}</li>
                    {f.gets.map((g) => (
                      <li key={g} className="flex items-start gap-1.5 text-[13px] font-medium leading-relaxed text-neutral-800">
                        <Check className="mt-[3px] h-3.5 w-3.5 shrink-0" style={{ color: BRAND }} /> {g}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* เอกสารที่ได้จริง — ใช้เอฟเฟกต์ 3 มิติกับ (c?.outputsHead.result ?? "ผลลัพธ์") ไม่ใช่กับของตกแต่ง
                (เดิมเอียงการ์ดแชทปลอม ซึ่งเอียงแล้วก็ยังเป็นของปลอมอยู่ดี) */}
            <HeroTilt>
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{c?.outputsHead.every ?? "ทุกรอบจบด้วย"}</p>
                <div className="mt-4 space-y-3">
                  {OUTPUTS.map((o, i) => (
                    <div key={o.label}
                      className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
                      style={{ transform: `translateZ(${20 + i * 22}px)` }}>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: "rgba(11,107,74,.08)" }}>
                        <o.icon className="h-4 w-4" style={{ color: BRAND }} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-neutral-900">{c?.outputs[i]?.label ?? o.label}</span>
                        <span className="block text-xs text-neutral-500">{c?.outputs[i]?.sub ?? o.sub}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 flex items-start gap-2 border-t border-neutral-100 pt-3 text-xs leading-relaxed text-neutral-500">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: BRAND }} />
                  {c?.audienceNote ?? "ยกเลิกเอกสารได้แบบกลับรายการ ตรวจย้อนหลังได้ตลอด ไม่มีการแก้ตัวเลขทิ้งร่องรอย"}
                </p>
              </div>
            </HeroTilt>
          </div>
        </div>
      </section>

      {/* ================= 3. เหมาะกับใคร ================= */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-[26px] font-bold leading-tight tracking-tight text-neutral-900">{c?.audienceHead ?? "ใช้ได้ทั้งสองฝั่งของโต๊ะ"}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {(c?.audience ?? AUDIENCE).map((a) => (
              <div key={a.title} className="rounded-2xl border border-neutral-200 p-6">
                <p className="text-base font-bold text-neutral-900">{a.title}</p>
                <p className="mt-0.5 text-sm font-medium" style={{ color: BRAND }}>{a.lead}</p>
                <ul className="mt-4 space-y-2.5">
                  {a.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-[13px] leading-relaxed text-neutral-600">
                      <Check className="mt-[3px] h-3.5 w-3.5 shrink-0" style={{ color: BRAND }} /> {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 4. ราคา ================= */}
      {/* ⚠️ พาดหัวต้องพูดเรื่อง (c?.pricingHead.cheap ?? "ถูกแค่ไหน") ไม่ใช่ (c?.pricingHead.straight ?? "เราตรงไปตรงมา")
          ของเดิมเขียนว่า (c?.pricingHead.title ?? "ราคาตรงไปตรงมา") ซึ่งเป็นคำที่ทุกเจ้าเขียนเหมือนกันหมด
          และไม่ได้ให้เหตุผลว่าทำไมต้องซื้อ — ตัวเลขที่ถูกที่สุดต้องอยู่ในพาดหัวเลย */}
      <section id="pricing" className="scroll-mt-16 border-t border-neutral-100 bg-neutral-50/70 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-[26px] font-bold leading-tight tracking-tight text-neutral-900">
            {/* ⚠️ อังกฤษสลับลำดับคำ (Starting at 83 THB per month) แปลทีละคำแล้วจะได้ประโยคที่คนอังกฤษไม่พูด */}
            {c ? (
              <>{c.pricing.from} <span style={{ color: BRAND }} className="tabular-nums">{cheapest ? cheapest.toLocaleString("en-US") : "83"}</span> {c.pricing.baht} {c.pricing.perMonth}</>
            ) : (
              <>เริ่มที่เดือนละ <span style={{ color: BRAND }} className="tabular-nums">{cheapest ? cheapest.toLocaleString("th-TH") : "83"}</span> บาท</>
            )}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm leading-relaxed text-neutral-500">
            {c?.pricing.note ?? "ไม่มีค่าติดตั้ง ไม่มีค่าแรกเข้า ไม่มีสัญญาผูกมัด — และไม่คิดค่าหัวพนักงาน จะเชิญทีมขาย แอดมิน หรือนักบัญชีเข้ามากี่คนก็ได้ทุกแพ็ก"}
          </p>
          <PricingCards plans={plans} t={c?.pricing} pc={c?.plans} />
          <p className="mt-6 text-center text-xs leading-relaxed text-neutral-400">
            {c?.pricing.footnote ?? "คีย์เอกสารเองไม่จำกัดทุกแพ็ก แม้โควตา AI หมด · ที่จำกัดคืองาน AI (ผู้ช่วย + อ่านบิล) เท่านั้น · ราคายังไม่รวม VAT"}
          </p>
        </div>
      </section>

      {/* ================= 5. คำถามที่เจอบ่อย ================= */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-6 text-[26px] font-bold leading-tight tracking-tight text-neutral-900">{c?.faqHead ?? "คำถามที่เจอบ่อย"}</h2>
          <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200">
            {(c?.faqs ?? faqs).map((f) => (
              // ⚠️ วัดบนมือถือจริง 6 ส.ค. 2569: หัวข้อคำถามสูงแค่ 20px (เกณฑ์โปรเจกต์คือ 44px)
              // และไม่มีสัญญาณอะไรบอกว่ากดกางได้เลย เพราะ marker ถูกซ่อนไว้
              <details key={f.q} className="group px-5">
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-neutral-800 marker:content-none">
                  {f.q}
                  {/* สลับไอคอนด้วย display ใน globals.css — อย่าเปลี่ยนเป็นหมุนไอคอนตัวเดียว เหตุผลอยู่ที่นั่น */}
                  <ChevronDown className="chev-closed h-4 w-4 shrink-0 text-neutral-400" />
                  <ChevronUp className="chev-open h-4 w-4 shrink-0 text-neutral-500" />
                </summary>
                <p className="pb-4 text-[13px] leading-relaxed text-neutral-500">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 6. ปิดท้าย ================= */}
      <section className="border-t border-neutral-100 py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <FileText className="mx-auto h-8 w-8" style={{ color: BRAND }} />
          <h2 className="mt-4 text-[26px] font-bold leading-tight tracking-tight text-neutral-900">{c?.finalCta ?? "ออกเอกสารใบแรกได้ใน 3 นาที"}</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">
            {c?.finalCtaLead ?? "สมัครฟรี ไม่ต้องใช้บัตร — สั่งผู้ช่วยเป็นภาษาคนได้ทันทีตั้งแต่ใบแรก"}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: BRAND }}>
              {c?.hero.ctaPrimary ?? "เริ่มใช้ฟรี"} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/try"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-neutral-300 bg-white px-6 text-[15px] font-semibold text-neutral-800 transition-colors hover:border-neutral-400">
              {c?.hero.ctaSecondary ?? "ลองออกเอกสารก่อน"}
            </Link>
          </div>
        </div>
      </section>

      {/* แถบ CTA ติดล่างบนมือถือ — เลื่อนอ่านถึงไหนก็สมัครได้ทันที */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
        <Link href="/signup" className="flex h-12 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white active:scale-[0.99]"
          style={{ backgroundColor: BRAND }}>
          {c?.stickyCta ?? "เริ่มใช้ฟรี ไม่ต้องใช้บัตร"} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <footer className="border-t border-neutral-100 py-8 pb-24 sm:pb-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-xs text-neutral-400">
          {/* ⚠️ ลิงก์ไปหน้าเนื้อหาต้องมีอยู่ตรงนี้ (เพิ่ม 9 ส.ค. 2569)
              หน้าฟีเจอร์/บทความ/ราคา ถูกสร้างขึ้นเพื่อให้คนที่ไม่รู้จักชื่อแบรนด์ค้นเจอ
              ถ้าไม่มีลิงก์จากหน้าแรกเลย มันจะเป็นหน้าที่ลอยอยู่โดดๆ ซึ่งถูกเก็บเข้าดัชนีช้ากว่ามาก
              และคนที่เข้ามาหน้าแรกก็ไม่มีทางรู้ว่ามีหน้าพวกนี้อยู่ */}
          <div className="flex flex-wrap justify-center gap-x-4">
            <Link href="/features" className="inline-flex min-h-[44px] items-center px-1 hover:text-neutral-600">{c?.footer.features ?? "ฟีเจอร์ทั้งหมด"}</Link>
            <Link href="/guide" className="inline-flex min-h-[44px] items-center px-1 hover:text-neutral-600">{c?.footer.articles ?? "บทความบัญชี-ภาษี"}</Link>
            <Link href="/pricing" className="inline-flex min-h-[44px] items-center px-1 hover:text-neutral-600">{c?.footer.pricing ?? "ราคา"}</Link>
          </div>
          <div className="flex flex-wrap justify-center gap-x-4">
            {/* หน้าความเชื่อถือ — เครื่องมือตรวจ trust ภายนอกมองหาสามหน้านี้ตรง ๆ (28 ส.ค. 2569) */}
            <Link href="/about" className="inline-flex min-h-[44px] items-center px-1 hover:text-neutral-600">{c?.footer.about ?? "เกี่ยวกับเรา"}</Link>
            <Link href="/contact" className="inline-flex min-h-[44px] items-center px-1 hover:text-neutral-600">{c?.footer.contact ?? "ติดต่อเรา"}</Link>
            <Link href="/refund" className="inline-flex min-h-[44px] items-center px-1 hover:text-neutral-600">{c?.footer.refund ?? "นโยบายการคืนเงิน"}</Link>
            <Link href="/privacy" className="inline-flex min-h-[44px] items-center px-1 hover:text-neutral-600">{c?.footer.privacy ?? "นโยบายความเป็นส่วนตัว"}</Link>
            <Link href="/terms" className="inline-flex min-h-[44px] items-center px-1 hover:text-neutral-600">{c?.footer.terms ?? "เงื่อนไขการใช้งาน"}</Link>
            <Link href="/data-deletion" className="inline-flex min-h-[44px] items-center px-1 hover:text-neutral-600">{c?.footer.deletion ?? "การลบข้อมูล"}</Link>
            <a href="mailto:support@sudochatbot.online" className="inline-flex min-h-[44px] items-center px-1 hover:text-neutral-600">{c?.footer.contact ?? "ติดต่อเรา"}</a>
          </div>
          <p>© {new Date().getFullYear()} {c?.tagline ?? "SudoChatBot — ระบบบัญชีออนไลน์ + ผู้ช่วยบัญชี AI สำหรับ SME ไทย"}</p>
        </div>
      </footer>
    </main>
  );
}
