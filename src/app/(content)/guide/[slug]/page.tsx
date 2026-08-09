import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Article, { contentJsonLd } from "../../article";
import { GUIDE_PAGES, getContentPage } from "@/content/seo-pages";

export function generateStaticParams() {
  return GUIDE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getContentPage("guide", slug);
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/guide/${page.slug}` },
    openGraph: { title: page.title, description: page.description, url: `/guide/${page.slug}`, type: "article" },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getContentPage("guide", slug);
  if (!page) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contentJsonLd(page)) }} />
      <Article page={page} />
    </>
  );
}
