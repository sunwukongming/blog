import type { Metadata } from "next";
import PostList from "@/components/PostList";
import { getAllPosts } from "@/lib/posts";
import { SITE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "归档",
  description: "GM Lab 文章归档：按年份折叠浏览 Go / 前端 / 云原生 / 可观测与随笔；当前年默认展开，可跳进卡片环续读。",
  openGraph: {
    title: "归档",
    description: "GM Lab 文章归档：按年份折叠浏览 Go / 前端 / 云原生 / 可观测与随笔；当前年默认展开，可跳进卡片环续读。",
    type: "website",
    siteName: SITE.name,
    locale: "zh_CN",
    url: SITE_URL ? `${SITE_URL}/archive` : undefined,
    images: SITE_URL ? [{ url: `${SITE_URL}/icon.svg`, alt: SITE.name }] : undefined,
  },
  alternates: SITE_URL ? { canonical: "/archive" } : undefined,
  twitter: {
    card: "summary",
    title: "归档",
    description: "GM Lab 文章归档：按年份折叠浏览 Go / 前端 / 云原生 / 可观测与随笔；当前年默认展开，可跳进卡片环续读。",
    images: SITE_URL ? [`${SITE_URL}/icon.svg`] : undefined,
  },
};

export default async function Archive() {
  const posts = await getAllPosts();
  const years = Map.groupBy(posts, (p) => p.date.slice(0, 4));
  const current = String(new Date().getFullYear());
  const yearCount = years.size;
  // batch44: ItemList 与 eyebrow 篇数对齐；只暴露最近 50 条避免巨大 JSON-LD
  // batch51: 再核 numberOfItems=posts.length + slice(0,50) + inLanguage；与 blog ItemList 同源 getAllPosts
  // batch56: 再核 ItemListOrderDescending + 仅暴露 50 条；numberOfItems 仍为全文总数
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${SITE.name} 文章归档`,
    description: `按年份归档的 GM Lab 笔记（Go / 前端 / 云原生 / 可观测）；${yearCount} 个年份`,
    numberOfItems: posts.length,
    inLanguage: "zh-CN",
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: posts.slice(0, 50).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: SITE_URL ? `${SITE_URL}/blog/${p.slug}` : `/blog/${p.slug}`,
      name: p.title,
    })),
  };
  return (
    <main data-world="drive" className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <div className="hero">
        <p className="eyebrow">Archive · {posts.length} entries</p>
        <h1 className="display">一路开过来的</h1>
        <p className="lede">按年份折叠；当前年默认展开。</p>
      </div>
      <div className="side archive-years" style={{ display: "grid", gap: 12 }}>
        {[...years].map(([year, list]) => {
          const open = year === current || yearCount <= 1;
          return (
            <section key={year} className="panel archive-year" data-ui>
              <details open={open}>
                <summary id={`y${year}`} className="archive-year__summary">
                  <span className="archive-year__label">{year}</span>
                  <span className="archive-year__count">{list.length} 篇</span>
                </summary>
                <PostList posts={list} />
              </details>
            </section>
          );
        })}
      </div>
    </main>
  );
}
