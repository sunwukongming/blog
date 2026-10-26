import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import GamePlayer from "@/components/games/GamePlayer";
import { getPlayable, PLAYABLE_SLUGS } from "@/lib/games";
import { HTML_LANG, localePath } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { UI } from "@/lib/messages";
import { absUrl, pageMeta } from "@/lib/meta";
import { getSite, SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return PLAYABLE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/games/[slug]">): Promise<Metadata> {
  const lang = await getLang();
  const game = getPlayable((await params).slug, lang);
  if (!game) return {};
  return pageMeta({ lang, path: `/games/${game.slug}`, title: game.title, description: game.summary });
}

export default function GamePage({ params }: PageProps<"/[lang]/games/[slug]">) {
  return (
    <main data-world="drive" className="page page--game">
      <Suspense fallback={null}>
        <GameBody params={params} />
      </Suspense>
    </main>
  );
}

async function GameBody({ params }: { params: Promise<{ slug: string }> }) {
  const lang = await getLang();
  const site = getSite(lang);
  const game = getPlayable((await params).slug, lang);
  if (!game) notFound();

  const gameLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: game.title,
    description: game.summary,
    url: absUrl(lang, `/games/${game.slug}`),
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    inLanguage: HTML_LANG[lang],
    isPartOf: SITE_URL ? { "@type": "WebSite", name: site.name, url: absUrl(lang, "/") } : undefined,
    author: { "@type": "Person", name: site.author },
  };

  return (
    <div className="game-wrap" data-game={game.slug}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(gameLd) }} />
      <header className="game-head">
        <Link href={localePath(lang, "/games")} className="back">
          {UI[lang].games.back}
        </Link>
        <h1 className="game-title">{game.title}</h1>
      </header>
      <section className="panel game-panel" data-ui aria-label={game.title}>
        <GamePlayer slug={game.slug} />
        <p className="game-hint game-hint--fine">{game.controls}</p>
        <p className="game-hint game-hint--touch">{game.touchControls}</p>
      </section>
    </div>
  );
}
