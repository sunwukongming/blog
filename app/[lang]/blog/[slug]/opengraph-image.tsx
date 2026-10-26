import { getCategory } from "@/lib/categories";
import { notFound } from "next/navigation";
import { hasLocale, type Locale } from "@/lib/i18n";
import { UI } from "@/lib/messages";
import { ogImage, OG_SIZE } from "@/lib/og";
import { getAllPosts, getPost } from "@/lib/posts";

export const alt = "GM Lab";
export const size = OG_SIZE;
export const contentType = "image/png";

// 只预生成有这种语言译文的文章（中文全部），其余在第一次被请求时生成
export async function generateStaticParams({ params }: { params: { lang: string } }) {
  const lang = params.lang as Locale;
  const posts = await getAllPosts(lang);
  return posts.filter((p) => p.contentLang === lang).map((p) => ({ slug: p.slug }));
}

// 图片路由属于 Route Handler，拿不到 next/root-params，语言从 params 里取
export default async function Image({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const post = await getPost(slug, lang);
  if (!post) return ogImage({ title: "GM Lab", lang });
  const tag = getCategory(post.category, lang)?.name;
  const minutes = UI[lang].post.minutes(post.readingMinutes);
  const subtitle = post.summary ? `${minutes} · ${post.summary}` : minutes;
  return ogImage({ title: post.title, subtitle, tag, lang: post.contentLang });
}
