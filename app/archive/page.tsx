import type { Metadata } from "next";
import PostList from "@/components/PostList";
import { getAllPosts } from "@/lib/posts";
import { SITE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "归档",
  description: "GM Lab 文章归档：按年份折叠浏览后端、前端、云原生与随笔笔记，当前年默认展开。",
  openGraph: {
    title: "归档",
    description: "GM Lab 文章归档：按年份折叠浏览后端、前端、云原生与随笔笔记，当前年默认展开。",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "归档",
    description: "GM Lab 文章归档：按年份折叠浏览后端、前端、云原生与随笔笔记，当前年默认展开。",
  },
};

export default async function Archive() {
  const posts = await getAllPosts();
  const years = Map.groupBy(posts, (p) => p.date.slice(0, 4));
  const current = String(new Date().getFullYear());
  const yearCount = years.size;
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${SITE.name} 文章归档`,
    description: "按年份归档的 GM Lab 笔记",
    numberOfItems: posts.length,
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
