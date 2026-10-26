import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PostList from "@/components/PostList";
import { CATEGORY_SLUGS, getCategory } from "@/lib/categories";
import { HTML_LANG, localePath } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { UI } from "@/lib/messages";
import { absUrl, pageMeta } from "@/lib/meta";
import { getAllPosts } from "@/lib/posts";
import { getSite, SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return CATEGORY_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/categories/[slug]">): Promise<Metadata> {
  const lang = await getLang();
  const category = getCategory((await params).slug, lang);
  if (!category) return {};
  return pageMeta({ lang, path: `/categories/${category.slug}`, title: category.name, description: category.blurb });
}

export default function CategoryPage({ params }: PageProps<"/[lang]/categories/[slug]">) {
  return (
    <main data-world="orbit" className="page">
      {/* 窄屏时聚焦的行星画在这块空白里 */}
      <div className="orbit-stage" aria-hidden="true" />
      <Suspense fallback={null}>
        <CategoryPanel params={params} />
      </Suspense>
    </main>
  );
}

async function CategoryPanel({ params }: { params: Promise<{ slug: string }> }) {
  const lang = await getLang();
  const t = UI[lang].categories;
  const site = getSite(lang);
  const category = getCategory((await params).slug, lang);
  if (!category) notFound();
  const posts = (await getAllPosts(lang)).filter((p) => p.category === category.slug);
  const minutes = posts.reduce((n, p) => n + p.readingMinutes, 0);
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} · ${site.name}`,
    description: category.blurb,
    url: absUrl(lang, `/categories/${category.slug}`),
    inLanguage: HTML_LANG[lang],
    numberOfItems: posts.length,
    isPartOf: SITE_URL ? { "@type": "WebSite", name: site.name, url: absUrl(lang, "/") } : undefined,
    about: { "@type": "Thing", name: category.name },
    mainEntity: {
      "@type": "ItemList",
      name: t.postsOf(category.name),
      numberOfItems: posts.length,
      itemListElement: posts.map((post, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absUrl(lang, `/blog/${post.slug}`),
        name: post.title,
      })),
    },
  };

  return (
    <section className="panel side" data-ui style={{ display: "grid", gap: 12 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
      <Link href={localePath(lang, "/categories")} className="back">
        {t.back}
      </Link>
      <h1 className="display" style={{ fontSize: "clamp(32px, 5vw, 48px)" }}>
        <span className="dot" style={{ background: category.color, width: 14, height: 14 }} />
        {category.name}
      </h1>
      <p className="lede">{category.blurb}</p>
      <p className="cat-stats">{t.stats(posts.length, minutes, posts[0]?.date)}</p>
      {posts.length ? <PostList posts={posts} lang={lang} summary /> : <p className="lede">{t.empty}</p>}
    </section>
  );
}
