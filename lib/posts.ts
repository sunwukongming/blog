import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { getCategory } from "./categories";
import { DEFAULT_LOCALE, hasLocale, LOCALES, type Locale } from "./i18n";

const POSTS_DIR = path.join(process.cwd(), "content/posts");

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  category: string;
  summary: string;
  readingMinutes: number;
  /** 这份内容实际用的语言：请求的语言没有译文时是中文原文 */
  contentLang: Locale;
  /** 这篇文章有哪些语言的版本（总是包含 zh） */
  langs: Locale[];
};

export type Post = PostMeta & { body: string };

const SLUG = /^[a-z0-9-]+$/;

/**
 * 文件命名：xxx.mdx 是中文原文；xxx.en.mdx、xxx.ja.mdx 是译文。
 * 译文的 frontmatter 只需要 title 和 summary，日期和分类沿用原文
 */
function parseFile(file: string): { slug: string; lang: Locale } {
  const m = file.match(/^(.+?)(?:\.([a-z]{2}))?\.mdx$/);
  const lang = m?.[2] ?? DEFAULT_LOCALE;
  if (!m || !SLUG.test(m[1]) || !hasLocale(lang) || (m[2] && lang === DEFAULT_LOCALE)) {
    throw new Error(
      `content/posts/${file}：文件名必须是 slug.mdx 或 slug.en.mdx / slug.ja.mdx，slug 只能用小写字母、数字和 -`,
    );
  }
  return { slug: m[1], lang };
}

/** 阅读时长：中文约 400 字/分钟，日文约 500 字/分钟，英文约 220 词/分钟 */
function readingMinutes(content: string, lang: Locale) {
  const n = lang === "en" ? content.split(/\s+/).filter(Boolean).length : content.replace(/\s/g, "").length;
  return Math.max(1, Math.round(n / (lang === "en" ? 220 : lang === "ja" ? 500 : 400)));
}

type Source = { title: string; summary: string; body: string; date?: string; category?: string };

async function readSource(file: string): Promise<Source> {
  const { data, content } = matter(await fs.readFile(path.join(POSTS_DIR, file), "utf8"));
  if (!data.title) throw new Error(`content/posts/${file}：缺少 title`);
  return {
    title: String(data.title),
    summary: String(data.summary ?? ""),
    body: content,
    date: data.date === undefined ? undefined : String(data.date),
    category: data.category === undefined ? undefined : String(data.category),
  };
}

/** 扫描目录：每篇文章有哪些语言的文件 */
async function scan() {
  const files = (await fs.readdir(POSTS_DIR)).filter((f) => f.endsWith(".mdx"));
  const found = new Map<string, Locale[]>();
  for (const f of files) {
    const { slug, lang } = parseFile(f);
    found.set(slug, [...(found.get(slug) ?? []), lang]);
  }
  for (const [slug, l] of found) {
    if (!l.includes(DEFAULT_LOCALE)) throw new Error(`content/posts/${slug}：只有译文，缺少中文原文 ${slug}.mdx`);
    found.set(
      slug,
      LOCALES.filter((x) => l.includes(x)),
    );
  }
  return found;
}

async function readPost(slug: string, lang: Locale, langs: Locale[]): Promise<Post> {
  const original = await readSource(`${slug}.mdx`);
  // frontmatter 写错时让构建直接失败，而不是在页面上显示 "undefined"
  const problems = [
    !/^\d{4}-\d{2}-\d{2}$/.test(original.date ?? "") && "date 必须是 YYYY-MM-DD 格式并加引号",
    !getCategory(original.category ?? "") && `未知分类 "${original.category}"`,
  ].filter(Boolean);
  if (problems.length) throw new Error(`content/posts/${slug}.mdx：${problems.join("；")}`);

  const contentLang = langs.includes(lang) ? lang : DEFAULT_LOCALE;
  const src = contentLang === DEFAULT_LOCALE ? original : await readSource(`${slug}.${contentLang}.mdx`);
  return {
    slug,
    title: src.title,
    summary: src.summary,
    body: src.body,
    date: original.date!,
    category: original.category!,
    readingMinutes: readingMinutes(src.body, contentLang),
    contentLang,
    langs,
  };
}

/** 某种语言下的全部文章（没有译文的用中文原文），按日期倒序 */
export async function getAllPosts(lang: Locale): Promise<PostMeta[]> {
  "use cache";
  const found = await scan();
  const posts = await Promise.all([...found].map(([slug, langs]) => readPost(slug, lang, langs)));
  return posts
    .map((p): PostMeta => ({
      slug: p.slug,
      title: p.title,
      date: p.date,
      category: p.category,
      summary: p.summary,
      readingMinutes: p.readingMinutes,
      contentLang: p.contentLang,
      langs: p.langs,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPost(slug: string, lang: Locale): Promise<Post | null> {
  "use cache";
  if (!SLUG.test(slug)) return null;
  const langs = (await scan()).get(slug);
  return langs ? readPost(slug, lang, langs) : null;
}

/** same-category first */
export async function getRelatedPosts(slug: string, category: string, lang: Locale, limit = 3): Promise<PostMeta[]> {
  const all = await getAllPosts(lang);
  const same = all.filter((p) => p.slug !== slug && p.category === category);
  if (same.length >= limit) return same.slice(0, limit);
  const rest = all.filter((p) => p.slug !== slug && p.category !== category);
  return [...same, ...rest].slice(0, limit);
}
