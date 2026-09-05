import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Article, { contentJsonLd } from "../../article";
import { FEATURE_PAGES, getContentPage } from "@/content/seo-pages";

export function generateStaticParams() {
  return FEATURE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getContentPage("feature", slug);
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    // ⚠️ ทุกหน้าต้องประกาศ canonical ของตัวเอง — layout ไม่ได้ตั้งให้โดยตั้งใจ
    // (ถ้า layout ตั้ง ทุกหน้าจะประกาศว่าตัวเองคือสำเนาของหน้าแรกแล้วหลุดจากดัชนี)
    alternates: { canonical: `/features/${page.slug}` },
    openGraph: { title: page.title, description: page.description, url: `/features/${page.slug}`, type: "article",
      images: ["/opengraph-image"], siteName: "SudoChatBot", locale: "th_TH", modifiedTime: page.updated },
  };
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getContentPage("feature", slug);
  if (!page) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contentJsonLd(page)) }} />
      <Article page={page} />
    </>
  );
}
