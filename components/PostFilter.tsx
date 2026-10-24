"use client";

import { useMemo, useState } from "react";
import PostList from "@/components/PostList";
import { CATEGORIES } from "@/lib/categories";
import type { PostMeta } from "@/lib/posts";

export default function PostFilter({ posts }: { posts: PostMeta[] }) {
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
          <span className="sr-only">搜索文章</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索标题或摘要…"
            autoComplete="off"
          />
        </label>
        <div className="post-filter__cats" role="group" aria-label="按分类筛选">
          <button type="button" className="game-btn" aria-pressed={cat === "all"} onClick={() => setCat("all")}>
            全部
          </button>
          {CATEGORIES.map((c) => (
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
        显示 {filtered.length} / {posts.length} 篇
      </p>
      {filtered.length ? (
        <PostList posts={filtered} summary />
      ) : (
        <p className="lede">没有匹配的文章，试试别的词或分类。</p>
      )}
    </div>
  );
}
