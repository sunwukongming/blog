import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PostList from "@/components/PostList";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { getAllPosts } from "@/lib/posts";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const category = getCategory((await params).slug);
  return category ? { title: category.name, description: category.blurb } : {};
}

export default function CategoryPage({ params }: PageProps<"/categories/[slug]">) {
  return (
    <main data-world="orbit" className="page">
      {/* 窄屏时聚焦的行星画在这块空白里 */}
      <div className="orbit-stage" aria-hidden="true" />
      <Suspense fallback={null}>
        <CategoryPanel params={params} />
      </Suspense>
    </main>
  );
}

async function CategoryPanel({ params }: { params: Promise<{ slug: string }> }) {
  const category = getCategory((await params).slug);
  if (!category) notFound();
  const posts = (await getAllPosts()).filter((p) => p.category === category.slug);

  return (
    <section className="panel side" data-ui style={{ display: "grid", gap: 12 }}>
      <Link href="/categories" className="back">
        ← 回到星系
      </Link>
      <h1 className="display" style={{ fontSize: "clamp(32px, 5vw, 48px)" }}>
        <span className="dot" style={{ background: category.color, width: 14, height: 14 }} />
        {category.name}
      </h1>
      <p className="lede">{category.blurb}</p>
      {posts.length ? <PostList posts={posts} summary /> : <p className="lede">这颗星球上还没有文章。</p>}
    </section>
  );
}
