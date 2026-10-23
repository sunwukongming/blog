import type { Metadata } from "next";
import PostList from "@/components/PostList";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = { title: "归档" };

export default async function Archive() {
  const posts = await getAllPosts();
  const years = Map.groupBy(posts, (p) => p.date.slice(0, 4));
  return (
    <main data-world="drive" className="page">
      <div className="hero">
        <p className="eyebrow">Archive · {posts.length} entries</p>
        <h1 className="display">一路开过来的</h1>
      </div>
      <div className="side" style={{ display: "grid", gap: 16 }}>
        {[...years].map(([year, list]) => (
          <section key={year} className="panel" data-ui aria-labelledby={`y${year}`}>
            <h2 id={`y${year}`}>{year}</h2>
            <PostList posts={list} />
          </section>
        ))}
      </div>
    </main>
  );
}
