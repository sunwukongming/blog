import type { MetadataRoute } from "next";
import { CATEGORY_SLUGS } from "@/lib/categories";
import { GAMES_UPDATED, PLAYABLE_SLUGS } from "@/lib/games";
import { HTML_LANG, LOCALES, localePath, type Locale } from "@/lib/i18n";
import { getAllPosts } from "@/lib/posts";
import { SITE_URL } from "@/lib/site";

/** Post date is YYYY-MM-DD in Asia/Shanghai; expose a stable lastmod Instant. */
const postDate = (d: string) => new Date(`${d}T12:00:00+08:00`);

type Entry = MetadataRoute.Sitemap[number];

/**
 * 每个页面的每种语言各一条，并用 alternates.languages 互相标注（hreflang）。
 * 没有译文的文章只收录中文版：英文 / 日文页面显示的是同样的中文原文，canonical 也指向中文版
 */
function entries(path: string, langs: readonly Locale[], rest: Omit<Entry, "url" | "alternates">): Entry[] {
  const languages = Object.fromEntries(langs.map((l) => [HTML_LANG[l], SITE_URL + localePath(l, path)]));
  return langs.map((l) => ({ url: SITE_URL + localePath(l, path), alternates: { languages }, ...rest }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!SITE_URL) return [];
  const posts = await getAllPosts("zh");
  const latest = posts.reduce<Date | null>((acc, p) => {
    const d = postDate(p.date);
    return !acc || d > acc ? d : acc;
  }, null);
  const latestMod = latest ? { lastModified: latest } : {};
  return [
    ...["/", "/blog", "/categories", "/archive"].flatMap((path) =>
      entries(path, LOCALES, {
        ...latestMod,
        changeFrequency: path === "/" || path === "/blog" ? "daily" : "weekly",
        priority: path === "/" ? 1 : path === "/blog" ? 0.9 : 0.7,
      }),
    ),
    ...entries("/games", LOCALES, { lastModified: postDate(GAMES_UPDATED) }),
    ...posts.flatMap((p) =>
      entries(`/blog/${p.slug}`, p.langs, {
        lastModified: postDate(p.date),
        changeFrequency: "monthly",
        priority: 0.8,
      }),
    ),
    ...CATEGORY_SLUGS.flatMap((slug) =>
      entries(`/categories/${slug}`, LOCALES, { ...latestMod, changeFrequency: "weekly", priority: 0.65 }),
    ),
    ...PLAYABLE_SLUGS.flatMap((slug) => entries(`/games/${slug}`, LOCALES, { lastModified: postDate(GAMES_UPDATED) })),
  ];
}
