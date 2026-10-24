import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CodeCopy, CopyLink, ReadingDots, ReadingProgress, ShareX, Toc } from "@/components/ArticleTools";
import MdxContent from "@/components/MdxContent";
import { getCategory } from "@/lib/categories";
import { getAllPosts, getPost, getRelatedPosts } from "@/lib/posts";
import { SITE, SITE_URL } from "@/lib/site";
import { extractHeadings } from "@/lib/toc";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary,
    authors: [{ name: SITE.author }],
    openGraph: { type: "article", title: post.title, description: post.summary, publishedTime: post.date },
    alternates: SITE_URL ? { canonical: `/blog/${slug}` } : undefined,
  };
}

// App Shell（所在世界）与 URL 无关，读取 params 的正文放进 Suspense
export default function PostPage({ params }: PageProps<"/blog/[slug]">) {
  return (
    <main data-world="field" className="page" style={{ alignItems: "center" }}>
      <Suspense fallback={null}>
        <PostBody params={params} />
      </Suspense>
    </main>
  );
}

async function PostBody({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, all] = await Promise.all([getPost(slug), getAllPosts()]);
  if (!post) notFound();

  const related = await getRelatedPosts(slug, post.category, 3);
  const category = getCategory(post.category);
  const i = all.findIndex((p) => p.slug === slug);
  const newer = all[i - 1];
  const older = all[i + 1];
  const headings = extractHeadings(post.body);

  return (
    <>
      <ReadingProgress />
      <header className="article-head" style={{ width: "100%" }}>
        <div className="article-meta">
          {category && <Link href={`/categories/${category.slug}`}>{category.name}</Link>}
          <time dateTime={post.date}>{post.date}</time>
          <span>约 {post.readingMinutes} 分钟</span>
          <CopyLink />
          <ShareX title={post.title} />
        </div>
        <h1 className="display">{post.title}</h1>
        {post.summary && <p className="lede">{post.summary}</p>}
      </header>
      {headings.length >= 2 && <Toc headings={headings} />}
      <article className="panel article prose" data-ui>
        <MdxContent source={post.body} />
      </article>
      <CodeCopy />
      {related.length > 0 && (
        <section className="panel related-posts" data-ui aria-labelledby="related-heading">
          <div className="related-posts__head">
            <h2 id="related-heading">相关推荐</h2>
            <ReadingDots />
          </div>
          <ul className="related-posts__list">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/blog/${r.slug}`}>
                  <span className="related-posts__title">{r.title}</span>
                  <span className="related-posts__meta">
                    {getCategory(r.category)?.name ?? r.category}
                    {" · "}
                    约 {r.readingMinutes} 分钟
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <nav className="post-nav" aria-label="上一篇和下一篇">
        {older ? (
          <Link href={`/blog/${older.slug}`} className="panel">
            <small>上一篇</small>
            {older.title}
          </Link>
        ) : (
          <span />
        )}
        {newer && (
          <Link href={`/blog/${newer.slug}`} className="panel">
            <small>下一篇</small>
            {newer.title}
          </Link>
        )}
      </nav>
    </>
  );
}
