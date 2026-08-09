// ตัวแสดงผลของหน้าเนื้อหา — ใช้ร่วมกันทั้งหน้าฟีเจอร์และบทความ
// เขียนที่เดียวเพราะโครงหน้าต้องเหมือนกันทุกหน้า ทั้งเพื่อคนอ่านและเพื่อ Google
import Link from "next/link";
import { ArrowRight, ArrowLeft, Info } from "lucide-react";
import type { ContentPage } from "@/content/seo-pages";
import { resolveRelated } from "@/content/seo-pages";

const SITE = "https://sudochatbot.online";

/** JSON-LD ของหน้าเนื้อหา — Article + FAQPage + เส้นทางนำทาง */
export function contentJsonLd(page: ContentPage) {
  const path = page.kind === "feature" ? `/features/${page.slug}` : `/guide/${page.slug}`;
  const url = `${SITE}${path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: page.h1,
        description: page.description,
        inLanguage: "th",
        mainEntityOfPage: url,
        dateModified: page.updated,
        author: { "@type": "Organization", name: "SudoChatBot", url: SITE },
        publisher: { "@type": "Organization", name: "SudoChatBot", url: SITE },
      },
      {
        "@type": "FAQPage",
        mainEntity: page.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "หน้าแรก", item: SITE },
          {
            "@type": "ListItem", position: 2,
            name: page.kind === "feature" ? "ฟีเจอร์" : "บทความบัญชี-ภาษี",
            item: `${SITE}${page.kind === "feature" ? "/features" : "/guide"}`,
          },
          { "@type": "ListItem", position: 3, name: page.h1, item: url },
        ],
      },
    ],
  };
}

export default function Article({ page }: { page: ContentPage }) {
  const backHref = page.kind === "feature" ? "/features" : "/guide";
  const backLabel = page.kind === "feature" ? "ฟีเจอร์ทั้งหมด" : "บทความทั้งหมด";
  const related = page.related.map(resolveRelated).filter(Boolean) as { href: string; title: string }[];

  return (
    <article>
      <Link href={backHref}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>

      <h1 className="mt-2 text-2xl font-bold leading-snug text-neutral-900 md:text-3xl">{page.h1}</h1>
      <p className="mt-3 text-base leading-relaxed text-neutral-600">{page.lead}</p>

      {page.sections.map((s) => (
        <section key={s.h2} className="mt-8">
          <h2 className="text-lg font-semibold text-neutral-900">{s.h2}</h2>
          {s.p?.map((t) => (
            <p key={t} className="mt-2.5 leading-relaxed text-neutral-700">{t}</p>
          ))}
          {s.ul && (
            <ul className="mt-3 space-y-1.5">
              {s.ul.map((t) => (
                <li key={t} className="flex gap-2.5 leading-relaxed text-neutral-700">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
          {s.table && (
            // ตารางกว้างกว่าจอมือถือแน่นอน ต้องเลื่อนในกล่องตัวเอง ห้ามให้ทั้งหน้าเลื่อนแนวนอน
            <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="bg-neutral-50">
                    {s.table.head.map((h) => (
                      <th key={h} className="px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.table.rows.map((row) => (
                    <tr key={row.join("|")} className="border-t border-neutral-100">
                      {row.map((cell, i) => (
                        <td key={cell + i} className={i === 1 ? "px-3.5 py-2.5 font-semibold tabular-nums text-neutral-900" : "px-3.5 py-2.5 text-neutral-700"}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {s.note && (
            <p className="mt-3 flex gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-sm leading-relaxed text-amber-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{s.note}</span>
            </p>
          )}
        </section>
      ))}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-neutral-900">คำถามที่พบบ่อย</h2>
        <div className="mt-3 space-y-2.5">
          {page.faq.map((f) => (
            <div key={f.q} className="rounded-xl border border-neutral-200 bg-white p-4">
              <h3 className="font-semibold text-neutral-900">{f.q}</h3>
              <p className="mt-1.5 leading-relaxed text-neutral-700">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="font-semibold text-emerald-900">ลองใช้จริงได้เลย ไม่ต้องใส่บัตรเครดิต</p>
        <p className="mt-1.5 text-sm leading-relaxed text-emerald-800">
          ออกเอกสารได้ทันทีตั้งแต่ใบแรก ระบบลงบัญชีและสรุปภาษีของงวดให้เอง
        </p>
        <div className="mt-3.5 flex flex-wrap gap-2">
          <Link href="/signup"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800">
            เริ่มใช้ฟรี <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/try"
            className="inline-flex min-h-11 items-center rounded-xl border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100">
            ลองออกเอกสารก่อนสมัคร
          </Link>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-10 border-t border-neutral-200 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">อ่านต่อ</h2>
          <ul className="mt-2.5 space-y-1">
            {related.map((r) => (
              <li key={r.href}>
                <Link href={r.href}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium leading-snug text-emerald-700 hover:underline">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-xs text-neutral-400">ปรับปรุงล่าสุด {page.updated}</p>
    </article>
  );
}
