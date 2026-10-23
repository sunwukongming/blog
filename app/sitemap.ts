import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { GAMES } from "@/lib/games";
import { getAllPosts } from "@/lib/posts";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!SITE_URL) return [];
  const posts = await getAllPosts();
  const pages = ["/", "/blog", "/categories", "/archive", "/games"].map((path) => ({ url: SITE_URL + path }));
  return [
    ...pages,
    ...posts.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.date })),
    ...CATEGORIES.map((c) => ({ url: `${SITE_URL}/categories/${c.slug}` })),
    ...GAMES.filter((g) => g.playable).map((g) => ({ url: `${SITE_URL}/games/${g.slug}` })),
  ];
}
