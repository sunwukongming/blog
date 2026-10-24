import { getCategory } from "@/lib/categories";
import { getAllPosts } from "@/lib/posts";
import { SITE, SITE_URL } from "@/lib/site";

const escape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

// GET 处理函数本身不能加 "use cache"，把生成 XML 的部分放进缓存函数（按 base 分别缓存）
async function buildFeed(base: string) {
  "use cache";
  const posts = await getAllPosts();
  const latest = posts[0]?.date;
  const lastBuild = latest
    ? new Date(`${latest}T00:00:00+08:00`).toUTCString()
    : new Date().toUTCString();
  const items = posts
    .map((p) => {
      const link = `${base}/blog/${p.slug}`;
      const summary = p.summary?.trim() || p.title;
      return `    <item>
      <title>${escape(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(`${p.date}T00:00:00+08:00`).toUTCString()}</pubDate>
      <author>gm@gm.lab (${escape(SITE.author)})</author>
      <category>${escape(getCategory(p.category)?.name ?? p.category)}</category>
      <description><![CDATA[${summary}]]></description>
      <enclosure url="${base}/icon.svg" length="0" type="image/svg+xml" />
      <media:content url="${base}/icon.svg" medium="image" type="image/svg+xml" />
      <!-- batch41: thumbnail 与 enclosure/media:content/channel.image 同源 -->
      <!-- batch46: media:* 仍指向 icon.svg；文章 OG 图未进 RSS 以免体积膨胀 -->
      <!-- batch48: 复核 media/enclosure 仍同源 icon；不把文章 OG 塞进 RSS -->
      <!-- batch52: 再核 media:content + media:thumbnail + enclosure 三同源 icon.svg -->
      <media:thumbnail url="${base}/icon.svg" />
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escape(SITE.name)}</title>
    <link>${base}</link>
    <description>${escape(SITE.description)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <managingEditor>${escape(SITE.author)} (GM Lab)</managingEditor>
    <webMaster>${escape(SITE.author)} (GM Lab)</webMaster>
    <generator>GM Lab</generator>
    <!-- batch44: generator / managingEditor / webMaster 与 SITE.author 对齐；勿改成框架默认名 -->
    <docs>https://www.rssboard.org/rss-specification</docs>
    <ttl>60</ttl>
    <copyright>© ${escape(SITE.author)} · ${escape(SITE.name)}</copyright>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />
    <atom:link href="${base}/" rel="alternate" type="text/html" />
    <image>
      <url>${base}/icon.svg</url>
      <title>${escape(SITE.name)}</title>
      <link>${base}</link>
    </image>
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
