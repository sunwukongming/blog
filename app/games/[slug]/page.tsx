import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import GamePlayer from "@/components/games/GamePlayer";
import { GAMES, getPlayable } from "@/lib/games";
import { SITE, SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return GAMES.filter((g) => g.playable).map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/games/[slug]">): Promise<Metadata> {
  const game = getPlayable((await params).slug);
  if (!game) return {};
  const title = `${game.title} · ${SITE.name}`;
  const description = game.summary;
  const url = SITE_URL ? `${SITE_URL}/games/${game.slug}` : undefined;
  const images = SITE_URL ? [{ url: `${SITE_URL}/icon.svg`, alt: `${game.title} · ${SITE.name}` }] : undefined;
  return {
    title: game.title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: SITE.name,
      locale: "zh_CN",
      url,
      images,
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: images?.map((i) => i.url),
    },
  };
}

export default function GamePage({ params }: PageProps<"/games/[slug]">) {
  return (
    <main data-world="drive" className="page page--game">
      <Suspense fallback={null}>
        <GameBody params={params} />
      </Suspense>
    </main>
  );
}

async function GameBody({ params }: { params: Promise<{ slug: string }> }) {
  const game = getPlayable((await params).slug);
  if (!game) notFound();

  const pageUrl = SITE_URL ? `${SITE_URL}/games/${game.slug}` : `/games/${game.slug}`;
  const gameLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: game.title,
    description: game.summary,
    url: pageUrl,
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    inLanguage: "zh-CN",
    isPartOf: SITE_URL ? { "@type": "WebSite", name: SITE.name, url: SITE_URL } : undefined,
    author: { "@type": "Person", name: SITE.author },
  };

  return (
    <div className="game-wrap" data-game={game.slug}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(gameLd) }}
      />
      <header className="game-head">
        <Link href="/games" className="back">
          ← 游戏
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
