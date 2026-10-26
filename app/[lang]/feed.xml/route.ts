import { notFound } from "next/navigation";
import { getCategory } from "@/lib/categories";
import { hasLocale, HTML_LANG, LOCALES, localePath, type Locale } from "@/lib/i18n";
import { getAllPosts } from "@/lib/posts";
import { getSite, SITE_URL } from "@/lib/site";

const escape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

// GET 处理函数本身不能加 "use cache"，把生成 XML 的部分放进缓存函数（按 base 和语言分别缓存）。
// 每种语言一份 RSS；没有译文的文章用中文原文
async function buildFeed(base: string, lang: Locale) {
  "use cache";
  const SITE = getSite(lang);
  const home = base + localePath(lang, "/");
  const posts = await getAllPosts(lang);
  const latest = posts[0]?.date;
  const lastBuild = latest ? new Date(`${latest}T00:00:00+08:00`).toUTCString() : new Date().toUTCString();
  const items = posts
    .map((p) => {
      const link = base + localePath(lang, `/blog/${p.slug}`);
      const summary = p.summary?.trim() || p.title;
      return `    <item>
      <title>${escape(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(`${p.date}T00:00:00+08:00`).toUTCString()}</pubDate>
      <author>gm@gm.lab (${escape(SITE.author)})</author>
      <category>${escape(getCategory(p.category, lang)?.name ?? p.category)}</category>
      <description><![CDATA[${summary}]]></description>
      <enclosure url="${base}/icon.svg" length="0" type="image/svg+xml" />
      <media:content url="${base}/icon.svg" medium="image" type="image/svg+xml" />
      <media:thumbnail url="${base}/icon.svg" />
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escape(SITE.name)}</title>
    <link>${home}</link>
    <description>${escape(SITE.description)}</description>
    <language>${HTML_LANG[lang]}</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <managingEditor>${escape(SITE.author)} (GM Lab)</managingEditor>
    <webMaster>${escape(SITE.author)} (GM Lab)</webMaster>
    <generator>GM Lab</generator>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <ttl>60</ttl>
    <copyright>© ${escape(SITE.author)} · ${escape(SITE.name)}</copyright>
    <atom:link href="${base}${localePath(lang, "/feed.xml")}" rel="self" type="application/rss+xml" />
    <atom:link href="${home}" rel="alternate" type="text/html" />
    <image>
      <url>${base}/icon.svg</url>
      <title>${escape(SITE.name)}</title>
      <link>${home}</link>
    </image>
${items}
  </channel>
</rss>
`;
}

// 配置了站点地址时整份预渲染；没配置时用请求本身的域名，避免链接指向 localhost
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function GET(request: Request, { params }: RouteContext<"/[lang]/feed.xml">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const base = SITE_URL ?? new URL(request.url).origin;
  return new Response(await buildFeed(base, lang), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
