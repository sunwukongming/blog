import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// sitemap 字段同时挂 sitemap.xml 与 feed.xml，和站内 README / 列表页 RSS alternate 对齐
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
