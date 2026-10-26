import type { Metadata } from "next";
import Link from "next/link";
import GameBest from "@/components/games/GameBest";
import GameIcon from "@/components/games/GameIcon";
import { gamesByStatus, getGames } from "@/lib/games";
import { HTML_LANG, localePath } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { UI } from "@/lib/messages";
import { absUrl, pageMeta } from "@/lib/meta";
import { getSite } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const t = UI[lang].games;
  return pageMeta({ lang, path: "/games", title: t.title, description: t.description });
}

export default async function GamesPage() {
  const lang = await getLang();
  const t = UI[lang].games;
  const playable = getGames(lang).filter((g) => g.playable);
  const groups = gamesByStatus(lang).map(({ status, items }) => ({ status, items: items.filter((g) => !g.playable) }));
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t.listName(getSite(lang).name),
    description: t.description,
    inLanguage: HTML_LANG[lang],
    numberOfItems: playable.length,
    itemListElement: playable.map((game, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absUrl(lang, game.href!),
      name: game.title,
      description: game.summary,
    })),
  };
  return (
    <main data-world="drive" className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <div className="hero">
        <p className="eyebrow">Games · GM Lab</p>
        <h1 className="display">{t.heading}</h1>
        <p className="lede">{t.lede}</p>
      </div>
      <section className="panel games-records" data-ui aria-labelledby="g-records">
        <h2 id="g-records">{t.records}</h2>
        <p className="games-records__note">{t.recordsNote}</p>
        <ul className="games-records__list">
          {playable.map((g) => (
            <li key={g.slug}>
              <Link href={localePath(lang, g.href!)}>
                <span className="games-records__title">{g.title}</span>
                <GameBest slug={g.slug} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="g-play">
        <h2 id="g-play" className="sr-only">
          {t.playable}
        </h2>
        <ul className="game-cards">
          {playable.map((g) => (
            <li key={g.slug}>
              <Link href={localePath(lang, g.href!)} className="panel game-card">
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
        {groups
          .filter((g) => g.items.length)
          .map(({ status, items }) => (
            <section key={status} className="panel" data-ui aria-labelledby={`g-${status}`}>
              <h2 id={`g-${status}`}>{t.status[status]}</h2>
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
                      {g.href ? (
                        <Link href={localePath(lang, g.href)}>{body}</Link>
                      ) : (
                        <div className="games-item">{body}</div>
                      )}
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
