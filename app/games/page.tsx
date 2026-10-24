import type { Metadata } from "next";
import Link from "next/link";
import GameBest from "@/components/games/GameBest";
import GameIcon from "@/components/games/GameIcon";
import { GAMES, gamesByStatus, type GameItem } from "@/lib/games";
import { SITE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "游戏",
  description: "GM Lab 桌上小游戏：贪吃蛇、俄罗斯方块、2048、打砖块、扫雷、德州扑克与记忆翻牌；本机纪录存浏览器，HUD 提示连击/道具/胜率，可直接在站内玩。",
  openGraph: {
    title: "游戏",
    description: "GM Lab 桌上小游戏：贪吃蛇、俄罗斯方块、2048、打砖块、扫雷、德州扑克与记忆翻牌；本机纪录存浏览器，HUD 提示连击/道具/胜率，可直接在站内玩。",
    type: "website",
    siteName: SITE.name,
    locale: "zh_CN",
    url: SITE_URL ? `${SITE_URL}/games` : undefined,
    images: SITE_URL ? [{ url: `${SITE_URL}/icon.svg`, alt: `${SITE.name} 游戏` }] : undefined,
  },
  alternates: SITE_URL ? { canonical: "/games" } : undefined,
  twitter: {
    card: "summary",
    title: "游戏",
    description: "GM Lab 桌上小游戏：贪吃蛇、俄罗斯方块、2048、打砖块、扫雷、德州扑克与记忆翻牌；本机纪录存浏览器，HUD 提示连击/道具/胜率，可直接在站内玩。",
    // batch42: 与 openGraph.images 对齐
    // batch50: 再核游戏列表 OG/Twitter images 同源 icon.svg；ItemList 仅 playable
    // batch55: ItemList 补 inLanguage=zh-CN；numberOfItems 仍=playable.length
    // batch60: 再核 ItemList 仅 playable + inLanguage；与 categories/sitemap 注释对齐
    images: SITE_URL ? [`${SITE_URL}/icon.svg`] : undefined,
  },
};

const STATUS_LABEL: Record<GameItem["status"], string> = {
  lab: "实验室",
  shipped: "能直接玩",
  archive: "做过的",
};

export default function GamesPage() {
  const playable = GAMES.filter((g) => g.playable);
  const groups = gamesByStatus().map(({ status, items }) => ({ status, items: items.filter((g) => !g.playable) }));
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${SITE.name} 游戏`,
    description: "站内可玩小游戏列表（蛇 / 方块 / 2048 / 砖块 / 扫雷 / 扑克 / 记忆）",
    inLanguage: "zh-CN",
    numberOfItems: playable.length,
    itemListElement: playable.map((game, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: SITE_URL && game.href ? `${SITE_URL}${game.href}` : game.href,
      name: game.title,
      description: game.summary,
    })),
  };
  return (
    <main data-world="drive" className="page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
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
