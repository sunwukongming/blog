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

/** chord-ready: open number, flags match, has closed unflagged neighbor */
function chordReadyIndices(cells: Cell[], level: Level): number[] {
  const ready: number[] = [];
  cells.forEach((c, i) => {
    if (!c.open || !c.adj) return;
    const around = neighbors(i, level);
    if (around.filter((j) => cells[j].flag).length !== c.adj) return;
    if (around.some((j) => !cells[j].open && !cells[j].flag)) ready.push(i);
  });
  return ready;
}

/** how many closed unflagged neighbors would flip if all chord-ready cells chorded (unique) */
function chordOpenableCount(cells: Cell[], level: Level): number {
  const ready = chordReadyIndices(cells, level);
  const set = new Set<number>();
  for (const i of ready) {
    for (const j of neighbors(i, level)) {
      const c = cells[j];
      if (!c.open && !c.flag) set.add(j);
    }
  }
  return set.size;
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
  const [peakMeta, setPeakMeta] = useState({ key: LEVELS[0].key, n: 0 });
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
  const chordReady = phase === "playing" ? chordReadyIndices(cells, level).length : 0;
  const chordOpenable = phase === "playing" ? chordOpenableCount(cells, level) : 0;
  const flagDense =
    phase === "playing" &&
    safeProgress > 20 &&
    safeProgress < 75 &&
    flags >= Math.max(2, Math.ceil(level.mines * 0.45));
  const seconds = Math.floor(
    phase === "playing" ? Math.max(0, now - game.startedAt) / 1000 : phase === "ready" ? 0 : (game.endedAt - game.startedAt) / 1000,
  );

  if (phase === "ready" || peakMeta.key !== level.key) {
    if (peakMeta.n !== 0 || peakMeta.key !== level.key) {
      setPeakMeta({ key: level.key, n: 0 });
    }
  } else if (phase === "playing" && chordOpenable > peakMeta.n) {
    setPeakMeta({ key: level.key, n: chordOpenable });
  }
  const peakOpenable =
    phase === "ready" || peakMeta.key !== level.key ? 0 : Math.max(peakMeta.n, chordOpenable);

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
          data-low={phase === "playing" && level.mines - flags <= 5 && level.mines - flags > 0 ? true : undefined}
          title="剩余雷数 = 本局雷数 − 已插旗；≤5 时高亮提醒收官"
        >
          剩余雷
          <b className={phase === "playing" && level.mines - flags <= 3 && level.mines - flags > 0 ? "game-tip--alert" : undefined}>
            {level.mines - flags}
          </b>
          {phase === "playing" && level.mines - flags <= 3 && level.mines - flags > 0 ? (
            <small style={{ marginLeft: 4, opacity: 0.85 }}>收官</small>
          ) : null}
          <span
            className="mine-remaining-bar"
            data-low={phase === "playing" && level.mines - flags <= 5 && level.mines - flags > 0 || undefined}
            data-clear={phase === "playing" && level.mines - flags <= 0 || undefined}
            title={`剩余雷 ${Math.max(0, level.mines - flags)} / ${level.mines}（旗 ${flags}）`}
            aria-label={`剩余雷 ${Math.max(0, level.mines - flags)}`}
          >
            <i
              className="mine-remaining-bar__fill"
              style={{
                width: `${Math.min(100, Math.round((Math.max(0, level.mines - flags) / Math.max(1, level.mines)) * 100))}%`,
              }}
            />
          </span>
          <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
          旗<b>{flags}</b>
          <span
            className="mine-flags-bar"
            data-over={flags > level.mines || undefined}
            data-match={flags === level.mines || undefined}
            title={`已插旗 ${flags} / 雷 ${level.mines}`}
            aria-label={`已插旗 ${flags}`}
          >
            <i
              className="mine-flags-bar__fill"
              style={{
                width: `${Math.min(100, Math.round((flags / Math.max(1, level.mines)) * 100))}%`,
              }}
            />
          </span>
        </span>
        <span
          className="mine-progress mine-open-flag mine-chord-open mine-chord-openable mine-late-openable mine-chord-peak-host"
          data-late={lateClear || undefined}
          data-dense={flagDense || undefined}
          data-ready={chordReady > 0 || undefined}
          data-late-open={lateClear && chordOpenable > 0 ? true : undefined}
          data-seg={
            safeProgress <= 0
              ? "zero"
              : safeProgress <= 20
                ? "early"
                : safeProgress < 75
                  ? "mid"
                  : lateClear
                    ? "late"
                    : "high"
          }
          title={`Chord|开图：开图 ${safeProgress}%（${safeOpen}/${safeTotal}）· Chord×${chordReady}${chordReady > 0 ? ` 可点 · 可翻${chordOpenable}` : ""}${peakOpenable > 0 ? ` · 可翻峰${peakOpenable}` : ""}${lateClear && chordOpenable > 0 ? " · 收官可翻" : ""} · 旗 ${flags}/${level.mines}${flagDense ? " · 旗密" : ""}`}
        >
          开图<b>{safeProgress}%</b>
          <small>
            {safeOpen}/{safeTotal}
          </small>
          <span
            className="mine-open-bar"
            data-late={lateClear || undefined}
            data-seg={
              safeProgress <= 0
                ? "zero"
                : safeProgress <= 20
                  ? "early"
                  : safeProgress < 75
                    ? "mid"
                    : lateClear
                      ? "late"
                      : "high"
            }
            title={`开图进度 ${safeProgress}%（${safeOpen}/${safeTotal}）`}
            aria-label={`开图进度 ${safeProgress} percent`}
          >
            <i
              className="mine-open-bar__fill"
              style={{ width: `${Math.min(100, Math.max(0, safeProgress))}%` }}
            />
          </span>
          <small className="mine-progress__seg" style={{ marginLeft: 6 }}>
            {safeProgress <= 0
              ? "未开"
              : safeProgress <= 20
                ? "前段"
                : safeProgress < 75
                  ? "中段"
                  : lateClear
                    ? "收官"
                    : "后段"}
          </small>
          <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
          旗密
          <b className={flagDense ? "game-tip--alert" : undefined}>
            {flags}/{level.mines}
          </b>
          {flagDense ? <small style={{ marginLeft: 4, opacity: 0.85 }}>密</small> : null}
          <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
          <span className="mine-chord" data-ready={chordReady > 0 || undefined} data-openable={chordOpenable > 0 || undefined}>
            Chord<b className={chordReady > 0 ? "game-tip--alert" : undefined}>{chordReady}</b>
            {chordOpenable > 0 || peakOpenable > 0 ? (
              <small style={{ marginLeft: 4, opacity: 0.85 }} data-late-open={lateClear || undefined} data-peak={peakOpenable > 0 || undefined}>
                {chordOpenable > 0 ? (lateClear ? "收官可翻" : "可翻") : "可翻峰"}
                {chordOpenable > 0 ? <b className="game-tip--alert">{chordOpenable}</b> : null}
                {peakOpenable > 0 ? (
                  <small className="mine-chord-peak" style={{ marginLeft: 4, opacity: 0.75 }} title={`本局 Chord 可翻峰值 ${peakOpenable}`}>
                    峰<b>{peakOpenable}</b>
                  </small>
                ) : null}
                {peakOpenable > 0 ? (
                  <span
                    className="mine-chord-peak-bar"
                    data-peak={chordOpenable >= peakOpenable && chordOpenable > 0 || undefined}
                    data-late={lateClear || undefined}
                    title={`可翻相对峰值 ${chordOpenable}/${peakOpenable}`}
                    aria-label={`可翻相对峰值 ${chordOpenable}/${peakOpenable}`}
                  >
                    <i
                      className="mine-chord-peak-bar__fill"
                      style={{
                        width: `${Math.min(100, Math.round((chordOpenable / Math.max(1, peakOpenable)) * 100))}%`,
                      }}
                    />
                  </span>
                ) : null}
              </small>
            ) : null}
          </span>
        </span>
        <span
          className="mine-timer mine-timer-best-host"
          data-seg={
            seconds < 30 ? "early" : seconds < 60 ? "mid" : seconds < 120 ? "late" : "over"
          }
          title={
            best != null
              ? `用时 ${seconds}s · 最快 ${best}s · 段 ${seconds < 30 ? "前段(<30s)" : seconds < 60 ? "中段(30–60s)" : seconds < 120 ? "后段(1–2min)" : "超时(≥2min)"}${phase === "playing" && best > 0 ? ` · 进度约 ${Math.min(100, Math.round((seconds / best) * 100))}%` : ""}`
              : `用时 ${seconds}s · 段 ${seconds < 30 ? "前段" : seconds < 60 ? "中段" : seconds < 120 ? "后段" : "超时"}`
          }
        >
          时间<b className={seconds >= 60 ? "game-tip--alert" : undefined}>{seconds}</b>
          <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
          <small className="mine-timer__seg">
            {seconds < 30 ? "前段" : seconds < 60 ? "中段" : seconds < 120 ? "后段" : "超时"}
          </small>
          {best != null && phase === "playing" && best > 0 ? (
            <>
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              <small title="相对本档最快">
                {seconds <= best ? "未破线" : "已慢于最快"}
              </small>
              <span
                className="mine-timer-best-bar"
                data-over={seconds > best || undefined}
                data-near={seconds > best * 0.8 && seconds <= best || undefined}
                title={`用时 ${seconds}s / 最快 ${best}s（${Math.min(999, Math.round((seconds / best) * 100))}%）`}
                aria-label={`用时相对最快 ${Math.min(999, Math.round((seconds / best) * 100))} percent`}
              >
                <i
                  className="mine-timer-best-bar__fill"
                  style={{ width: `${Math.min(100, Math.round((seconds / best) * 100))}%` }}
                />
              </span>
            </>
          ) : null}
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
        <p className={chordReady > 0 || lateClear || flagDense || (phase === "playing" && level.mines - flags <= 3 && level.mines - flags > 0) || (phase === "playing" && safeOpen > 0 && safeProgress <= 20) ? "game-tip game-tip--alert" : "game-tip"} aria-live="polite">
          {phase === "ready"
            ? "首击安全区：第一下落点及其周围不会埋雷，可放心开图。"
            : chordReady > 0
              ? `Chord|开图同条：Chord×${chordReady} 可点 · 可翻 ${chordOpenable}${peakOpenable > 0 ? `（峰${peakOpenable}）` : ""} · 开图 ${safeProgress}% · 旗 ${flags}/${level.mines} · 中键/双击翻周围`
              : lateClear
                ? `收官可翻：还剩 ${safeLeft} 格 · 可翻 ${chordOpenable} · Chord×${chordReady} · 开图 ${safeProgress}% · 旗位对齐后 chord`
                : phase === "playing" && level.mines - flags <= 3 && level.mines - flags > 0
                  ? `剩余雷仅 ${level.mines - flags} · 开图 ${safeProgress}% · 旗位对齐后再 chord`
                  : flagDense
                  ? `开图/旗密同条：开图 ${safeProgress}% · 旗 ${flags}/${level.mines}（密）· 核对数字再 chord，忌盲插`
                : phase === "playing" && safeOpen > 0 && safeProgress <= 20
                    ? `首击后：安全区已展开 · 开图 ${safeProgress}%（${safeOpen}/${safeTotal}）· 先清边再标旗，旗数=数字可 chord`
                    : safeOpen === 0
                      ? `首击安全区已生效 · 开图 0% · 旗 ${flags}/${level.mines} · 计时${seconds}s（${seconds < 30 ? "前段" : seconds < 60 ? "中段" : seconds < 120 ? "后段" : "超时"}）`
                      : `开图 ${safeProgress}%（${safeOpen}/${safeTotal}）· 旗 ${flags}/${level.mines} · 计时${seconds}s/${seconds < 30 ? "前段" : seconds < 60 ? "中段" : seconds < 120 ? "后段" : "超时"}${best != null ? ` · 最快 ${best}s` : ""} · 旗数=数字时可 chord`}
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
