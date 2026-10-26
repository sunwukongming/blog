"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { useT } from "@/components/i18n/LangProvider";
import { buzz, useKeys, useRecord } from "./input";
import { MINESWEEPER_MESSAGES, type MineHud, type OpenSeg, type TimeSeg } from "./Minesweeper.messages";

type Level = { key: string; name: "easy" | "medium"; w: number; h: number; mines: number };
type Cell = { mine: boolean; adj: number; open: boolean; flag: boolean };
type Phase = "ready" | "playing" | "won" | "lost";
type Game = { level: Level; cells: Cell[]; phase: Phase; startedAt: number; endedAt: number; exploded: number };

// 手机竖屏上 16×16 的格子太小点不准，中级换成 10×16，雷的密度不变
const narrow = window.matchMedia("(max-width: 600px)").matches;
const LEVELS: Level[] = [
  { key: "easy", name: "easy", w: 9, h: 9, mines: 10 },
  narrow
    ? { key: "medium-tall", name: "medium", w: 10, h: 16, mines: 25 }
    : { key: "medium", name: "medium", w: 16, h: 16, mines: 40 },
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
  const t = useT(MINESWEEPER_MESSAGES);
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
    phase === "playing"
      ? Math.max(0, now - game.startedAt) / 1000
      : phase === "ready"
        ? 0
        : (game.endedAt - game.startedAt) / 1000,
  );

  if (phase === "ready" || peakMeta.key !== level.key) {
    if (peakMeta.n !== 0 || peakMeta.key !== level.key) {
      setPeakMeta({ key: level.key, n: 0 });
    }
  } else if (phase === "playing" && chordOpenable > peakMeta.n) {
    setPeakMeta({ key: level.key, n: chordOpenable });
  }
  const peakOpenable = phase === "ready" || peakMeta.key !== level.key ? 0 : Math.max(peakMeta.n, chordOpenable);
  const levelName = t.levels[level.name];
  const timeSeg: TimeSeg = seconds < 30 ? "early" : seconds < 60 ? "mid" : seconds < 120 ? "late" : "over";
  const openSeg: OpenSeg =
    safeProgress <= 0 ? "zero" : safeProgress <= 20 ? "early" : safeProgress < 75 ? "mid" : lateClear ? "late" : "high";
  const hud: MineHud = {
    safeProgress,
    safeOpen,
    safeTotal,
    safeLeft,
    chordReady,
    chordOpenable,
    peakOpenable,
    lateClear,
    flags,
    mines: level.mines,
    flagDense,
    seconds,
    best,
  };

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
            {t.levels[l.name]}
          </button>
        ))}
        <span className="spacer" />
        <span
          className="mine-remaining"
          data-low={phase === "playing" && level.mines - flags <= 5 && level.mines - flags > 0 ? true : undefined}
          title={t.minesLeftTitle}
        >
          {t.minesLeft}
          <b
            className={
              phase === "playing" && level.mines - flags <= 3 && level.mines - flags > 0 ? "game-tip--alert" : undefined
            }
          >
            {level.mines - flags}
          </b>
          {phase === "playing" && level.mines - flags <= 3 && level.mines - flags > 0 ? (
            <small style={{ marginLeft: 4, opacity: 0.85 }}>{t.endgame}</small>
          ) : null}
          <span
            className="mine-remaining-bar"
            data-low={(phase === "playing" && level.mines - flags <= 5 && level.mines - flags > 0) || undefined}
            data-clear={(phase === "playing" && level.mines - flags <= 0) || undefined}
            title={t.minesLeftBarTitle(Math.max(0, level.mines - flags), level.mines, flags)}
            aria-label={t.minesLeftAria(Math.max(0, level.mines - flags))}
          >
            <i
              className="mine-remaining-bar__fill"
              style={{
                width: `${Math.min(100, Math.round((Math.max(0, level.mines - flags) / Math.max(1, level.mines)) * 100))}%`,
              }}
            />
          </span>
          <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
          {t.flag}
          <b>{flags}</b>
          <span
            className="mine-flags-bar"
            data-over={flags > level.mines || undefined}
            data-match={flags === level.mines || undefined}
            title={t.flagsBarTitle(flags, level.mines)}
            aria-label={t.flagsAria(flags)}
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
          title={t.progressTitle(hud)}
        >
          {t.opened}
          <b>{safeProgress}%</b>
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
            title={t.openBarTitle(safeProgress, safeOpen, safeTotal)}
            aria-label={t.openBarAria(safeProgress)}
          >
            <i className="mine-open-bar__fill" style={{ width: `${Math.min(100, Math.max(0, safeProgress))}%` }} />
          </span>
          <small className="mine-progress__seg" style={{ marginLeft: 6 }}>
            {t.openSeg[openSeg]}
          </small>
          <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
          {t.flagDensity}
          <b className={flagDense ? "game-tip--alert" : undefined}>
            {flags}/{level.mines}
          </b>
          {flagDense ? <small style={{ marginLeft: 4, opacity: 0.85 }}>{t.dense}</small> : null}
          <span
            className="mine-density-bar"
            data-dense={flagDense || undefined}
            data-over={flags > level.mines || undefined}
            title={t.densityTitle(flags, level.mines)}
            aria-label={t.flagsOfAria(flags, level.mines)}
          >
            <i
              className="mine-density-bar__fill"
              style={{
                width: `${Math.min(100, Math.round((flags / Math.max(1, level.mines)) * 100))}%`,
              }}
            />
          </span>
          <span
            className="mine-pace-bar"
            data-fast={(seconds > 0 && safeOpen / seconds >= 1.5) || undefined}
            data-slow={(seconds >= 30 && safeOpen / Math.max(1, seconds) < 0.4) || undefined}
            title={seconds > 0 ? t.paceTitle(Math.round((safeOpen / seconds) * 100) / 100) : t.paceTitleNone}
            aria-label={seconds > 0 ? t.paceAria(Math.round((safeOpen / seconds) * 100) / 100) : t.paceAriaNone}
          >
            <i
              className="mine-pace-bar__fill"
              style={{
                width: `${seconds > 0 ? Math.min(100, Math.round((safeOpen / seconds / 2) * 100)) : 0}%`,
              }}
            />
          </span>
          <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
          <span
            className="mine-safe-left-bar"
            data-late={lateClear || undefined}
            data-urgent={(safeLeft > 0 && safeLeft <= 8) || undefined}
            title={t.safeLeftTitle(safeLeft, safeTotal)}
            aria-label={t.safeLeftAria(safeLeft)}
          >
            <small style={{ opacity: 0.75 }}>
              {t.safeLeftShort}
              <b>{safeLeft}</b>
            </small>
            <span className="mine-safe-left-bar__track">
              <i
                className="mine-safe-left-bar__fill"
                style={{
                  width: `${Math.min(100, Math.round((safeLeft / Math.max(1, safeTotal)) * 100))}%`,
                }}
              />
            </span>
          </span>
          <span
            className="mine-chord"
            data-ready={chordReady > 0 || undefined}
            data-openable={chordOpenable > 0 || undefined}
          >
            Chord<b className={chordReady > 0 ? "game-tip--alert" : undefined}>{chordReady}</b>
            <span
              className="mine-chord-ready-bar"
              data-ready={chordReady > 0 || undefined}
              data-many={chordReady >= 3 || undefined}
              title={t.chordReadyTitle(chordReady)}
              aria-label={t.chordReadyAria(chordReady)}
            >
              <i
                className="mine-chord-ready-bar__fill"
                style={{
                  width: `${Math.min(100, Math.round((chordReady / 5) * 100))}%`,
                }}
              />
            </span>
            {chordOpenable > 0 || peakOpenable > 0 ? (
              <small
                style={{ marginLeft: 4, opacity: 0.85 }}
                data-late-open={lateClear || undefined}
                data-peak={peakOpenable > 0 || undefined}
              >
                {chordOpenable > 0 ? (lateClear ? t.lateOpenable : t.openable) : t.openablePeak}
                {chordOpenable > 0 ? <b className="game-tip--alert">{chordOpenable}</b> : null}
                {peakOpenable > 0 ? (
                  <small
                    className="mine-chord-peak"
                    style={{ marginLeft: 4, opacity: 0.75 }}
                    title={t.chordPeakTitle(peakOpenable)}
                  >
                    {t.peak}
                    <b>{peakOpenable}</b>
                  </small>
                ) : null}
                {peakOpenable > 0 ? (
                  <span
                    className="mine-chord-peak-bar"
                    data-peak={(chordOpenable >= peakOpenable && chordOpenable > 0) || undefined}
                    data-late={lateClear || undefined}
                    title={t.peakBar(chordOpenable, peakOpenable)}
                    aria-label={t.peakBar(chordOpenable, peakOpenable)}
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
          data-seg={seconds < 30 ? "early" : seconds < 60 ? "mid" : seconds < 120 ? "late" : "over"}
          title={
            best != null
              ? t.timerTitle(
                  seconds,
                  best,
                  t.timeSegLong[timeSeg],
                  phase === "playing" && best > 0 ? Math.min(100, Math.round((seconds / best) * 100)) : null,
                )
              : t.timerTitleNoBest(seconds, t.timeSeg[timeSeg])
          }
        >
          {t.time}
          <b className={seconds >= 60 ? "game-tip--alert" : undefined}>{seconds}</b>
          <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
          <small className="mine-timer__seg">{t.timeSeg[timeSeg]}</small>
          <span
            className="mine-timer-seg-bar"
            data-seg={seconds < 30 ? "early" : seconds < 60 ? "mid" : seconds < 120 ? "late" : "over"}
            title={t.segBarTitle(seconds < 120 ? seconds % 30 : Math.min(30, seconds - 120), t.timeSeg[timeSeg])}
            aria-label={t.segBarAria}
          >
            <i
              className="mine-timer-seg-bar__fill"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(((seconds < 120 ? seconds % 30 : Math.min(30, seconds - 120)) / 30) * 100),
                )}%`,
              }}
            />
          </span>
          <span
            className="mine-openable-now-bar"
            data-ready={chordOpenable > 0 || undefined}
            data-many={chordOpenable >= 5 || undefined}
            title={t.openableNowTitle(chordOpenable)}
            aria-label={t.openableNowAria(chordOpenable)}
          >
            <i
              className="mine-openable-now-bar__fill"
              style={{
                width: `${Math.min(100, Math.round((chordOpenable / 8) * 100))}%`,
              }}
            />
          </span>
          <span
            className="mine-flag-slack-bar"
            data-over={flags > level.mines || undefined}
            data-tight={(flags >= level.mines && flags > 0) || undefined}
            title={t.slackTitle(Math.max(0, level.mines - flags), level.mines, flags)}
            aria-label={t.slackAria(Math.max(0, level.mines - flags))}
          >
            <i
              className="mine-flag-slack-bar__fill"
              style={{
                width: `${
                  level.mines > 0
                    ? Math.min(100, Math.round((Math.max(0, level.mines - flags) / level.mines) * 100))
                    : 0
                }%`,
              }}
            />
          </span>
          <span
            className="mine-open-pace-bar"
            data-hot={(seconds > 0 && safeOpen / seconds >= 2) || undefined}
            data-slow={(seconds >= 30 && safeOpen / Math.max(1, seconds) < 0.4) || undefined}
            title={seconds > 0 ? t.openPaceTitle(Math.round((safeOpen / seconds) * 10) / 10) : t.paceTitleNone}
            aria-label={seconds > 0 ? t.openPaceAria(Math.round((safeOpen / seconds) * 10) / 10) : t.paceAriaNone}
          >
            <i
              className="mine-open-pace-bar__fill"
              style={{
                width: `${seconds > 0 ? Math.min(100, Math.round((safeOpen / seconds / 3) * 100)) : 0}%`,
              }}
            />
          </span>
          <span
            className="mine-flag-ratio-bar"
            data-over={flags > level.mines || undefined}
            data-low={(level.mines > 0 && flags / level.mines < 0.3 && safeOpen > 0) || undefined}
            title={t.flagRatioTitle(flags, level.mines)}
            aria-label={t.flagsOfAria(flags, level.mines)}
          >
            <i
              className="mine-flag-ratio-bar__fill"
              style={{
                width: `${level.mines > 0 ? Math.min(100, Math.round((flags / level.mines) * 100)) : 0}%`,
              }}
            />
          </span>
          <span
            className="mine-flag-pace-bar"
            data-hot={(seconds > 0 && flags / seconds >= 0.35) || undefined}
            data-slow={(seconds >= 25 && flags / Math.max(1, seconds) < 0.08) || undefined}
            title={seconds > 0 ? t.flagPaceTitle(Math.round((flags / seconds) * 100) / 100) : t.flagPaceTitleNone}
            aria-label={seconds > 0 ? t.flagPaceAria(Math.round((flags / seconds) * 100) / 100) : t.flagPaceAriaNone}
          >
            <i
              className="mine-flag-pace-bar__fill"
              style={{
                width: `${seconds > 0 ? Math.min(100, Math.round((flags / seconds / 0.5) * 100)) : 0}%`,
              }}
            />
          </span>
          <span
            className="mine-touch-ratio-bar"
            data-hot={(safeOpen + flags) / Math.max(1, cells.length) >= 0.7 || undefined}
            data-cold={
              (phase === "playing" && seconds >= 20 && (safeOpen + flags) / Math.max(1, cells.length) < 0.15) ||
              undefined
            }
            title={t.touchTitle(safeOpen + flags, cells.length)}
            aria-label={t.touchAria(safeOpen + flags, cells.length)}
          >
            <i
              className="mine-touch-ratio-bar__fill"
              style={{
                width: `${Math.min(100, Math.round(((safeOpen + flags) / Math.max(1, cells.length)) * 100))}%`,
              }}
            />
          </span>
          <span
            className="mine-safe-pace-bar"
            data-hot={(seconds > 0 && safeOpen / seconds >= 0.3) || undefined}
            data-slow={(seconds >= 25 && safeOpen / Math.max(1, seconds) < 0.08) || undefined}
            title={seconds > 0 ? t.safePaceTitle(Math.round((safeOpen / seconds) * 100) / 100) : t.safePaceTitleNone}
            aria-label={seconds > 0 ? t.safePaceAria(Math.round((safeOpen / seconds) * 100) / 100) : t.safePaceAriaNone}
          >
            <i
              className="mine-safe-pace-bar__fill"
              style={{
                width: `${seconds > 0 ? Math.min(100, Math.round((safeOpen / seconds / 0.4) * 100)) : 0}%`,
              }}
            />
          </span>
          <span
            className="mine-clear-ratio-bar"
            data-hot={(safeTotal > 0 && safeOpen / safeTotal >= 0.85) || undefined}
            data-low={(safeTotal > 0 && safeOpen / safeTotal <= 0.15 && seconds >= 20) || undefined}
            title={safeTotal > 0 ? t.clearRatioTitle(safeOpen, safeTotal) : t.clearRatioTitleNone}
            aria-label={t.clearRatioAria(safeOpen, safeTotal)}
          >
            <i
              className="mine-clear-ratio-bar__fill"
              style={{
                width: `${safeTotal > 0 ? Math.min(100, Math.round((safeOpen / safeTotal) * 100)) : 0}%`,
              }}
            />
          </span>
          <span
            className="mine-safe-remain-ratio-bar"
            data-low={(safeTotal > 0 && (safeTotal - safeOpen) / safeTotal <= 0.2) || undefined}
            data-high={(safeTotal > 0 && (safeTotal - safeOpen) / safeTotal >= 0.75 && seconds >= 15) || undefined}
            title={safeTotal > 0 ? t.remainRatioTitle(safeTotal - safeOpen, safeTotal) : t.remainRatioTitleNone}
            aria-label={t.remainRatioAria(safeTotal - safeOpen, safeTotal)}
          >
            <i
              className="mine-safe-remain-ratio-bar__fill"
              style={{
                width: `${safeTotal > 0 ? Math.min(100, Math.round(((safeTotal - safeOpen) / safeTotal) * 100)) : 0}%`,
              }}
            />
          </span>
          <span
            className="mine-best-gap-bar"
            data-lead={(best != null && best > 0 && seconds > 0 && seconds <= best) || undefined}
            data-lag={(best != null && best > 0 && seconds > best * 1.25) || undefined}
            title={
              best != null && best > 0
                ? seconds > 0
                  ? t.bestGapTitle(Math.round((best / Math.max(seconds, 0.01)) * 100), best)
                  : t.pb(best)
                : t.bestGapTitleNone
            }
            aria-label={
              best != null && best > 0 && seconds > 0
                ? t.bestGapAria(Math.round((best / Math.max(seconds, 0.01)) * 100))
                : t.bestGapAriaNone
            }
          >
            <i
              className="mine-best-gap-bar__fill"
              style={{
                width: `${
                  best != null && best > 0 && seconds > 0
                    ? Math.min(100, Math.round((best / Math.max(seconds, 0.01)) * 100))
                    : 0
                }%`,
              }}
            />
          </span>
          {best != null && phase === "playing" && best > 0 ? (
            <>
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              <small title={t.vsBestTitle}>{seconds <= best ? t.underBest : t.overBest}</small>
              <span
                className="mine-timer-best-bar"
                data-over={seconds > best || undefined}
                data-near={(seconds > best * 0.8 && seconds <= best) || undefined}
                title={t.timerBestTitle(seconds, best, Math.min(999, Math.round((seconds / best) * 100)))}
                aria-label={t.timerBestAria(Math.min(999, Math.round((seconds / best) * 100)))}
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
          {t.best}
          <b>{best ?? "—"}</b>
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
        aria-label={t.gridAria(levelName)}
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
            aria-label={t.cellAria(
              Math.floor(i / level.w) + 1,
              (i % level.w) + 1,
              c.flag ? "flag" : c.open ? (c.mine ? "mine" : c.adj) : null,
            )}
            onFocus={() => setFocus(i)}
          >
            {cellLabel(c, phase === "lost")}
          </button>
        ))}
      </div>
      {(phase === "ready" || phase === "playing") && (
        <p
          className={
            chordReady > 0 ||
            lateClear ||
            flagDense ||
            (phase === "playing" && level.mines - flags <= 3 && level.mines - flags > 0) ||
            (phase === "playing" && safeOpen > 0 && safeProgress <= 20)
              ? "game-tip game-tip--alert"
              : "game-tip"
          }
          aria-live="polite"
        >
          {phase === "ready"
            ? t.tipReady
            : chordReady > 0
              ? t.tipChord(hud)
              : lateClear
                ? t.tipLate(hud)
                : phase === "playing" && level.mines - flags <= 3 && level.mines - flags > 0
                  ? t.tipFewMines(hud)
                  : flagDense
                    ? t.tipDense(hud)
                    : phase === "playing" && safeOpen > 0 && safeProgress <= 20
                      ? t.tipEarly(hud)
                      : safeOpen === 0
                        ? t.tipNoOpen(hud, t.timeSeg[timeSeg])
                        : t.tipNormal(hud, t.timeSeg[timeSeg])}
        </p>
      )}
      <div className="game-bar">
        <button type="button" className="game-btn" aria-pressed={flagMode} onClick={() => setFlagMode(!flagMode)}>
          <FlagIcon /> {t.flagMode}
        </button>
        <span className="spacer" />
        <button type="button" className="game-btn" onClick={() => restart()}>
          {t.restart}
        </button>
      </div>
      <p className="game-hint" aria-live="polite">
        {phase === "won" ? (
          t.won(seconds, record)
        ) : phase === "lost" ? (
          t.lost
        ) : (
          <>
            <span className="when-mouse">
              {lateClear
                ? t.mouseLate(hud)
                : phase === "playing" && level.mines - flags <= 3 && level.mines - flags > 0
                  ? t.mouseFewMines(level.mines - flags)
                  : best !== null
                    ? t.mouseBest(levelName, best)
                    : t.mouseDefault}
            </span>
            <span className="when-touch">
              {lateClear
                ? t.touchLate(hud)
                : phase === "playing" && level.mines - flags <= 3 && level.mines - flags > 0
                  ? t.touchFewMines(level.mines - flags)
                  : `${best !== null ? t.touchBest(levelName, best) : ""}${t.touchDefault}`}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
