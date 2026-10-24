import type { Metadata } from "next";
import PostFilter from "@/components/PostFilter";
import { getAllPosts } from "@/lib/posts";
import { SITE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "文章",
  description: "GM Lab 文章列表：Go / 云原生 / OpenTelemetry / 前端与数据层笔记；支持搜索与分类筛选，卡片环一页一景。",
  openGraph: {
    title: "文章",
    description: "GM Lab 文章列表：Go / 云原生 / OpenTelemetry / 前端与数据层笔记；支持搜索与分类筛选，卡片环一页一景。",
    type: "website",
    siteName: SITE.name,
    locale: "zh_CN",
    url: SITE_URL ? `${SITE_URL}/blog` : undefined,
    images: SITE_URL ? [{ url: `${SITE_URL}/icon.svg`, alt: SITE.name }] : undefined,
  },
  alternates: SITE_URL ? { canonical: "/blog" } : undefined,
  twitter: {
    card: "summary",
    title: "文章",
    description: "GM Lab 文章列表：Go / 云原生 / OpenTelemetry / 前端与数据层笔记；支持搜索与分类筛选，卡片环一页一景。",
    // 与 openGraph.images 对齐，避免列表页被抓成无图卡片
    images: SITE_URL ? [`${SITE_URL}/icon.svg`] : undefined,
  },
};

export default async function BlogIndex() {
  const posts = await getAllPosts();
  // batch46: ItemList 复核 numberOfItems + 前 50 条 ListItem；与 feed 条目同源 getAllPosts
  // batch50: 再核 ItemListOrderDescending + slice(0,50)；OG/Twitter images 仍同源 icon.svg
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    name: `${SITE.name} 文章`,
    description: "GM Lab 文章列表：Go / 云原生 / 可观测 / 前端笔记",
    numberOfItems: posts.length,
    itemListElement: posts.slice(0, 50).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: SITE_URL ? `${SITE_URL}/blog/${p.slug}` : `/blog/${p.slug}`,
      name: p.title,
    })),
  };
  return (
    <main data-world="ring" className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
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
