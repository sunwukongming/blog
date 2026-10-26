import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

// sitemap 字段同时挂 sitemap.xml 与 feed.xml，和站内 README / 列表页 RSS alternate 对齐
// 单文 Article + related ItemList 见 app/blog/[slug]/page.tsx，与 sitemap 博文 priority 0.8 对齐
// 归档页 Twitter images 与游戏列表/单游戏 OG 对齐（batch38）；feed 含 media:thumbnail（batch37）
export default function robots(): MetadataRoute.Robots {
  let host: string | undefined;
  try {
    host = SITE_URL ? new URL(SITE_URL).host : undefined;
  } catch {
    host = undefined;
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: SITE_URL ? [`${SITE_URL}/sitemap.xml`, ...LOCALES.map((l) => `${SITE_URL}/${l}/feed.xml`)] : undefined,
    host,
  };
}
