import type { Metadata } from "next";
import { HTML_LANG, LOCALES, localePath, OG_LOCALE, type Locale } from "./i18n";
import { getSite, SITE_URL } from "./site";

type PageMetaInput = {
  lang: Locale;
  /** 不带语言前缀的站内路径，例如 "/blog" */
  path: string;
  /** 不传时用站名（首页） */
  title?: string;
  description: string;
  type?: "website" | "article";
  /** 有哪些语言版本，生成 hreflang；默认三种都有 */
  langs?: readonly Locale[];
  /** canonical 指向哪个语言版本；没有译文的文章指向中文原文，避免被当成重复内容 */
  canonicalLang?: Locale;
  /** 页面自带 opengraph-image 时传 false，别用默认的站点图标覆盖它 */
  defaultImage?: boolean;
  article?: { publishedTime: string; authors: string[] };
};

/** 每个页面共用的 metadata：canonical、hreflang、Open Graph、Twitter 卡片 */
export function pageMeta({
  lang,
  path,
  title,
  description,
  type = "website",
  langs = LOCALES,
  canonicalLang = lang,
  defaultImage = true,
  article,
}: PageMetaInput): Metadata {
  const site = getSite(lang);
  const url = SITE_URL ? SITE_URL + localePath(lang, path) : undefined;
  const ogTitle = title ?? site.name;
  const image = defaultImage && SITE_URL ? `${SITE_URL}/icon.svg` : undefined;
  return {
    title,
    description,
    alternates: SITE_URL
      ? {
          canonical: localePath(canonicalLang, path),
          languages: {
            ...Object.fromEntries(langs.map((l) => [HTML_LANG[l], localePath(l, path)])),
            "x-default": localePath("zh", path),
          },
          types: { "application/rss+xml": `${SITE_URL}${localePath(lang, "/feed.xml")}` },
        }
      : undefined,
    openGraph: {
      title: ogTitle,
      description,
      type,
      siteName: site.name,
      locale: OG_LOCALE[lang],
      url,
      ...(image ? { images: [{ url: image, alt: ogTitle }] } : {}),
      ...(article ?? {}),
    },
    twitter: {
      card: "summary",
      title: ogTitle,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/** JSON-LD 里用的绝对地址；没配置站点地址时退回站内路径 */
export const absUrl = (lang: Locale, path: string) => (SITE_URL ?? "") + localePath(lang, path);
