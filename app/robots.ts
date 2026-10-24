import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// sitemap 字段同时挂 sitemap.xml 与 feed.xml，和站内 README / 列表页 RSS alternate 对齐
// 单文 Article + related ItemList 见 app/blog/[slug]/page.tsx，与 sitemap 博文 priority 0.8 对齐
// 归档页 Twitter images 与游戏列表/单游戏 OG 对齐（batch38）；feed 含 media:thumbnail（batch37）
// batch42: 游戏列表 Twitter images 与 OG 对齐；sitemap 仍用 GAMES_UPDATED 作 /games lastmod
// batch45: 复核 host + sitemap/feed 双挂；与首页 WebSite JSON-LD（sameAs/hasPart/SearchAction）对齐
// batch48: 再核 host + sitemap.xml/feed.xml 双挂；与 GAMES_UPDATED/sitemap 游戏 lastmod 注释对齐
// batch53: 再核 host 解析自 SITE_URL；sitemap 仍双挂 xml+feed，与博客列表 ItemList 同源
// batch57: 再核 allow=/ 与 host/sitemap 双挂；与 blog ItemList 注释对齐
// batch60: 再核 host + sitemap.xml/feed.xml 双挂；与 games ItemList 再核对齐
// batch62: 再核 allow=/ 与 host + sitemap/feed 双挂；与 games ItemList 再核对齐
// batch64: 再核 host + sitemap.xml/feed.xml 双挂；与 games ItemList 再核对齐
export default function robots(): MetadataRoute.Robots {
  let host: string | undefined;
  try {
    host = SITE_URL ? new URL(SITE_URL).host : undefined;
  } catch {
    host = undefined;
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: SITE_URL
      ? [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/feed.xml`]
      : undefined,
    host,
  };
}
