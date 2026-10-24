import type { Metadata } from "next";
import PostList from "@/components/PostList";
import { getAllPosts } from "@/lib/posts";

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
  return (
    <main data-world="drive" className="page">
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
