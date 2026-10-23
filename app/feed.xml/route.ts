import { getCategory } from "@/lib/categories";
import { getAllPosts } from "@/lib/posts";
import { SITE, SITE_URL } from "@/lib/site";

const escape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

// GET 处理函数本身不能加 "use cache"，把生成 XML 的部分放进缓存函数（按 base 分别缓存）
async function buildFeed(base: string) {
  "use cache";
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

// 配置了站点地址时整份预渲染；没配置时用请求本身的域名，避免链接指向 localhost
export async function GET(request: Request) {
  const base = SITE_URL ?? new URL(request.url).origin;
  return new Response(await buildFeed(base), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
