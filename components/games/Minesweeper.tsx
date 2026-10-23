"use client";

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { useRecord } from "./input";

type Level = { key: string; label: string; w: number; h: number; mines: number };
type Cell = { mine: boolean; adj: number; open: boolean; flag: boolean };
type Phase = "ready" | "playing" | "won" | "lost";
type Game = { level: Level; cells: Cell[]; phase: Phase; startedAt: number; endedAt: number; exploded: number };

// 手机竖屏上 16×16 的格子太小点不准，中级换成 10×16，雷的密度不变
const narrow = window.matchMedia("(max-width: 600px)").matches;
const LEVELS: Level[] = [
  { key: "easy", label: "初级", w: 9, h: 9, mines: 10 },
  narrow
    ? { key: "medium-tall", label: "中级", w: 10, h: 16, mines: 25 }
    : { key: "medium", label: "中级", w: 16, h: 16, mines: 40 },
];

const LONG_PRESS_MS = 380;

function neighbors(i: number, { w, h }: Level) {
  const x = i % w;
  const y = Math.floor(i / w);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx);
    }
  return out;
}

function newGame(level: Level): Game {
  const cells = Array.from({ length: level.w * level.h }, () => ({ mine: false, adj: 0, open: false, flag: false }));
  return { level, cells, phase: "ready", startedAt: 0, endedAt: 0, exploded: -1 };
}

/** 第一下点开之后才埋雷，点的格子和周围一圈都不放雷 */
function plant(cells: Cell[], level: Level, safe: number) {
  const banned = new Set([safe, ...neighbors(safe, level)]);
  const pool = cells.map((_, i) => i).filter((i) => !banned.has(i));
  for (let n = 0; n < level.mines; n++) {
    const k = n + Math.floor(Math.random() * (pool.length - n));
    [pool[n], pool[k]] = [pool[k], pool[n]];
    cells[pool[n]].mine = true;
  }
  cells.forEach((c, i) => {
    c.adj = neighbors(i, level).filter((j) => cells[j].mine).length;
  });
}

function reveal(g: Game, i: number): Game {
  if (g.phase === "won" || g.phase === "lost") return g;
  const { level } = g;
  const cells = g.cells.map((c) => ({ ...c }));
  let { phase, startedAt } = g;
  if (phase === "ready") {
    plant(cells, level, i);
    phase = "playing";
    startedAt = Date.now();
  }

  // 点已经翻开的数字：周围旗子数对得上就把其余邻格一起翻开
  let targets = [i];
  if (cells[i].flag) return g;
  if (cells[i].open) {
    const around = neighbors(i, level);
    if (!cells[i].adj || around.filter((j) => cells[j].flag).length !== cells[i].adj) return g;
    targets = around;
  }

  let exploded = -1;
  const stack = targets.filter((j) => !cells[j].flag && !cells[j].open);
  while (stack.length) {
    const j = stack.pop()!;
    const c = cells[j];
    if (c.open || c.flag) continue;
    c.open = true;
    if (c.mine) exploded = j;
    else if (c.adj === 0) stack.push(...neighbors(j, level));
  }

  if (exploded >= 0) {
    cells.forEach((c) => c.mine && !c.flag && (c.open = true));
    return { ...g, cells, phase: "lost", startedAt, endedAt: Date.now(), exploded };
  }
  if (cells.filter((c) => c.open).length === cells.length - level.mines) {
    cells.forEach((c) => c.mine && (c.flag = true));
    return { ...g, cells, phase: "won", startedAt, endedAt: Date.now() };
  }
  return { ...g, cells, phase, startedAt };
}

function toggleFlag(g: Game, i: number): Game {
  if (g.phase === "won" || g.phase === "lost" || g.cells[i].open) return g;
  const cells = g.cells.map((c, j) => (j === i ? { ...c, flag: !c.flag } : c));
  return { ...g, cells };
}

function cellIndex(e: { target: EventTarget }) {
  const el = (e.target as Element).closest<HTMLElement>("[data-i]");
  return el ? Number(el.dataset.i) : -1;
}

// 用 SVG 画旗子和地雷，⚑ ✹ 这类符号很多字体里没有
const FlagIcon = () => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
    <path d="M4.5 14.5V2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M5 2.5h7.5l-2 3 2 3H5z" fill="currentColor" />
  </svg>
);

const MineIcon = () => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
    <path
      d="M8 1.5v13M1.5 8h13M3.4 3.4l9.2 9.2M12.6 3.4l-9.2 9.2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="8" cy="8" r="4.3" fill="currentColor" />
  </svg>
);

function cellLabel(c: Cell, lost: boolean) {
  if (c.open) return c.mine ? <MineIcon /> : c.adj || "";
  if (c.flag) return lost && !c.mine ? "×" : <FlagIcon />;
  return "";
}

export default function Minesweeper() {
  const [game, setGame] = useState(() => newGame(LEVELS[0]));
  const [flagMode, setFlagMode] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [best, submitBest] = useRecord(`minesweeper-${game.level.key}`, (next, prev) => next < prev);
  const press = useRef<{ timer: number; fired: boolean; touch: boolean } | null>(null);

  const { level, cells, phase } = game;
  const flags = cells.filter((c) => c.flag).length;
  const seconds = Math.floor(
    phase === "playing" ? Math.max(0, now - game.startedAt) / 1000 : phase === "ready" ? 0 : (game.endedAt - game.startedAt) / 1000,
  );

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase]);

  const onWin = useEffectEvent(() => submitBest(seconds));
  useEffect(() => {
    if (phase === "won") onWin();
  }, [phase]);

  const restart = (next = level) => setGame(newGame(next));

  const onClick = (e: MouseEvent) => {
    const i = cellIndex(e);
    if (i < 0) return;
    if (press.current?.fired) {
      press.current = null;
      return;
    }
    setGame((g) => (flagMode && !g.cells[i].open ? toggleFlag(g, i) : reveal(g, i)));
  };

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    // 手机上长按也会触发 contextmenu，交给长按计时器处理
    if (press.current?.touch) return;
    const i = cellIndex(e);
    if (i >= 0) setGame((g) => toggleFlag(g, i));
  };

  const onPointerDown = (e: PointerEvent) => {
    const i = cellIndex(e);
    if (e.pointerType === "mouse") press.current = null;
    if (i < 0 || e.pointerType === "mouse") return;
    const timer = window.setTimeout(() => {
      if (!press.current) return;
      press.current.fired = true;
      navigator.vibrate?.(15);
      setGame((g) => toggleFlag(g, i));
    }, LONG_PRESS_MS);
    press.current = { timer, fired: false, touch: true };
  };

  const endPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    // 长按成功时保留标记，让紧接着的 click 被忽略
    if (press.current && !press.current.fired) press.current = null;
  };

  return (
    <div className="game">
      <div className="game-bar">
        {LEVELS.map((l) => (
          <button
            key={l.key}
            type="button"
            className="game-btn"
            aria-pressed={l.key === level.key}
            onClick={() => restart(l)}
          >
            {l.label}
          </button>
        ))}
        <span className="spacer" />
        <span>
          雷<b>{level.mines - flags}</b>
        </span>
        <span>
          时间<b>{seconds}</b>
        </span>
      </div>
      <div
        className="mines"
        style={{ "--w": level.w } as CSSProperties}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onPointerDown={onPointerDown}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onPointerLeave={endPress}
      >
        {cells.map((c, i) => (
          <button
            key={i}
            type="button"
            data-i={i}
            className="mine-cell"
            data-open={c.open || undefined}
            data-flag={(!c.open && c.flag) || undefined}
            data-boom={i === game.exploded || undefined}
            data-n={c.open && !c.mine ? c.adj : undefined}
            aria-label={`第 ${Math.floor(i / level.w) + 1} 行第 ${(i % level.w) + 1} 列${c.flag ? "，已插旗" : c.open ? `，${c.mine ? "雷" : c.adj}` : ""}`}
          >
            {cellLabel(c, phase === "lost")}
          </button>
        ))}
      </div>
      <div className="game-bar">
        <button type="button" className="game-btn" aria-pressed={flagMode} onClick={() => setFlagMode(!flagMode)}>
          <FlagIcon /> 插旗模式
        </button>
        <span className="spacer" />
        <button type="button" className="game-btn" onClick={() => restart()}>
          重新开始
        </button>
      </div>
      <p className="game-hint" aria-live="polite">
        {phase === "won"
          ? `全部排完，用时 ${seconds} 秒${best === seconds ? "，新纪录！" : ""}`
          : phase === "lost"
            ? "踩雷了。点“重新开始”再来一局。"
            : best !== null
              ? `${level.label}最快 ${best} 秒`
              : "第一下随便点，不会踩雷。"}
      </p>
    </div>
  );
}
