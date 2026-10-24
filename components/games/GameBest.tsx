"use client";

import { useRecord } from "./input";

// 列表卡片上显示本机的记录：闯关游戏显示解锁到第几关，扫雷显示初级最快用时，其余显示最高分
const RECORD: Record<string, { key: string; label: (v: number) => string }> = {
  snake: { key: "snake-unlocked", label: (v) => `闯到第 ${v} 关` },
  tetris: { key: "tetris", label: (v) => `最高 ${v} 分` },
  "2048": { key: "2048", label: (v) => `最高 ${v} 分` },
  breakout: { key: "breakout-unlocked", label: (v) => `闯到第 ${v} 关` },
  minesweeper: { key: "minesweeper-easy", label: (v) => `初级最快 ${v} 秒` },
  poker: { key: "poker", label: (v) => `最多 ${v} 筹码` },
  memory: { key: "memory", label: (v) => `最少 ${v} 步` },
};

const never = () => false;

export default function GameBest({ slug }: { slug: string }) {
  const rec = RECORD[slug];
  const [best] = useRecord(rec?.key ?? slug, never);
  return <span className="game-card__best">{best === null || !rec ? "还没玩过" : rec.label(best)}</span>;
}
