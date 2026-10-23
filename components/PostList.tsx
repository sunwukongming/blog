import Link from "next/link";
import { getCategory } from "@/lib/categories";
import type { PostMeta } from "@/lib/posts";

export default function PostList({ posts, summary = false }: { posts: PostMeta[]; summary?: boolean }) {
  return (
    <ul className="post-list">
      {posts.map((p) => (
        <li key={p.slug}>
          <Link href={`/blog/${p.slug}`}>
            <span className="post-list__title">{p.title}</span>
            <span className="post-list__meta">
              {getCategory(p.category)?.name} · {p.date}
            </span>
            {summary && <span className="post-list__summary">{p.summary}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
