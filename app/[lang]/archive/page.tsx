import type { Metadata } from "next";
import PostList from "@/components/PostList";
import { HTML_LANG } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { UI } from "@/lib/messages";
import { absUrl, pageMeta } from "@/lib/meta";
import { getAllPosts } from "@/lib/posts";
import { getSite } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const t = UI[lang].archive;
  return pageMeta({ lang, path: "/archive", title: t.title, description: t.description });
}

export default async function Archive() {
  const lang = await getLang();
  const t = UI[lang].archive;
  const posts = await getAllPosts(lang);
  const years = Map.groupBy(posts, (p) => p.date.slice(0, 4));
  // 默认展开最新文章所在的年份（不在预渲染时调用 new Date()）
  const current = posts[0]?.date.slice(0, 4) ?? [...years.keys()][0] ?? "2026";
  const yearCount = years.size;
  // 只暴露最近 50 条，避免巨大的 JSON-LD；numberOfItems 仍是全部篇数
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.listName(getSite(lang).name),
    description: t.description,
    numberOfItems: posts.length,
    inLanguage: HTML_LANG[lang],
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: posts.slice(0, 50).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absUrl(lang, `/blog/${p.slug}`),
      name: p.title,
    })),
  };
  return (
    <main data-world="drive" className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <div className="hero">
        <p className="eyebrow">Archive · {posts.length} entries</p>
        <h1 className="display">{t.heading}</h1>
        <p className="lede">{t.lede}</p>
      </div>
      <div className="side archive-years" style={{ display: "grid", gap: 12 }}>
        {[...years].map(([year, list]) => {
          const open = year === current || yearCount <= 1;
          return (
            <section key={year} className="panel archive-year" data-ui>
              <details open={open}>
                <summary id={`y${year}`} className="archive-year__summary">
                  <span className="archive-year__label">{year}</span>
                  <span className="archive-year__count">{t.count(list.length)}</span>
                </summary>
                <PostList posts={list} lang={lang} />
              </details>
            </section>
          );
        })}
      </div>
    </main>
  );
}
