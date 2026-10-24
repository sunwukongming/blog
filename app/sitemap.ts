import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { GAMES, GAMES_UPDATED } from "@/lib/games";
import { getAllPosts } from "@/lib/posts";
import { SITE_URL } from "@/lib/site";

/** Post date is YYYY-MM-DD in Asia/Shanghai; expose a stable lastmod Instant. */
/** Playable /games/* lastmod uses GAMES_UPDATED（lib/games.ts enrich calendar day, batch39 复核；batch42 与游戏列表 Twitter 对齐时再核；batch45 与 robots 双挂注释对齐；batch48 再核；batch58 与 categories ItemList inLanguage 对齐时再核）. */
/** batch61: 再核 /games lastmod=GAMES_UPDATED；与 categories ItemList inLanguage 再核对齐. */
const postDate = (d: string) => new Date(`${d}T12:00:00+08:00`);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!SITE_URL) return [];
  const posts = await getAllPosts();
  const latest = posts.reduce<Date | null>((acc, p) => {
    const d = postDate(p.date);
    return !acc || d > acc ? d : acc;
  }, null);
  const listPages = ["/", "/blog", "/categories", "/archive", "/feed.xml"].map((path) => ({
    url: SITE_URL + path,
    ...(latest ? { lastModified: latest } : {}),
    changeFrequency: path === "/" || path === "/blog" ? ("daily" as const) : ("weekly" as const),
    priority: path === "/" ? 1 : path === "/blog" ? 0.9 : 0.7,
  }));
  const gamesIndex = {
    url: `${SITE_URL}/games`,
    lastModified: postDate(GAMES_UPDATED),
  };
  return [
    ...listPages,
    gamesIndex,
    ...posts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: postDate(p.date),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...CATEGORIES.map((c) => ({
      url: `${SITE_URL}/categories/${c.slug}`,
      ...(latest ? { lastModified: latest } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.65,
    })),
    ...GAMES.filter((g) => g.playable).map((g) => ({
      url: `${SITE_URL}/games/${g.slug}`,
      lastModified: postDate(GAMES_UPDATED),
    })),
  ];
}
