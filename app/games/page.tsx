import type { Metadata } from "next";
import Link from "next/link";
import GameBest from "@/components/games/GameBest";
import GameIcon from "@/components/games/GameIcon";
import { GAMES, gamesByStatus, type GameItem } from "@/lib/games";

export const metadata: Metadata = {
  title: "游戏",
  description: "GM Lab 桌上小游戏：贪吃蛇、俄罗斯方块、2048、打砖块、扫雷、德州扑克与记忆翻牌；本机纪录存浏览器，可直接在站内玩。",
};

const STATUS_LABEL: Record<GameItem["status"], string> = {
  lab: "实验室",
  shipped: "能直接玩",
  archive: "做过的",
};

export default function GamesPage() {
  const playable = GAMES.filter((g) => g.playable);
  const groups = gamesByStatus().map(({ status, items }) => ({ status, items: items.filter((g) => !g.playable) }));
  return (
    <main data-world="drive" className="page">
      <div className="hero">
        <p className="eyebrow">Games · GM Lab</p>
        <h1 className="display">游戏</h1>
        <p className="lede">
          书房桌上的那些——用来验证交互与前端手感的小游戏。纪录存在你本机浏览器里，换设备不会带走。和首页「桌上的游戏」是同一批入口。
        </p>
      </div>
      <section className="panel games-records" data-ui aria-labelledby="g-records">
        <h2 id="g-records">本机纪录</h2>
        <p className="games-records__note">有玩过才会显示具体数字；卡片上也能看到同一套数据。</p>
        <ul className="games-records__list">
          {playable.map((g) => (
            <li key={g.slug}>
              <Link href={g.href!}>
                <span className="games-records__title">{g.title}</span>
                <GameBest slug={g.slug} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="g-play">
        <h2 id="g-play" className="sr-only">
          能直接玩
        </h2>
        <ul className="game-cards">
          {playable.map((g) => (
            <li key={g.slug}>
              <Link href={g.href!} className="panel game-card">
                <GameIcon slug={g.slug} />
                <span className="game-card__title">{g.title}</span>
                <span className="game-card__summary">{g.summary}</span>
                <GameBest slug={g.slug} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <div className="side" style={{ display: "grid", gap: 16 }}>
        {groups.filter((g) => g.items.length).map(({ status, items }) => (
          <section key={status} className="panel" data-ui aria-labelledby={`g-${status}`}>
            <h2 id={`g-${status}`}>{STATUS_LABEL[status]}</h2>
            <ul className="post-list">
              {items.map((g) => {
                const body = (
                  <>
                    <span className="post-list__title">{g.title}</span>
                    <span className="post-list__meta">{g.stack.join(" · ")}</span>
                    <span className="post-list__summary">{g.summary}</span>
                  </>
                );
                return (
                  <li key={g.slug}>
                    {g.href ? <Link href={g.href}>{body}</Link> : <div className="games-item">{body}</div>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
