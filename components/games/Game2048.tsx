"use client";

import { useEffect, useReducer, useRef, type CSSProperties } from "react";
import { KEY_DIR, useKeys, useRecord, useSwipe, type Dir } from "./input";

/** gone：被合并掉的方块，滑到目标位置后在下一步移除，这样合并也有滑动动画 */
type Tile = { id: number; v: number; r: number; c: number; gone?: boolean; merged?: boolean; fresh?: boolean };
type Snapshot = { tiles: Tile[]; score: number; nextId: number; won: boolean; keepGoing: boolean; over: boolean };
type State = Snapshot & { past: Snapshot | null };
type Action = { type: "move"; dir: Dir } | { type: "new" } | { type: "continue" } | { type: "undo" };

// 第 i 行（列）里离移动方向最近的第 k 格
const CELL: Record<Dir, (i: number, k: number) => [number, number]> = {
  left: (i, k) => [i, k],
  right: (i, k) => [i, 3 - k],
  up: (i, k) => [k, i],
  down: (i, k) => [3 - k, i],
};

function spawn(s: Snapshot): Snapshot {
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

function blank(): Snapshot {
  return { tiles: [], score: 0, nextId: 1, won: false, keepGoing: false, over: false };
}

function newGame(): State {
  const base = spawn(spawn(blank()));
  return { ...base, past: null };
}

function snapOf(s: State): Snapshot {
  return {
    tiles: s.tiles.map((t) => ({ ...t })),
    score: s.score,
    nextId: s.nextId,
    won: s.won,
    keepGoing: s.keepGoing,
    over: s.over,
  };
}

function move(s: State, dir: Dir): State {
  if (s.over || (s.won && !s.keepGoing)) return s;
  const before = snapOf(s);
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
  const next = spawn({ ...before, tiles, score: s.score + gained, won: s.won, keepGoing: s.keepGoing, over: false });
  const live = next.tiles.filter((t) => !t.gone);
  return {
    ...next,
    won: s.won || live.some((t) => t.v >= 2048),
    over: stuck(live),
    past: before,
  };
}

function reducer(s: State, a: Action): State {
  if (a.type === "move") return move(s, a.dir);
  if (a.type === "continue") return { ...s, keepGoing: true };
  if (a.type === "undo") {
    if (!s.past) return s;
    return { ...s.past, past: null };
  }
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

function boardHint(tiles: Tile[]) {
  const live = tiles.filter((x) => !x.gone);
  const max = live.reduce((m, x) => Math.max(m, x.v), 0);
  const nextTier = max > 0 ? max * 2 : 2;
  const at = new Map(live.map((x) => [x.r * 4 + x.c, x.v]));
  let mergeable = 0;
  for (const t of live) {
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
    ] as const) {
      const v = at.get((t.r + dr) * 4 + (t.c + dc));
      if (v === t.v) mergeable++;
    }
  }
  return { max, nextTier, mergeable };
}

export default function Game2048() {
  const [state, dispatch] = useReducer(reducer, null, newGame);
  const [best, submitBest] = useRecord("2048", (next, prev) => next > prev);
  const canUndo = !!state.past && !state.over;

  useEffect(() => {
    if (state.score > 0) submitBest(state.score);
  }, [state.score, submitBest]);

  useKeys((key, repeat) => {
    if (!repeat && (key === "u" || key === "U" || key === "Backspace" || key === "z" || key === "Z")) {
      if (canUndo) dispatch({ type: "undo" });
      return true;
    }
    const dir = KEY_DIR[key];
    if (!dir) return false;
    // 按住方向键不放不连续移动，避免一下滑好几步
    if (!repeat) dispatch({ type: "move", dir });
    return true;
  });

  const lastSwipe = useRef(0);
  const swipe = useSwipe(
    (dir) => {
      const now = performance.now();
      // ignore bounce / double fire within 160ms
      if (now - lastSwipe.current < 160) return;
      lastSwipe.current = now;
      dispatch({ type: "move", dir });
    },
    { threshold: 42, axisRatio: 1.4 },
  );
  // 被合并掉的方块画在下面
  const tiles = state.tiles.toSorted((a, b) => Number(!a.gone) - Number(!b.gone));
  const mergeHint = boardHint(state.tiles);

  return (
    <div className="game">
      <div className="game-bar">
        <span>
          分数<b>{state.score}</b>
        </span>
        <span>
          最高<b>{best ?? 0}</b>
        </span>
        <span title="当前盘面最大块">
          最大<b>{mergeHint.max || "—"}</b>
        </span>
        <span title="下一档目标 = 当前最大块 ×2（通往更高幂次）">
          目标<b>{mergeHint.max ? mergeHint.nextTier : 4}</b>
          {mergeHint.max > 0 ? <small style={{ marginLeft: 4, opacity: 0.7 }}>←{mergeHint.max}</small> : null}
        </span>
        <span className="spacer" />
        <button
          type="button"
          className="game-btn"
          disabled={!canUndo}
          aria-disabled={!canUndo}
          onClick={() => dispatch({ type: "undo" })}
        >
          撤销
        </button>
        <button type="button" className="game-btn" onClick={() => dispatch({ type: "new" })}>
          新游戏
        </button>
      </div>
      {!state.over && !(state.won && !state.keepGoing) && mergeHint.max > 0 && (
        <p className={mergeHint.mergeable > 0 ? "game-tip" : "game-tip game-tip--alert"} aria-live="polite">
          {mergeHint.mergeable > 0
            ? `下一档目标 ${mergeHint.nextTier}：盘面最大 ${mergeHint.max}，有 ${mergeHint.mergeable} 处可合并`
            : `下一档目标 ${mergeHint.nextTier}：最大已是 ${mergeHint.max}，暂无相邻同号，先调整再拼`}
        </p>
      )}
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
            <span style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {state.past && (
                <button type="button" className="game-btn" onClick={() => dispatch({ type: "undo" })}>
                  撤销一步
                </button>
              )}
              <button type="button" className="game-btn game-btn--primary" onClick={() => dispatch({ type: "new" })}>
                再来一局
              </button>
            </span>
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
      <p className="game-hint">
        滑动或方向键移动。顶栏「最大 / 下一档」与可合并提示帮助盯目标；撤销仍用按钮或 U / Backspace。
      </p>
    </div>
  );
}
