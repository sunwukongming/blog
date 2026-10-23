"use client";

import { useEffect, useReducer, type CSSProperties } from "react";
import { KEY_DIR, useKeys, useRecord, useSwipe, type Dir } from "./input";

/** gone：被合并掉的方块，滑到目标位置后在下一步移除，这样合并也有滑动动画 */
type Tile = { id: number; v: number; r: number; c: number; gone?: boolean; merged?: boolean; fresh?: boolean };
type State = { tiles: Tile[]; score: number; nextId: number; won: boolean; keepGoing: boolean; over: boolean };
type Action = { type: "move"; dir: Dir } | { type: "new" } | { type: "continue" };

// 第 i 行（列）里离移动方向最近的第 k 格
const CELL: Record<Dir, (i: number, k: number) => [number, number]> = {
  left: (i, k) => [i, k],
  right: (i, k) => [i, 3 - k],
  up: (i, k) => [k, i],
  down: (i, k) => [3 - k, i],
};

function spawn(s: State): State {
  const taken = new Set(s.tiles.filter((t) => !t.gone).map((t) => t.r * 4 + t.c));
  const free = [...Array(16).keys()].filter((i) => !taken.has(i));
  if (!free.length) return s;
  const i = free[Math.floor(Math.random() * free.length)];
  const tile = { id: s.nextId, v: Math.random() < 0.9 ? 2 : 4, r: i >> 2, c: i & 3, fresh: true };
  return { ...s, tiles: [...s.tiles, tile], nextId: s.nextId + 1 };
}

function stuck(tiles: Tile[]) {
  if (tiles.length < 16) return false;
  const at = new Map(tiles.map((t) => [t.r * 4 + t.c, t.v]));
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      const v = at.get(r * 4 + c);
      if ((c < 3 && at.get(r * 4 + c + 1) === v) || (r < 3 && at.get((r + 1) * 4 + c) === v)) return false;
    }
  return true;
}

function newGame(): State {
  return spawn(spawn({ tiles: [], score: 0, nextId: 1, won: false, keepGoing: false, over: false }));
}

function move(s: State, dir: Dir): State {
  if (s.over || (s.won && !s.keepGoing)) return s;
  const tiles = s.tiles.filter((t) => !t.gone).map((t) => ({ ...t, merged: false, fresh: false }));
  const at = new Map(tiles.map((t) => [t.r * 4 + t.c, t]));
  let moved = false;
  let gained = 0;
  for (let i = 0; i < 4; i++) {
    let slot = 0;
    let last: Tile | undefined;
    for (let k = 0; k < 4; k++) {
      const [r, c] = CELL[dir](i, k);
      const t = at.get(r * 4 + c);
      if (!t) continue;
      if (last && !last.merged && last.v === t.v) {
        Object.assign(t, { r: last.r, c: last.c, gone: true });
        last.v *= 2;
        last.merged = true;
        gained += last.v;
        moved = true;
      } else {
        const [nr, nc] = CELL[dir](i, slot++);
        if (nr !== t.r || nc !== t.c) moved = true;
        Object.assign(t, { r: nr, c: nc });
        last = t;
      }
    }
  }
  if (!moved) return s;
  const next = spawn({ ...s, tiles, score: s.score + gained });
  const live = next.tiles.filter((t) => !t.gone);
  return { ...next, won: s.won || live.some((t) => t.v >= 2048), over: stuck(live) };
}

function reducer(s: State, a: Action): State {
  if (a.type === "move") return move(s, a.dir);
  if (a.type === "continue") return { ...s, keepGoing: true };
  return newGame();
}

const COLORS: Record<number, [string, string]> = {
  2: ["#2b1342", "#ffd6f0"],
  4: ["#3d1760", "#ffd6f0"],
  8: ["#661c80", "#fff"],
  16: ["#8f1f86", "#fff"],
  32: ["#bd2487", "#fff"],
  64: ["#ff3ea5", "#fff"],
  128: ["#ff6b8b", "#2a0718"],
  256: ["#ff9a6b", "#2a0718"],
  512: ["#ffc15e", "#2a0718"],
  1024: ["#ffe066", "#2a0718"],
  2048: ["#7af5ff", "#03222a"],
};

function tileStyle(t: Tile): CSSProperties {
  const [bg, fg] = COLORS[t.v] ?? ["#ffffff", "#14021f"];
  const digits = String(t.v).length;
  return {
    "--r": t.r,
    "--c": t.c,
    background: bg,
    color: fg,
    fontSize: `${[0, 10, 9, 7.5, 6, 5][Math.min(digits, 5)]}cqi`,
    boxShadow: t.v >= 64 ? `0 0 18px ${bg}80` : undefined,
  } as CSSProperties;
}

export default function Game2048() {
  const [state, dispatch] = useReducer(reducer, null, newGame);
  const [best, submitBest] = useRecord("2048", (next, prev) => next > prev);

  useEffect(() => {
    if (state.score > 0) submitBest(state.score);
  }, [state.score, submitBest]);

  useKeys((key) => {
    const dir = KEY_DIR[key];
    if (!dir) return false;
    dispatch({ type: "move", dir });
    return true;
  });

  const swipe = useSwipe((dir) => dispatch({ type: "move", dir }));
  // 被合并掉的方块画在下面
  const tiles = state.tiles.toSorted((a, b) => Number(!a.gone) - Number(!b.gone));

  return (
    <div className="game">
      <div className="game-bar">
        <span>
          分数<b>{state.score}</b>
        </span>
        <span>
          最高<b>{best ?? 0}</b>
        </span>
        <span className="spacer" />
        <button type="button" className="game-btn" onClick={() => dispatch({ type: "new" })}>
          新游戏
        </button>
      </div>
      <div className="game-stage t2048" {...swipe}>
        {[...Array(16).keys()].map((i) => (
          <div key={i} className="t2048-cell" style={{ "--r": i >> 2, "--c": i & 3 } as CSSProperties} />
        ))}
        {tiles.map((t) => (
          <div
            key={t.id}
            className="t2048-tile"
            data-merged={t.merged || undefined}
            data-fresh={t.fresh || undefined}
            style={tileStyle(t)}
          >
            {t.v}
          </div>
        ))}
        {state.over && (
          <div className="game-overlay">
            <strong>没有路可走了</strong>
            <p>这局得了 {state.score} 分</p>
            <button type="button" className="game-btn game-btn--primary" onClick={() => dispatch({ type: "new" })}>
              再来一局
            </button>
          </div>
        )}
        {state.won && !state.keepGoing && !state.over && (
          <div className="game-overlay">
            <strong>2048！</strong>
            <p>凑出来了，还要继续往上冲吗？</p>
            <span style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="game-btn game-btn--primary"
                onClick={() => dispatch({ type: "continue" })}
              >
                继续
              </button>
              <button type="button" className="game-btn" onClick={() => dispatch({ type: "new" })}>
                新游戏
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
