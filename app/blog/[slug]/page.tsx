import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import MdxContent from "@/components/MdxContent";
import { getCategory } from "@/lib/categories";
import { getAllPosts, getPost } from "@/lib/posts";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = await getPost((await params).slug);
  return post ? { title: post.title, description: post.summary } : {};
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

  const category = getCategory(post.category);
  const i = all.findIndex((p) => p.slug === slug);
  const newer = all[i - 1];
  const older = all[i + 1];

  return (
    <>
      <header className="article-head" style={{ width: "100%" }}>
        <div className="article-meta">
          {category && <Link href={`/categories/${category.slug}`}>{category.name}</Link>}
          <time dateTime={post.date}>{post.date}</time>
          <span>约 {post.readingMinutes} 分钟</span>
        </div>
        <h1 className="display">{post.title}</h1>
        {post.summary && <p className="lede">{post.summary}</p>}
      </header>
      <article className="panel article prose" data-ui>
        <MdxContent source={post.body} />
      </article>
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
