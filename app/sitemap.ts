import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { GAMES, GAMES_UPDATED } from "@/lib/games";
import { getAllPosts } from "@/lib/posts";
import { SITE_URL } from "@/lib/site";

/** Post date is YYYY-MM-DD in Asia/Shanghai; expose a stable lastmod Instant. */
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
  }));
  const gamesIndex = {
    url: `${SITE_URL}/games`,
    lastModified: postDate(GAMES_UPDATED),
  };
  return [
    ...listPages,
    gamesIndex,
    ...posts.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: postDate(p.date) })),
    ...CATEGORIES.map((c) => ({ url: `${SITE_URL}/categories/${c.slug}`, ...(latest ? { lastModified: latest } : {}) })),
    ...GAMES.filter((g) => g.playable).map((g) => ({
      url: `${SITE_URL}/games/${g.slug}`,
      lastModified: postDate(GAMES_UPDATED),
    })),
  ];
}
