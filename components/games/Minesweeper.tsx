"use client";

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { buzz, useKeys, useRecord } from "./input";

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

const LONG_PRESS_MS = 400;
const MOVE_CANCEL_PX = 14;

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
  // 开局时的最快纪录，赢了以后和这局用时比，判断是不是新纪录
  const [bestAtStart, setBestAtStart] = useState<number | null>(null);
  const [focus, setFocus] = useState(0);
  const [best, submitBest] = useRecord(`minesweeper-${game.level.key}`, (next, prev) => next < prev);
  const press = useRef<{ timer: number; fired: boolean; touch: boolean; x: number; y: number; i: number } | null>(null);
  const [holding, setHolding] = useState<number | null>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { level, cells, phase } = game;
  const flags = cells.filter((c) => c.flag).length;
  const safeTotal = level.w * level.h - level.mines;
  const safeOpen = cells.filter((c) => c.open && !c.mine).length;
  const safeProgress = safeTotal === 0 ? 100 : Math.round((safeOpen / safeTotal) * 100);
  const safeLeft = safeTotal - safeOpen;
  const lateClear = phase === "playing" && safeLeft > 0 && safeLeft <= Math.max(5, Math.ceil(safeTotal * 0.12));
  const seconds = Math.floor(
    phase === "playing" ? Math.max(0, now - game.startedAt) / 1000 : phase === "ready" ? 0 : (game.endedAt - game.startedAt) / 1000,
  );

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    cellRefs.current[focus]?.focus();
  }, [focus, level.key]);

  const onEnd = useEffectEvent(() => {
    if (phase === "won") submitBest(seconds);
    if (phase === "lost") buzz([60, 40, 120]);
  });
  useEffect(() => {
    onEnd();
  }, [phase]);

  const restart = (next = level) => {
    setGame(newGame(next));
    setFocus(0);
  };
  const record = phase === "won" && (bestAtStart === null || seconds < bestAtStart);

  const openAt = (i: number) => {
    if (i < 0) return;
    if (phase === "ready" && !flagMode) setBestAtStart(best);
    setGame((g) => (flagMode && !g.cells[i].open ? toggleFlag(g, i) : reveal(g, i)));
    setFocus(i);
  };

  /** 中键 / 双击 / 点已翻数字：旗数对齐时翻周围（chord） */
  const chordAt = (i: number) => {
    if (i < 0 || phase === "won" || phase === "lost") return;
    const c = cells[i];
    if (!c?.open || !c.adj) return;
    openAt(i);
  };

  const onClick = (e: MouseEvent) => {
    const i = cellIndex(e);
    if (i < 0) return;
    if (press.current?.fired) {
      press.current = null;
      return;
    }
    openAt(i);
  };

  const onAuxClick = (e: MouseEvent) => {
    // 中键 chord，避免浏览器默认自动滚动
    if (e.button !== 1) return;
    e.preventDefault();
    const i = cellIndex(e);
    chordAt(i);
  };

  const onDoubleClick = (e: MouseEvent) => {
    const i = cellIndex(e);
    chordAt(i);
  };

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    // 手机上长按也会触发 contextmenu，交给长按计时器处理
    if (press.current?.touch) return;
    const i = cellIndex(e);
    if (i >= 0) {
      setGame((g) => toggleFlag(g, i));
      setFocus(i);
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    const i = cellIndex(e);
    if (e.pointerType === "mouse") {
      press.current = null;
      setHolding(null);
      return;
    }
    if (i < 0) return;
    const timer = window.setTimeout(() => {
      const cur = press.current;
      if (!cur || cur.i !== i) return;
      cur.fired = true;
      buzz(18);
      setGame((g) => toggleFlag(g, i));
      setFocus(i);
      setHolding(null);
    }, LONG_PRESS_MS);
    press.current = { timer, fired: false, touch: true, x: e.clientX, y: e.clientY, i };
    setHolding(i);
  };

  const onPointerMove = (e: PointerEvent) => {
    const cur = press.current;
    if (!cur || cur.fired) return;
    const dx = e.clientX - cur.x;
    const dy = e.clientY - cur.y;
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
      clearTimeout(cur.timer);
      press.current = null;
      setHolding(null);
    }
  };

  const endPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    if (press.current && !press.current.fired) press.current = null;
    setHolding(null);
  };

  useKeys((key) => {
    const { w, h } = level;
    const n = w * h;
    if (key === "ArrowRight") {
      setFocus((f) => (f % w === w - 1 ? f - (w - 1) : f + 1));
      return true;
    }
    if (key === "ArrowLeft") {
      setFocus((f) => (f % w === 0 ? f + (w - 1) : f - 1));
      return true;
    }
    if (key === "ArrowDown") {
      setFocus((f) => (f + w) % n);
      return true;
    }
    if (key === "ArrowUp") {
      setFocus((f) => (f - w + n) % n);
      return true;
    }
    if (key === "Enter") {
      openAt(focus);
      return true;
    }
    if (key === " " || key.toLowerCase() === "f") {
      setGame((g) => toggleFlag(g, focus));
      buzz(12);
      return true;
    }
    if (key.toLowerCase() === "r") {
      restart();
      return true;
    }
    return false;
  });

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
        <span
          className="mine-remaining"
          data-low={phase === "playing" && level.mines - flags <= 3 && level.mines - flags > 0 ? true : undefined}
          title="剩余雷数 = 本局雷数 − 已插旗"
        >
          剩余雷<b>{level.mines - flags}</b>
        </span>
        <span
          className="mine-progress"
          data-late={lateClear || undefined}
          title="安全格开图进度（不含雷）"
        >
          开图<b>{safeProgress}%</b>
          <small>
            {safeOpen}/{safeTotal}
          </small>
        </span>
        <span>
          时间<b>{seconds}</b>
        </span>
        <span>
          最快<b>{best ?? "—"}</b>
        </span>
      </div>
      <div
        className="mines"
        style={{ "--w": level.w } as CSSProperties}
        onClick={onClick}
        onAuxClick={onAuxClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onPointerLeave={endPress}
        role="grid"
        aria-label={`扫雷 ${level.label}`}
      >
        {cells.map((c, i) => (
          <button
            key={i}
            type="button"
            ref={(el) => {
              cellRefs.current[i] = el;
            }}
            data-i={i}
            className="mine-cell"
            tabIndex={focus === i ? 0 : -1}
            data-open={c.open || undefined}
            data-flag={(!c.open && c.flag) || undefined}
            data-boom={i === game.exploded || undefined}
            data-n={c.open && !c.mine ? c.adj : undefined}
            data-focus={focus === i || undefined}
            data-holding={holding === i || undefined}
            aria-label={`第 ${Math.floor(i / level.w) + 1} 行第 ${(i % level.w) + 1} 列${c.flag ? "，已插旗" : c.open ? `，${c.mine ? "雷" : c.adj}` : ""}`}
            onFocus={() => setFocus(i)}
          >
            {cellLabel(c, phase === "lost")}
          </button>
        ))}
      </div>
      {(phase === "ready" || phase === "playing") && (
        <p className={lateClear ? "game-tip game-tip--alert" : "game-tip"} aria-live="polite">
          {phase === "ready"
            ? "首击安全区：第一下落点及其周围不会埋雷，可放心开图。"
            : lateClear
              ? `收官：还剩 ${safeLeft} 格安全区未开 · 开图 ${safeProgress}% · 剩余雷标记 ${level.mines - flags}`
              : safeOpen === 0
                ? `首击安全区已生效 · 开图 0%（安全格 0/${safeTotal}）· 旗 ${flags}/${level.mines}`
                : `开图 ${safeProgress}%（安全格 ${safeOpen}/${safeTotal}）· 旗 ${flags}/${level.mines}`}
        </p>
      )}
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
          ? `全部排完，用时 ${seconds} 秒${record ? "，新纪录！" : ""}`
          : phase === "lost"
            ? "踩雷了。点“重新开始”或按 R 再来一局。"
            : (
              <>
                <span className="when-mouse">
                  {lateClear
                    ? `开图 ${safeProgress}%，还剩 ${safeLeft} 格。中键或双击已翻数字 chord（旗数对齐）收官更快。`
                    : phase === "playing" && level.mines - flags <= 3 && level.mines - flags > 0
                      ? `还剩 ${level.mines - flags} 颗雷。中键或双击已翻数字可快速翻周围（旗数要对齐）。`
                      : best !== null
                        ? `${level.label}最快 ${best} 秒。点/中键/双击已翻数字可 chord；回车翻开，空格或 F 插旗。`
                        : "点已翻数字、中键或双击可 chord（旗数=数字）。回车翻开，空格/F 插旗。第一下安全区。"}
                </span>
                <span className="when-touch">
                  {lateClear
                    ? `开图 ${safeProgress}%，还剩 ${safeLeft} 格。点已翻数字（旗数对齐）chord 收官。`
                    : phase === "playing" && level.mines - flags <= 3 && level.mines - flags > 0
                      ? `还剩 ${level.mines - flags} 颗雷。点已翻开的数字（旗数对齐）可一次翻周围。`
                      : `${best !== null ? `${level.label}最快 ${best} 秒。` : ""}轻点翻开，长按插旗；点已翻数字可 chord。第一下安全区。`}
                </span>
              </>
            )}
      </p>
    </div>
  );
}
