// ============================================================
//  โครงหน้าเอกสารกฎหมาย (นโยบายความเป็นส่วนตัว · ข้อกำหนด · การลบข้อมูล)
//
//  ผู้ใช้แจ้งว่า "เข้ามาแล้วออกไม่ได้" — เดิมมีแค่โลโก้ที่กดกลับได้
//  แต่ไม่มีอะไรบอกว่ามันกดได้ คนไม่กดโลโก้ถ้าไม่มีสัญญาณว่านั่นคือทางกลับ
//  โดยเฉพาะหน้าพวกนี้ที่คนมักเปิดจากลิงก์ตรง (LINE/Meta ลงทะเบียน URL ไว้)
//  จึงไม่ได้มาจากหน้าอื่นในเว็บ กดย้อนกลับของเบราว์เซอร์ก็ไม่มีที่ให้กลับ
//
//  ใส่ทางออกทั้งบนและล่าง — คนอ่านจบแล้วอยู่ท้ายหน้า ไม่ควรต้องเลื่อนขึ้นไปหาทางกลับ
// ============================================================
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/about", label: "เกี่ยวกับเรา" },
  { href: "/contact", label: "ติดต่อเรา" },
  { href: "/privacy", label: "นโยบายความเป็นส่วนตัว" },
  { href: "/terms", label: "ข้อกำหนดการใช้งาน" },
  { href: "/refund", label: "นโยบายการคืนเงิน" },
  { href: "/data-deletion", label: "การลบข้อมูล" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-6 md:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Link href="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-100">
            <ArrowLeft className="h-4 w-4" /> กลับหน้าแรก
          </Link>
          <Link href="/login" className="text-sm font-medium text-emerald-700 hover:underline">
            เข้าสู่ระบบ
          </Link>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 md:p-12">
          <Link href="/" className="inline-flex" aria-label="กลับหน้าแรก">
            <Logo />
          </Link>
          <article className="prose prose-neutral mt-6 max-w-none prose-h1:text-2xl prose-h2:mt-8 prose-h2:text-lg [&_h1]:font-bold [&_h2]:font-semibold [&_li]:my-1 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6">
            {children}
          </article>

          <div className="mt-10 border-t border-neutral-100 pt-5">
            <Link href="/"
              className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-700">
              <ArrowLeft className="h-4 w-4" /> กลับหน้าแรก
            </Link>
            {/* ⚠️ ลิงก์ท้ายหน้าต้องกดติดด้วยนิ้ว — วัดจริง 5 ก.ย. 2569 ได้สูงแค่ 19px
                หน้ากฎหมายคือหน้าที่คนกดตอนกำลังตัดสินใจว่าจะเชื่อระบบไหม กดพลาด = เลิกอ่าน */}
            <p className="mt-4 text-xs text-neutral-400">SudoChatBot · ติดต่อ: supanut6420@gmail.com</p>
            <div className="-mx-2 mt-1 flex flex-wrap items-center text-xs text-neutral-400">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}
                  className="inline-flex min-h-11 items-center px-2 underline underline-offset-2 hover:text-neutral-600">
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
