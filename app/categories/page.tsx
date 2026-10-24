import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { getAllPosts } from "@/lib/posts";
import { SITE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "分类",
  description: "按前端、后端、云与可观测、工具与随笔浏览 GM Lab 文章；每颗行星是一个分类，点进 CollectionPage 续读。",
  openGraph: {
    title: "分类",
    description: "按前端、后端、云与可观测、工具与随笔浏览 GM Lab 文章；每颗行星是一个分类，点进 CollectionPage 续读。",
    type: "website",
    siteName: SITE.name,
    locale: "zh_CN",
    url: SITE_URL ? `${SITE_URL}/categories` : undefined,
    images: SITE_URL ? [{ url: `${SITE_URL}/icon.svg`, alt: SITE.name }] : undefined,
  },
  alternates: SITE_URL ? { canonical: "/categories" } : undefined,
  twitter: {
    card: "summary",
    title: "分类",
    description: "按前端、后端、云与可观测、工具与随笔浏览 GM Lab 文章；每颗行星是一个分类，点进 CollectionPage 续读。",
    images: SITE_URL ? [`${SITE_URL}/icon.svg`] : undefined,
  },
};

export default async function Categories() {
  const posts = await getAllPosts();
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${SITE.name} 分类`,
    description: "按前端、后端、云与可观测、工具与随笔浏览",
    numberOfItems: CATEGORIES.length,
    itemListElement: CATEGORIES.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: SITE_URL ? `${SITE_URL}/categories/${c.slug}` : `/categories/${c.slug}`,
      name: c.name,
      description: c.blurb,
    })),
  };
  return (
    <main data-world="orbit" className="page page--split">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <div className="hero">
        <p className="eyebrow">
          {CATEGORIES.length} 个分类 · {posts.length} 篇文章
        </p>
        <h1 className="display">欢迎来到我的星系</h1>
        <p className="lede">每颗行星是一个分类，绕着它转的卫星是文章。点击行星飞过去看看。</p>
      </div>
      <nav className="chips categories-blurb" data-ui aria-label="分类列表">
        {CATEGORIES.map((c) => {
          const n = posts.filter((p) => p.category === c.slug).length;
          return (
            <Link key={c.slug} href={`/categories/${c.slug}`} title={c.blurb}>
              <span className="dot" style={{ background: c.color }} />
              {c.name}
              <small>{n}</small>
              <span className="categories-blurb__text">{c.blurb}</span>
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
