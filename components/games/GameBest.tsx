"use client";

import { useT } from "@/components/i18n/LangProvider";
import { GAME_BEST_MESSAGES } from "./GameBest.messages";
import { useRecord, useRecordList } from "./input";

const never = () => false;

function MinesBest() {
  const t = useT(GAME_BEST_MESSAGES);
  const [easy, medium, mediumTall] = useRecordList([
    "minesweeper-easy",
    "minesweeper-medium",
    "minesweeper-medium-tall",
  ]);
  const parts: string[] = [];
  if (easy !== null) parts.push(t.minesEasy(easy));
  const mid = medium ?? mediumTall;
  if (mid !== null) parts.push(t.minesMedium(mid));
  return <span className="game-card__best">{parts.length ? parts.join(" · ") : t.never}</span>;
}

function MemoryBest() {
  const t = useT(GAME_BEST_MESSAGES);
  const [easy, normal, hard, legacy] = useRecordList(["memory-easy", "memory-normal", "memory-hard", "memory"]);
  const norm = normal ?? legacy;
  const parts: string[] = [];
  if (easy !== null) parts.push(t.memoryEasy(easy));
  if (norm !== null) parts.push(t.memoryNormal(norm));
  if (hard !== null) parts.push(t.memoryHard(hard));
  return <span className="game-card__best">{parts.length ? t.memoryFewest(parts.join(" / ")) : t.never}</span>;
}

function ScoreBest({ slug }: { slug: string }) {
  const t = useT(GAME_BEST_MESSAGES);
  const RECORD: Record<string, { key: string; label: (v: number) => string }> = {
    snake: { key: "snake-unlocked", label: t.stage },
    tetris: { key: "tetris", label: t.score },
    "2048": { key: "2048", label: t.score },
    breakout: { key: "breakout-unlocked", label: t.stage },
    poker: { key: "poker", label: t.chips },
  };
  const rec = RECORD[slug];
  const [best] = useRecord(rec?.key ?? slug, never);
  return <span className="game-card__best">{best === null || !rec ? t.never : rec.label(best)}</span>;
}

export default function GameBest({ slug }: { slug: string }) {
  if (slug === "minesweeper") return <MinesBest />;
  if (slug === "memory") return <MemoryBest />;
  return <ScoreBest slug={slug} />;
}
