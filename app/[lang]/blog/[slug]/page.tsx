import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CodeCopy, CopyLink, ReadingDots, ReadingProgress, ShareX, Toc } from "@/components/ArticleTools";
import MdxContent from "@/components/MdxContent";
import { getCategory } from "@/lib/categories";
import { HTML_LANG, localePath, type Locale } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { UI } from "@/lib/messages";
import { absUrl, pageMeta } from "@/lib/meta";
import { getAllPosts, getPost, getRelatedPosts } from "@/lib/posts";
import { getSite, SITE_URL } from "@/lib/site";
import { extractHeadings } from "@/lib/toc";

export async function generateStaticParams({ params }: { params: { lang: string } }) {
  const posts = await getAllPosts(params.lang as Locale);
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/blog/[slug]">): Promise<Metadata> {
  const lang = await getLang();
  const { slug } = await params;
  const post = await getPost(slug, lang);
  if (!post) return {};
  const author = getSite(lang).author;
  return {
    ...pageMeta({
      lang,
      path: `/blog/${slug}`,
      title: post.title,
      description: post.summary,
      type: "article",
      langs: post.langs,
      // 没有译文时内容就是中文原文，canonical 指向中文版
      canonicalLang: post.contentLang,
      defaultImage: false,
      article: { publishedTime: post.date, authors: [author] },
    }),
    authors: [{ name: author }],
  };
}

// App Shell（所在世界）与 URL 无关，读取 params 的正文放进 Suspense
export default function PostPage({ params }: PageProps<"/[lang]/blog/[slug]">) {
  return (
    <main data-world="field" className="page" style={{ alignItems: "center" }}>
      <Suspense fallback={null}>
        <PostBody params={params} />
      </Suspense>
    </main>
  );
}

async function PostBody({ params }: { params: Promise<{ slug: string }> }) {
  const lang = await getLang();
  const t = UI[lang].post;
  const site = getSite(lang);
  const { slug } = await params;
  const [post, all] = await Promise.all([getPost(slug, lang), getAllPosts(lang)]);
  if (!post) notFound();

  const related = await getRelatedPosts(slug, post.category, lang, 3);
  const category = getCategory(post.category, lang);
  const i = all.findIndex((p) => p.slug === slug);
  const newer = all[i - 1];
  const older = all[i + 1];
  const headings = extractHeadings(post.body);
  const pageUrl = SITE_URL ? absUrl(lang, `/blog/${slug}`) : undefined;
  // 内容语言和页面语言不同（没有译文、显示中文原文）时，给正文标上原文的 lang
  const contentLang = post.contentLang === lang ? undefined : HTML_LANG[post.contentLang];
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: HTML_LANG[post.contentLang],
    author: { "@type": "Person", name: site.author },
    publisher: { "@type": "Organization", name: site.name, url: SITE_URL ?? undefined },
    mainEntityOfPage: pageUrl ? { "@type": "WebPage", "@id": pageUrl } : undefined,
    isPartOf: SITE_URL ? { "@type": "WebSite", name: site.name, url: absUrl(lang, "/") } : undefined,
    articleSection: category?.name ?? post.category,
    timeRequired: `PT${post.readingMinutes}M`,
    url: pageUrl,
  };
  const relatedLd =
    related.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: t.relatedName(post.title),
          description: t.relatedDescription,
          numberOfItems: related.length,
          itemListOrder: "https://schema.org/ItemListOrderAscending",
          itemListElement: related.map((r, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            url: absUrl(lang, `/blog/${r.slug}`),
            name: r.title,
          })),
        }
      : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      {relatedLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(relatedLd) }} />
      )}
      <ReadingProgress />
      <header className="article-head" style={{ width: "100%" }}>
        <div className="article-meta">
          {category && <Link href={localePath(lang, `/categories/${category.slug}`)}>{category.name}</Link>}
          <time dateTime={post.date}>{post.date}</time>
          <span>{t.minutes(post.readingMinutes)}</span>
          <CopyLink />
          <ShareX title={post.title} />
        </div>
        <h1 className="display" lang={contentLang}>
          {post.title}
        </h1>
        {post.summary && (
          <p className="lede" lang={contentLang}>
            {post.summary}
          </p>
        )}
        {contentLang && <p className="untranslated-note">{t.untranslated}</p>}
      </header>
      {headings.length >= 2 && <Toc headings={headings} />}
      <article className="panel article prose" data-ui lang={contentLang}>
        <MdxContent source={post.body} lang={lang} />
      </article>
      <CodeCopy />
      {related.length > 0 && (
        <section className="panel related-posts" data-ui aria-labelledby="related-heading">
          <div className="related-posts__head">
            <h2 id="related-heading">{t.related}</h2>
            <ReadingDots />
          </div>
          <ul className="related-posts__list">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={localePath(lang, `/blog/${r.slug}`)}>
                  <span
                    className="related-posts__title"
                    lang={r.contentLang === lang ? undefined : HTML_LANG[r.contentLang]}
                  >
                    {r.title}
                  </span>
                  <span className="related-posts__meta">
                    {getCategory(r.category, lang)?.name ?? r.category}
                    {" · "}
                    {t.minutes(r.readingMinutes)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <nav className="post-nav" aria-label={t.pager}>
        {older ? (
          <Link href={localePath(lang, `/blog/${older.slug}`)} className="panel">
            <small>{t.older}</small>
            {older.title}
          </Link>
        ) : (
          <span />
        )}
        {newer && (
          <Link href={localePath(lang, `/blog/${newer.slug}`)} className="panel">
            <small>{t.newer}</small>
            {newer.title}
          </Link>
        )}
      </nav>
    </>
  );
}
