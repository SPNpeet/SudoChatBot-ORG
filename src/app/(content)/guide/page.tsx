import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GUIDE_PAGES } from "@/content/seo-pages";

export const metadata: Metadata = {
  title: "บทความบัญชี-ภาษีไทย ที่เจ้าของกิจการถามบ่อย",
  description: "หัก ณ ที่จ่ายกี่เปอร์เซ็นต์ ภ.ง.ด.3 กับ 53 ต่างกันยังไง ใบกำกับภาษีต้องมีอะไร ภ.พ.30 ยื่นเมื่อไหร่ — ตอบตามกฎหมายไทย อ่านจบใช้ได้จริง",
  alternates: { canonical: "/guide" },
  // og:url ต้องตรง canonical เสมอ — เดิมสืบทอด url หน้าแรกจาก root (ตรวจพบ 5 ก.ย. 2569 ทุกหน้า)
  openGraph: { url: "/guide", images: ["/opengraph-image"], siteName: "SudoChatBot", locale: "th_TH", type: "website" },
};

export default function GuideIndex() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl">บทความบัญชีและภาษีไทย</h1>
      <p className="mt-3 leading-relaxed text-neutral-600">
        คำถามที่เจ้าของกิจการถามบ่อยที่สุด ตอบตรง ๆ ตามกฎหมายไทย
        พร้อมบอกจุดที่คนพลาดกันจริงและวิธีกันไว้ตั้งแต่ตอนบันทึกเอกสาร
      </p>

      <ul className="mt-6 space-y-2.5">
        {GUIDE_PAGES.map((p) => (
          <li key={p.slug}>
            <Link href={`/guide/${p.slug}`}
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

      <p className="mt-7 rounded-xl bg-neutral-100 px-4 py-3 text-sm leading-relaxed text-neutral-600">
        เนื้อหาทั้งหมดเป็นข้อมูลทั่วไปเพื่อความเข้าใจ ไม่ใช่คำวินิจฉัยทางภาษี
        กรณีเฉพาะของกิจการคุณควรตรวจกับผู้ทำบัญชีหรือประกาศล่าสุดของกรมสรรพากรก่อนใช้จริง
      </p>
    </div>
  );
}
