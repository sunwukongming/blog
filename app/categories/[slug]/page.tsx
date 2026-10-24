import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PostList from "@/components/PostList";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { getAllPosts } from "@/lib/posts";
import { SITE, SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const category = getCategory((await params).slug);
  if (!category) return {};
  const title = category.name;
  const description = category.blurb;
  const url = SITE_URL ? `${SITE_URL}/categories/${category.slug}` : undefined;
  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      url,
      siteName: SITE.name,
      locale: "zh_CN",
      images: SITE_URL ? [{ url: `${SITE_URL}/icon.svg`, alt: title }] : undefined,
    },
    twitter: { card: "summary", title, description },
  };
}

export default function CategoryPage({ params }: PageProps<"/categories/[slug]">) {
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
  const category = getCategory((await params).slug);
  if (!category) notFound();
  const posts = (await getAllPosts()).filter((p) => p.category === category.slug);
  const minutes = posts.reduce((n, p) => n + p.readingMinutes, 0);
  const pageUrl = SITE_URL ? `${SITE_URL}/categories/${category.slug}` : `/categories/${category.slug}`;
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} · ${SITE.name}`,
    description: category.blurb,
    url: pageUrl,
    inLanguage: "zh-CN",
    numberOfItems: posts.length,
    isPartOf: SITE_URL ? { "@type": "WebSite", name: SITE.name, url: SITE_URL } : undefined,
    about: { "@type": "Thing", name: category.name },
    mainEntity: {
      "@type": "ItemList",
      name: `${category.name} 文章`,
      numberOfItems: posts.length,
      itemListElement: posts.map((post, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: SITE_URL ? `${SITE_URL}/blog/${post.slug}` : `/blog/${post.slug}`,
        name: post.title,
      })),
    },
  };

  return (
    <section className="panel side" data-ui style={{ display: "grid", gap: 12 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      <Link href="/categories" className="back">
        ← 回到星系
      </Link>
      <h1 className="display" style={{ fontSize: "clamp(32px, 5vw, 48px)" }}>
        <span className="dot" style={{ background: category.color, width: 14, height: 14 }} />
        {category.name}
      </h1>
      <p className="lede">{category.blurb}</p>
      <p className="cat-stats">
        {posts.length} 篇·约 {minutes} 分钟阅读
        {posts[0] ? `·最新 ${posts[0].date}` : ""}
      </p>
      {posts.length ? <PostList posts={posts} summary /> : <p className="lede">这颗星球上还没有文章。</p>}
    </section>
  );
}
