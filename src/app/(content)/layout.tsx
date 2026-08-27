// ============================================================
//  โครงหน้าเนื้อหาสาธารณะ (ฟีเจอร์ · บทความ · ราคา)
//
//  ⚠️ ทำไมหน้าพวกนี้ถึงมี (9 ส.ค. 2569)
//  วัดแล้วพบว่า sitemap มี 6 URL และ 3 ใน 6 คือหน้ากฎหมาย เหลือหน้าที่ติดคำค้นได้ 3 หน้า
//  คนที่ไม่รู้จักชื่อแบรนด์จึงไม่มีทางเจอเราเลย — หน้าพวกนี้คือทางเข้าจากคำค้นจริง
//
//  ทุกหน้าต้องมีทางออกทั้งบนและล่าง เพราะคนมาจากผลค้นหาโดยตรง ไม่ได้มาจากหน้าแรก
//  กดย้อนกลับของเบราว์เซอร์จึงพากลับไป Google ไม่ใช่กลับเข้าเว็บเรา (บทเรียนเดียวกับหน้ากฎหมาย)
// ============================================================
import Link from "next/link";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/features", label: "ฟีเจอร์" },
  { href: "/guide", label: "บทความบัญชี-ภาษี" },
  { href: "/pricing", label: "ราคา" },
];

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5">
          <Link href="/" className="inline-flex min-h-11 items-center" aria-label="กลับหน้าแรก">
            <Logo />
          </Link>
          <nav className="flex items-center gap-0.5">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}
                className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 sm:px-3">
                {n.label}
              </Link>
            ))}
            <Link href="/login"
              className="ml-1 inline-flex min-h-11 items-center rounded-lg bg-neutral-900 px-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-700">
              เข้าสู่ระบบ
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-7 md:py-12">{children}</main>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8">
          {/* ⚠️ ห้ามเอาเมนู NAV มาซ้ำตรงนี้ (แก้ 27 ส.ค. 2569)
              แถบหัวหน้าเป็น sticky อยู่แล้ว เมนูชุดเดียวกันจึงอยู่แค่ที่เดียวก็พอ
              ตอนวางซ้ำทั้งหัวและท้าย ด่าน check:dupbuttons จับได้ว่าบนจอ 390px
              มีปุ่มชื่อเดียวกันโผล่ 2 ครั้งในหน้าเดียว ซึ่งเป็นความรกที่เจ้าของเคยบ่นไว้ตรง ๆ
              ลิงก์ภายในสำหรับเครื่องมือค้นหาก็ไม่ได้หายไป เพราะหัวหน้ามีครบทุกหน้าอยู่แล้ว */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/try" className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-700 hover:underline">
              ลองออกเอกสารฟรี
            </Link>
            <Link href="/signup" className="inline-flex min-h-11 items-center text-sm font-medium text-neutral-600 hover:text-neutral-900">
              สมัครใช้งาน
            </Link>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-neutral-400">
            <span>SudoChatBot — ระบบบัญชีออนไลน์และผู้ช่วยบัญชี AI สำหรับ SME ไทย</span>
            <span>· <Link href="/privacy" className="underline hover:text-neutral-600">นโยบายความเป็นส่วนตัว</Link></span>
            <span>· <Link href="/terms" className="underline hover:text-neutral-600">ข้อกำหนดการใช้งาน</Link></span>
          </p>
          <p className="mt-2 text-xs text-neutral-400">
            เนื้อหาในหน้านี้เป็นข้อมูลทั่วไปเพื่อความเข้าใจ ไม่ใช่คำวินิจฉัยทางภาษีหรือคำแนะนำเฉพาะราย
            กรุณาตรวจกับผู้ทำบัญชีหรือประกาศล่าสุดของกรมสรรพากรก่อนใช้จริง
          </p>
        </div>
      </footer>
    </div>
  );
}
