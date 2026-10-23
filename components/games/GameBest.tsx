"use client";

import { useRecord } from "./input";

// 列表卡片上显示本机的最高分；扫雷显示初级最快用时
const RECORD: Record<string, { key: string; label: (v: number) => string }> = {
  snake: { key: "snake", label: (v) => `最高 ${v} 分` },
  tetris: { key: "tetris", label: (v) => `最高 ${v} 分` },
  "2048": { key: "2048", label: (v) => `最高 ${v} 分` },
  breakout: { key: "breakout", label: (v) => `最高 ${v} 分` },
  minesweeper: { key: "minesweeper-easy", label: (v) => `初级最快 ${v} 秒` },
};

const never = () => false;

export default function GameBest({ slug }: { slug: string }) {
  const rec = RECORD[slug];
  const [best] = useRecord(rec?.key ?? slug, never);
  return <span className="game-card__best">{best === null || !rec ? "还没玩过" : rec.label(best)}</span>;
}
