import { getCategory } from "@/lib/categories";
import { getAllPosts } from "@/lib/posts";
import { SITE, SITE_URL } from "@/lib/site";

const escape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

// GET 处理函数本身不能加 "use cache"，把生成 XML 的部分放进缓存函数，构建时就能预渲染
async function buildFeed() {
  "use cache";
  const base = SITE_URL ?? "http://localhost:3000";
  const posts = await getAllPosts();
  const items = posts
    .map((p) => {
      const link = `${base}/blog/${p.slug}`;
      return `    <item>
      <title>${escape(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(`${p.date}T00:00:00+08:00`).toUTCString()}</pubDate>
      <category>${escape(getCategory(p.category)?.name ?? p.category)}</category>
      <description>${escape(p.summary)}</description>
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(SITE.name)}</title>
    <link>${base}</link>
    <description>${escape(SITE.description)}</description>
    <language>zh-CN</language>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

export async function GET() {
  return new Response(await buildFeed(), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
