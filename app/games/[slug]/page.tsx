import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import GamePlayer from "@/components/games/GamePlayer";
import { GAMES, getPlayable } from "@/lib/games";

export function generateStaticParams() {
  return GAMES.filter((g) => g.playable).map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/games/[slug]">): Promise<Metadata> {
  const game = getPlayable((await params).slug);
  return game ? { title: game.title, description: game.summary } : {};
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

  return (
    <div className="game-wrap" data-game={game.slug}>
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
