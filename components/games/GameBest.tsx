"use client";

import { useRecord, useRecordList } from "./input";

const never = () => false;

function MinesBest() {
  const [easy, medium, mediumTall] = useRecordList([
    "minesweeper-easy",
    "minesweeper-medium",
    "minesweeper-medium-tall",
  ]);
  const parts: string[] = [];
  if (easy !== null) parts.push(`初级 ${easy}s`);
  const mid = medium ?? mediumTall;
  if (mid !== null) parts.push(`中级 ${mid}s`);
  return <span className="game-card__best">{parts.length ? parts.join(" · ") : "还没玩过"}</span>;
}

function MemoryBest() {
  const [easy, normal, hard, legacy] = useRecordList(["memory-easy", "memory-normal", "memory-hard", "memory"]);
  const norm = normal ?? legacy;
  const parts: string[] = [];
  if (easy !== null) parts.push(`简单 ${easy}`);
  if (norm !== null) parts.push(`普通 ${norm}`);
  if (hard !== null) parts.push(`困难 ${hard}`);
  return <span className="game-card__best">{parts.length ? `最少 ${parts.join(" / ")} 步` : "还没玩过"}</span>;
}

function ScoreBest({ slug }: { slug: string }) {
  const RECORD: Record<string, { key: string; label: (v: number) => string }> = {
    snake: { key: "snake-unlocked", label: (v) => `闯到第 ${v} 关` },
    tetris: { key: "tetris", label: (v) => `最高 ${v} 分` },
    "2048": { key: "2048", label: (v) => `最高 ${v} 分` },
    breakout: { key: "breakout-unlocked", label: (v) => `闯到第 ${v} 关` },
    poker: { key: "poker", label: (v) => `最多 ${v} 筹码` },
  };
  const rec = RECORD[slug];
  const [best] = useRecord(rec?.key ?? slug, never);
  return <span className="game-card__best">{best === null || !rec ? "还没玩过" : rec.label(best)}</span>;
}

export default function GameBest({ slug }: { slug: string }) {
  if (slug === "minesweeper") return <MinesBest />;
  if (slug === "memory") return <MemoryBest />;
  return <ScoreBest slug={slug} />;
}
