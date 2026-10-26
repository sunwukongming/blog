import type { Metadata } from "next";
import PostFilter from "@/components/PostFilter";
import { HTML_LANG } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { UI } from "@/lib/messages";
import { absUrl, pageMeta } from "@/lib/meta";
import { getAllPosts } from "@/lib/posts";
import { getSite } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const t = UI[lang].blog;
  return pageMeta({ lang, path: "/blog", title: t.title, description: t.description });
}

export default async function BlogIndex() {
  const lang = await getLang();
  const t = UI[lang].blog;
  const posts = await getAllPosts(lang);
  // 只暴露最近 50 条，避免巨大的 JSON-LD；numberOfItems 仍是全部篇数
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    name: t.listName(getSite(lang).name),
    description: t.description,
    numberOfItems: posts.length,
    inLanguage: HTML_LANG[lang],
    itemListElement: posts.slice(0, 50).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absUrl(lang, `/blog/${p.slug}`),
      name: p.title,
    })),
  };
  return (
    <main data-world="ring" className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <div className="hero">
        <p className="eyebrow">{t.count(posts.length)}</p>
        <h1 className="display">{t.heading}</h1>
        <p className="lede">
          <span className="when-mouse">{t.mouse}</span>
          <span className="when-touch">{t.touch}</span> {t.filterHint}
        </p>
      </div>
      <div style={{ height: "52svh" }} />
      <section className="panel" data-ui aria-labelledby="all-posts" style={{ maxWidth: 760 }}>
        <h2 id="all-posts">{t.all}</h2>
        <PostFilter posts={posts} />
      </section>
    </main>
  );
}
