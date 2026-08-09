// ============================================================
//  หน้าราคาแยกเป็น URL ของตัวเอง
//
//  ⚠️ ทำไมต้องแยกหน้า (9 ส.ค. 2569)
//  "ราคา" เป็นคำที่คนพิมพ์ค้นตอนกำลังจะตัดสินใจซื้อ ซึ่งเป็นคำค้นที่มีค่าที่สุด
//  แต่เดิมราคาอยู่เป็นแค่ส่วนหนึ่งของหน้าแรก จึงไม่มี URL ให้ Google ส่งคนมาลง
//
//  ⚠️ ราคาต้องมาจาก getPublicPlans() เท่านั้น ห้ามพิมพ์ตัวเลขทับที่นี่
//  บทเรียน 6 ส.ค. 2569: เคยเขียนราคาไว้ในไฟล์หน้าแรกด้วย แล้วฐานข้อมูลมี 5 แพ็ก
//  แต่หน้าแรกโชว์ 4 — ราคาที่โฆษณาไม่ตรงกับที่เก็บเงินจริงคือเรื่องใหญ่กว่าความไม่สวย
// ============================================================
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { getPublicPlans } from "@/lib/plans";

// ราคาเปลี่ยนไม่บ่อย แต่ต้องไม่ค้างข้ามวัน — สร้างใหม่ทุกชั่วโมง
export const revalidate = 3600;

const SITE = "https://sudochatbot.online";

export const metadata: Metadata = {
  title: "ราคา — โปรแกรมบัญชีออนไลน์ เริ่มฟรี ไม่ต้องใช้บัตร",
  description: "ราคาโปรแกรมบัญชีออนไลน์ SudoChatBot ทุกแพ็กใช้พนักงานไม่จำกัด มีแพ็กฟรีให้เริ่มก่อน จ่ายรายปีได้ราคา 10 เดือนใช้ 12 เดือน",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const plans = await getPublicPlans();
  const paid = plans.filter((p) => !p.free);
  const lowest = paid.length ? paid[paid.length - 1] : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "SudoChatBot — ระบบบัญชีออนไลน์และผู้ช่วยบัญชี AI",
    description: "ระบบบัญชีออนไลน์สำหรับ SME ไทย ออกใบกำกับภาษี รายงานภาษี สมุดรายวัน และผู้ช่วยบัญชี AI",
    url: `${SITE}/pricing`,
    offers: plans.map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: p.price.replace(/,/g, ""),
      priceCurrency: "THB",
      url: `${SITE}/pricing`,
      availability: "https://schema.org/InStock",
    })),
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl">ราคา</h1>
      <p className="mt-3 leading-relaxed text-neutral-600">
        ทุกแพ็กใช้พนักงานได้ไม่จำกัดคน เราคิดตามปริมาณงาน AI และจำนวนกิจการ ไม่ได้คิดรายหัว
        เพราะการคิดรายหัวทำให้ร้านต้องแชร์รหัสผ่านกันใช้ ซึ่งอันตรายกว่าที่ประหยัดได้
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {plans.map((p) => (
          <div key={p.code}
            className={p.hot
              ? "rounded-2xl border-2 border-emerald-600 bg-white p-5"
              : "rounded-2xl border border-neutral-200 bg-white p-5"}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold text-neutral-900">{p.name}</h2>
              {p.hot && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">แนะนำ</span>}
            </div>
            <p className="mt-2">
              <span className="text-2xl font-bold tabular-nums text-neutral-900">{p.price}</span>
              <span className="text-sm text-neutral-500"> บาท/เดือน</span>
            </p>
            {p.yearly && (
              <p className="mt-0.5 text-xs text-neutral-500">
                รายปี {p.yearly} บาท — จ่าย 10 เดือน ใช้ 12 เดือน
              </p>
            )}
            <ul className="mt-3.5 space-y-1.5">
              {p.items.map((it) => (
                <li key={it} className="flex gap-2 text-sm leading-relaxed text-neutral-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap gap-2">
        <Link href="/signup"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800">
          เริ่มใช้ฟรี <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/features"
          className="inline-flex min-h-11 items-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100">
          ดูว่าทำอะไรได้บ้าง
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-neutral-900">คำถามที่พบบ่อยเรื่องราคา</h2>
        <div className="mt-3 space-y-2.5">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="font-semibold text-neutral-900">แพ็กฟรีใช้ได้จริงหรือแค่ทดลอง</h3>
            <p className="mt-1.5 leading-relaxed text-neutral-700">
              ใช้ได้จริงต่อเนื่อง ออกเอกสารและลงบัญชีเองได้ไม่จำกัดจำนวน
              สิ่งที่จำกัดคือจำนวนงานที่ให้ AI ทำให้และจำนวนสลิปที่ตรวจอัตโนมัติต่อเดือน
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="font-semibold text-neutral-900">คิดค่าใช้จ่ายตามจำนวนผู้ใช้ไหม</h3>
            <p className="mt-1.5 leading-relaxed text-neutral-700">
              ไม่คิด ทุกแพ็กเพิ่มพนักงานได้ไม่จำกัดคน และกำหนดสิทธิ์รายคนได้
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="font-semibold text-neutral-900">เปลี่ยนแพ็กหรือยกเลิกทีหลังได้ไหม</h3>
            <p className="mt-1.5 leading-relaxed text-neutral-700">
              ได้ เอกสารและบัญชีที่บันทึกไว้ยังอยู่ครบ และดาวน์โหลดข้อมูลออกไปเป็นไฟล์ Excel ได้ตลอด
            </p>
          </div>
          {lowest && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="font-semibold text-neutral-900">จ่ายเงินยังไง</h3>
              <p className="mt-1.5 leading-relaxed text-neutral-700">
                จ่ายผ่านหน้าชำระเงินที่รองรับพร้อมเพย์และบัตรเครดิต ตัดรอบตามแพ็กที่เลือก
                ใบเสร็จออกให้ในระบบ
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
