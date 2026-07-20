import Link from "next/link";
import { Logo } from "@/components/logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-8 md:p-12">
        <Link href="/" className="inline-flex">
          <Logo />
        </Link>
        <article className="prose prose-neutral mt-6 max-w-none prose-h1:text-2xl prose-h2:mt-8 prose-h2:text-lg [&_h1]:font-bold [&_h2]:font-semibold [&_li]:my-1 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </article>
        <p className="mt-10 border-t border-neutral-100 pt-4 text-xs text-neutral-400">
          SudoChatBot · ติดต่อ: supanut6420@gmail.com ·{" "}
          <Link href="/privacy" className="underline">นโยบายความเป็นส่วนตัว</Link> ·{" "}
          <Link href="/terms" className="underline">ข้อกำหนดการใช้งาน</Link> ·{" "}
          <Link href="/data-deletion" className="underline">การลบข้อมูล</Link>
        </p>
      </div>
    </main>
  );
}
