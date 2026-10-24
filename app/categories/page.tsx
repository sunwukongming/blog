import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "分类",
  description: "按前端、后端、云与可观测、工具与随笔浏览 GM Lab 文章；每颗行星是一个分类。",
  openGraph: {
    title: "分类",
    description: "按前端、后端、云与可观测、工具与随笔浏览 GM Lab 文章；每颗行星是一个分类。",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "分类",
    description: "按前端、后端、云与可观测、工具与随笔浏览 GM Lab 文章；每颗行星是一个分类。",
  },
};

export default async function Categories() {
  const posts = await getAllPosts();
  return (
    <main data-world="orbit" className="page page--split">
      <div className="hero">
        <p className="eyebrow">
          {CATEGORIES.length} 个分类 · {posts.length} 篇文章
        </p>
        <h1 className="display">欢迎来到我的星系</h1>
        <p className="lede">每颗行星是一个分类，绕着它转的卫星是文章。点击行星飞过去看看。</p>
      </div>
      <nav className="chips categories-blurb" data-ui aria-label="分类列表">
        {CATEGORIES.map((c) => {
          const n = posts.filter((p) => p.category === c.slug).length;
          return (
            <Link key={c.slug} href={`/categories/${c.slug}`} title={c.blurb}>
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
