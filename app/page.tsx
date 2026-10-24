import Link from "next/link";
import GameBest from "@/components/games/GameBest";
import PostList from "@/components/PostList";
import { GAMES } from "@/lib/games";
import { getAllPosts } from "@/lib/posts";
import { PROFILE, SITE } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  description: SITE.description,
  openGraph: { title: SITE.name, description: SITE.description },
};


export default async function Home() {
  const posts = await getAllPosts();
  const playable = GAMES.filter((g) => g.playable).slice(0, 6);
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
          书房里的东西都能点：电脑进文章，手柄玩游戏，书架看云与可观测，地球仪进分类，墙上的画是归档（可按年折叠），窗外是随笔。
        </p>
      </section>
      {/* 窄屏时书房画在这块空白里 */}
      <div className="room-stage" aria-hidden="true" />
      <section className="panel side" data-ui aria-labelledby="latest">
        <h2 id="latest">最近更新</h2>
        <PostList posts={posts.slice(0, 3)} />
        <div className="home-play" aria-labelledby="play-quick">
          <div className="home-play__head">
            <h2 id="play-quick">桌上的游戏</h2>
            <Link href="/games" className="home-play__more">
              全部 ↗
            </Link>
          </div>
          <p className="home-play__note">
            纪录存在你本机浏览器里，换设备不会带走。完整列表与本机纪录汇总见{" "}
            <Link href="/games">游戏页</Link>。
          </p>
          <ul className="chips home-play__chips">
            {playable.map((g) => (
              <li key={g.slug}>
                <Link href={g.href ?? `/games/${g.slug}`}>
                  <span>{g.title}</span>
                  <GameBest slug={g.slug} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
