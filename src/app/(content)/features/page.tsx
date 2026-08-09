import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FEATURE_PAGES } from "@/content/seo-pages";

export const metadata: Metadata = {
  title: "ฟีเจอร์ทั้งหมด — ระบบบัญชีออนไลน์สำหรับ SME ไทย",
  description: "ออกใบกำกับภาษี ใบแจ้งหนี้ รายงาน ภ.พ.30 หัก ณ ที่จ่าย 50 ทวิ สมุดรายวัน งบทดลอง และผู้ช่วยบัญชี AI — ดูว่าระบบทำอะไรให้ได้บ้าง",
  alternates: { canonical: "/features" },
};

export default function FeaturesIndex() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl">ระบบทำอะไรให้ได้บ้าง</h1>
      <p className="mt-3 leading-relaxed text-neutral-600">
        งานเอกสาร งานบัญชี และงานภาษีของ SME ไทย อยู่ในระบบเดียวกัน
        ออกเอกสารหนึ่งใบคือลงบัญชีเสร็จหนึ่งรายการ ไม่ต้องคีย์ซ้ำที่ไหนอีก
      </p>

      <ul className="mt-6 space-y-2.5">
        {FEATURE_PAGES.map((p) => (
          <li key={p.slug}>
            <Link href={`/features/${p.slug}`}
              className="group flex min-h-11 items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50">
              <div className="min-w-0">
                <h2 className="font-semibold leading-snug text-neutral-900 group-hover:text-emerald-900">{p.h1}</h2>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">{p.description}</p>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300 group-hover:text-emerald-700" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/signup"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800">
          เริ่มใช้ฟรี <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/pricing"
          className="inline-flex min-h-11 items-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100">
          ดูราคา
        </Link>
      </div>
    </div>
  );
}
