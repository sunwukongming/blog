"use client";

import dynamic from "next/dynamic";

// 游戏只在客户端运行（随机数、localStorage），各自拆成单独的包
const loading = () => <div className="game-loading" />;
const PLAYERS: Record<string, React.ComponentType> = {
  snake: dynamic(() => import("./Snake"), { ssr: false, loading }),
  tetris: dynamic(() => import("./Tetris"), { ssr: false, loading }),
  "2048": dynamic(() => import("./Game2048"), { ssr: false, loading }),
  breakout: dynamic(() => import("./Breakout"), { ssr: false, loading }),
  minesweeper: dynamic(() => import("./Minesweeper"), { ssr: false, loading }),
};

export default function GamePlayer({ slug }: { slug: string }) {
  const Player = PLAYERS[slug];
  return Player ? <Player /> : null;
}
