import type { Metadata } from "next";
import Link from "next/link";
import { getCategories } from "@/lib/categories";
import { HTML_LANG, localePath } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { UI } from "@/lib/messages";
import { absUrl, pageMeta } from "@/lib/meta";
import { getAllPosts } from "@/lib/posts";
import { getSite } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const t = UI[lang].categories;
  return pageMeta({ lang, path: "/categories", title: t.title, description: t.description });
}

export default async function Categories() {
  const lang = await getLang();
  const t = UI[lang].categories;
  const categories = getCategories(lang);
  const posts = await getAllPosts(lang);
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.listName(getSite(lang).name),
    description: t.description,
    inLanguage: HTML_LANG[lang],
    numberOfItems: categories.length,
    itemListElement: categories.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absUrl(lang, `/categories/${c.slug}`),
      name: c.name,
      description: c.blurb,
    })),
  };
  return (
    <main data-world="orbit" className="page page--split">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <div className="hero">
        <p className="eyebrow">{t.count(categories.length, posts.length)}</p>
        <h1 className="display">{t.heading}</h1>
        <p className="lede">{t.lede}</p>
      </div>
      <nav className="chips categories-blurb" data-ui aria-label={t.list}>
        {categories.map((c) => {
          const n = posts.filter((p) => p.category === c.slug).length;
          return (
            <Link key={c.slug} href={localePath(lang, `/categories/${c.slug}`)} title={c.blurb}>
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
