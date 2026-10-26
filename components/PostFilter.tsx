"use client";

import { useMemo, useState } from "react";
import { useLang } from "@/components/i18n/LangProvider";
import PostList from "@/components/PostList";
import { getCategories } from "@/lib/categories";
import { UI } from "@/lib/messages";
import type { PostMeta } from "@/lib/posts";

export default function PostFilter({ posts }: { posts: PostMeta[] }) {
  const lang = useLang();
  const t = UI[lang].filter;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return posts.filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (!needle) return true;
      const hay = `${p.title} ${p.summary} ${p.slug}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [posts, q, cat]);

  return (
    <div className="post-filter">
      <div className="post-filter__controls">
        <label className="post-filter__search">
          <span className="sr-only">{t.search}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.placeholder}
            autoComplete="off"
          />
        </label>
        <div className="post-filter__cats" role="group" aria-label={t.byCategory}>
          <button type="button" className="game-btn" aria-pressed={cat === "all"} onClick={() => setCat("all")}>
            {t.all}
          </button>
          {getCategories(lang).map((c) => (
            <button
              key={c.slug}
              type="button"
              className="game-btn"
              aria-pressed={cat === c.slug}
              onClick={() => setCat(c.slug)}
            >
              <span className="dot" style={{ background: c.color, width: 8, height: 8 }} />
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <p className="post-filter__count" aria-live="polite">
        {t.count(filtered.length, posts.length)}
      </p>
      {filtered.length ? <PostList posts={filtered} lang={lang} summary /> : <p className="lede">{t.empty}</p>}
    </div>
  );
}
