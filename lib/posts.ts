import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { getCategory } from "./categories";

const POSTS_DIR = path.join(process.cwd(), "content/posts");

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  category: string;
  summary: string;
  readingMinutes: number;
};

export type Post = PostMeta & { body: string };

async function readPost(file: string): Promise<Post> {
  const raw = await fs.readFile(path.join(POSTS_DIR, file), "utf8");
  const { data, content } = matter(raw);
  // frontmatter 写错时让构建直接失败，而不是在页面上显示 "undefined"
  const problems = [
    !data.title && "缺少 title",
    !/^\d{4}-\d{2}-\d{2}$/.test(String(data.date ?? "")) && "date 必须是 YYYY-MM-DD 格式并加引号",
    !getCategory(String(data.category)) && `未知分类 "${data.category}"`,
  ].filter(Boolean);
  if (problems.length) throw new Error(`content/posts/${file}：${problems.join("；")}`);
  // 中文按约 400 字/分钟估算
  const chars = content.replace(/\s/g, "").length;
  return {
    slug: file.replace(/\.mdx?$/, ""),
    title: String(data.title),
    date: String(data.date),
    category: String(data.category),
    summary: String(data.summary ?? ""),
    readingMinutes: Math.max(1, Math.round(chars / 400)),
    body: content,
  };
}

export async function getAllPosts(): Promise<PostMeta[]> {
  "use cache";
  const files = (await fs.readdir(POSTS_DIR)).filter((f) => /\.mdx?$/.test(f));
  const posts = await Promise.all(files.map(readPost));
  return posts
    .map((p): PostMeta => ({
      slug: p.slug,
      title: p.title,
      date: p.date,
      category: p.category,
      summary: p.summary,
      readingMinutes: p.readingMinutes,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPost(slug: string): Promise<Post | null> {
  "use cache";
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    return await readPost(`${slug}.mdx`);
  } catch {
    return null;
  }
}
