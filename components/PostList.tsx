import Link from "next/link";
import { getCategory } from "@/lib/categories";
import { LANG_SHORT, localePath, type Locale } from "@/lib/i18n";
import type { PostMeta } from "@/lib/posts";

/** 文章列表；当前语言没有译文的文章在日期后标出原文语言（“中”） */
export default function PostList({
  posts,
  lang,
  summary = false,
}: {
  posts: PostMeta[];
  lang: Locale;
  summary?: boolean;
}) {
  return (
    <ul className="post-list">
      {posts.map((p) => (
        <li key={p.slug}>
          <Link href={localePath(lang, `/blog/${p.slug}`)}>
            <span className="post-list__title" lang={p.contentLang === lang ? undefined : "zh-CN"}>
              {p.title}
            </span>
            <span className="post-list__meta">
              {getCategory(p.category, lang)?.name} · {p.date}
              {p.contentLang !== lang && <span className="post-list__orig">{LANG_SHORT[p.contentLang]}</span>}
            </span>
            {summary && (
              <span className="post-list__summary" lang={p.contentLang === lang ? undefined : "zh-CN"}>
                {p.summary}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
