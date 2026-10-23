import PostList from "@/components/PostList";
import { getAllPosts } from "@/lib/posts";
import { PROFILE } from "@/lib/site";

export default async function Home() {
  const posts = await getAllPosts();
  return (
    <main data-world="room" className="page page--split">
      <section className="hero" aria-labelledby="intro">
        <p className="eyebrow">你好，我是</p>
        <h1 id="intro" className="display">
          {PROFILE.name}
        </h1>
        <p className="role">{PROFILE.role}</p>
        {PROFILE.bio.map((p) => (
          <p key={p} className="lede">
            {p}
          </p>
        ))}
        <ul className="tags" aria-label="技术栈">
          {PROFILE.skills.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="profile-links">
          {PROFILE.links.map((l) => (
            <a key={l.href} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              {l.label} ↗
            </a>
          ))}
        </p>
        <p className="hint">
          书房里的东西都能点：电脑是文章，书架是读书笔记，地球仪是分类星系，墙上的画是归档，窗外是随笔。
        </p>
      </section>
      {/* 窄屏时书房画在这块空白里 */}
      <div className="room-stage" aria-hidden="true" />
      <section className="panel side" data-ui aria-labelledby="latest">
        <h2 id="latest">最近更新</h2>
        <PostList posts={posts.slice(0, 3)} />
      </section>
    </main>
  );
}
