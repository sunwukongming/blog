import type { Metadata } from "next";
import PostFilter from "@/components/PostFilter";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "文章",
  description: "GM Lab 文章列表：Go、云原生、可观测与前端笔记；支持搜索与按分类筛选，每篇对应卡片环上的一张卡。",
  openGraph: {
    title: "文章",
    description: "GM Lab 文章列表：Go、云原生、可观测与前端笔记；支持搜索与按分类筛选，每篇对应卡片环上的一张卡。",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "文章",
    description: "GM Lab 文章列表：Go、云原生、可观测与前端笔记；支持搜索与按分类筛选，每篇对应卡片环上的一张卡。",
  },
};

export default async function BlogIndex() {
  const posts = await getAllPosts();
  return (
    <main data-world="ring" className="page">
      <div className="hero">
        <p className="eyebrow">{posts.length} 篇文章</p>
        <h1 className="display">每一篇都是一张卡片</h1>
        <p className="lede">
          <span className="when-mouse">左右移动鼠标旋转卡片环，点击卡片开始阅读。</span>
          <span className="when-touch">卡片环会自己慢慢转，点一下卡片开始阅读。</span>
          下面可搜索或按分类筛选。
        </p>
      </div>
      <div style={{ height: "52svh" }} />
      <section className="panel" data-ui aria-labelledby="all-posts" style={{ maxWidth: 760 }}>
        <h2 id="all-posts">全部文章</h2>
        <PostFilter posts={posts} />
      </section>
    </main>
  );
}
