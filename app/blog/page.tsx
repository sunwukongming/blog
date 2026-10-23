import type { Metadata } from "next";
import PostList from "@/components/PostList";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = { title: "文章" };

export default async function BlogIndex() {
  const posts = await getAllPosts();
  return (
    <main data-world="ring" className="page">
      <div className="hero">
        <p className="eyebrow">{posts.length} 篇文章</p>
        <h1 className="display">每一篇都是一张卡片</h1>
        <p className="lede">左右移动鼠标旋转卡片环，点击卡片开始阅读。下面是完整列表。</p>
      </div>
      <div style={{ height: "52svh" }} />
      <section className="panel" data-ui aria-labelledby="all-posts" style={{ maxWidth: 760 }}>
        <h2 id="all-posts">全部文章</h2>
        <PostList posts={posts} summary />
      </section>
    </main>
  );
}
