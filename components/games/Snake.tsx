"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  buzz,
  higher,
  KEY_DIR,
  lower,
  saveRecord,
  useKeys,
  useRecord,
  useRecordList,
  useSwipe,
  type Dir,
} from "./input";
import { useLang, useT } from "@/components/i18n/LangProvider";
import LevelSelect from "./LevelSelect";
import { SNAKE_MESSAGES, type SpeedTier } from "./Snake.messages";
import { SNAKE_LEVELS } from "./snakeLevels";

const N = 20;
const FOOD = "#7af5ff";
const GOLD = "#ffd95e";
const GOLD_LIFE = 6; // 金色食物停留秒数

type P = { x: number; y: number };
type Mode = { kind: "level"; index: number } | { kind: "endless" };
type Phase = "select" | "ready" | "running" | "paused" | "over" | "clear";
type Game = {
  mode: Mode;
  walls: Set<number>;
  wrap: boolean;
  bonus: boolean;
  snake: P[];
  dir: Dir;
  queue: Dir[];
  food: P | null;
  gold: { p: P; until: number } | null;
  nextGold: number;
  eaten: number;
  score: number;
  time: number;
  /** 上一步之前的蛇尾，用来补间蛇尾的滑动 */
  prevTail: P;
  /** 食物出现的时间，用来做弹出动画 */
  foodAt: number;
  /** 吃到东西时的光环特效 */
  fx: { x: number; y: number; at: number; color: string }[];
};
type Hud = {
  eaten: number;
  score: number;
  seconds: number;
  len: number;
  wrap: boolean;
  edgeHint: EdgeHint | null;
  speedMs: number;
  speedTier: SpeedTier;
  nextSpeed: SpeedTier | null;
  goldLeft: number | null;
  goldEta: number | null;
};

const VEC: Record<Dir, P> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
const PAD: [Dir, string][] = [
  ["up", "↑"],
  ["left", "←"],
  ["down", "↓"],
  ["right", "→"],
];
const LEVEL_KEYS = SNAKE_LEVELS.map((_, i) => `snake-l${i + 1}`);

function newGame(mode: Mode): Game {
  const lv = mode.kind === "level" ? SNAKE_LEVELS[mode.index] : null;
  const walls = new Set<number>();
  let start = { x: 7, y: 10 };
  lv?.map.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === "#") walls.add(y * N + x);
      if (ch === "S") start = { x, y };
    }),
  );
  const g: Game = {
    mode,
    walls,
    wrap: !!lv?.wrap,
    bonus: lv ? !!lv.bonus : true,
    snake: [start, { x: start.x - 1, y: start.y }, { x: start.x - 2, y: start.y }],
    dir: "right",
    queue: [],
    food: null,
    gold: null,
    nextGold: 8 + Math.random() * 6,
    eaten: 0,
    score: 0,
    time: 0,
    prevTail: { x: start.x - 2, y: start.y },
    foodAt: -1,
    fx: [],
  };
  g.food = freeCell(g);
  return g;
}

/** 随机一个不是墙、不在蛇身上、也没有食物的格子 */
function freeCell(g: Game): P | null {
  const taken = new Set(g.walls);
  for (const p of g.snake) taken.add(p.y * N + p.x);
  for (const p of [g.food, g.gold?.p]) if (p) taken.add(p.y * N + p.x);
  const free: number[] = [];
  for (let i = 0; i < N * N; i++) if (!taken.has(i)) free.push(i);
  if (!free.length) return null;
  const i = free[Math.floor(Math.random() * free.length)];
  return { x: i % N, y: Math.floor(i / N) };
}

/** 穿墙提示：edge 是下一格就穿出，near 是靠近边缘，safe 是其余；文字在 SNAKE_MESSAGES 里 */
type EdgeHint = { tier: "edge" | "near" | "safe"; dir: Dir };

/** 穿墙关：贴边/近边时提示头会从对面出来 */
function wrapHint(g: Game): EdgeHint | null {
  if (!g.wrap) return null;
  const h = g.snake[0];
  const d = g.queue[0] ?? g.dir;
  if (
    (d === "left" && h.x === 0) ||
    (d === "right" && h.x === N - 1) ||
    (d === "up" && h.y === 0) ||
    (d === "down" && h.y === N - 1)
  ) {
    return { tier: "edge", dir: d };
  }
  if (
    (d === "left" && h.x <= 2) ||
    (d === "right" && h.x >= N - 3) ||
    (d === "up" && h.y <= 2) ||
    (d === "down" && h.y >= N - 3)
  ) {
    return { tier: "near", dir: d };
  }
  return { tier: "safe", dir: d };
}

const goalOf = (g: Game) => (g.mode.kind === "level" ? SNAKE_LEVELS[g.mode.index].goal : Infinity);

// 关卡模式每吃一个快 2ms；无尽模式沿用原来的节奏
const interval = (g: Game) =>
  g.mode.kind === "level"
    ? Math.max(60, SNAKE_LEVELS[g.mode.index].speed - g.eaten * 2)
    : Math.max(65, 150 - g.score * 3);

function speedTier(ms: number): SpeedTier {
  if (ms >= 140) return "slow";
  if (ms >= 110) return "mid";
  if (ms >= 85) return "fast";
  if (ms >= 70) return "faster";
  return "max";
}

/** 下一档速度；已是最快一档时为 null */
function nextSpeedTier(ms: number): SpeedTier | null {
  if (ms >= 140) return "mid";
  if (ms >= 110) return "fast";
  if (ms >= 85) return "faster";
  if (ms >= 70) return "max";
  return null;
}
/** 进入各档需要的步进上限（ms），给提示文字用 */
const TIER_BELOW: Record<SpeedTier, number> = { slow: Infinity, mid: 140, fast: 110, faster: 85, max: 70 };

type StepResult = "move" | "eat" | "gold" | "dead" | "clear";

/** 前进一格，顺便推进金色食物的计时 */
function step(g: Game): StepResult {
  g.time += interval(g) / 1000;
  if (g.gold && g.time > g.gold.until) {
    g.gold = null;
    g.nextGold = g.time + 8 + Math.random() * 6;
  }
  if (g.bonus && !g.gold && g.time >= g.nextGold) {
    const p = freeCell(g);
    if (p) g.gold = { p, until: g.time + GOLD_LIFE };
  }

  g.dir = g.queue.shift() ?? g.dir;
  g.prevTail = g.snake[g.snake.length - 1];
  g.fx = g.fx.filter((f) => g.time - f.at < 0.6);
  const head = g.snake[0];
  let x = head.x + VEC[g.dir].x;
  let y = head.y + VEC[g.dir].y;
  if (g.wrap) {
    x = (x + N) % N;
    y = (y + N) % N;
  } else if (x < 0 || y < 0 || x >= N || y >= N) return "dead";
  if (g.walls.has(y * N + x)) return "dead";

  const eat = g.food !== null && g.food.x === x && g.food.y === y;
  const gold = g.gold !== null && g.gold.p.x === x && g.gold.p.y === y;
  const body = eat || gold ? g.snake : g.snake.slice(0, -1);
  if (body.some((p) => p.x === x && p.y === y)) return "dead";
  g.snake = [{ x, y }, ...body];

  if (eat) {
    g.eaten++;
    g.score++;
    g.fx.push({ x, y, at: g.time, color: FOOD });
    g.food = freeCell(g);
    g.foodAt = g.time;
  } else if (gold) {
    g.fx.push({ x, y, at: g.time, color: GOLD });
    g.eaten += 3;
    g.score += 3;
    g.gold = null;
    g.nextGold = g.time + 8 + Math.random() * 6;
  }
  if (g.eaten >= goalOf(g)) return "clear";
  if (!g.food) return g.mode.kind === "level" ? "clear" : "dead";
  return eat ? "eat" : gold ? "gold" : "move";
}

/** 穿墙关里相邻两格可能隔着边界，取最短的那个方向 */
function delta(a: P, b: P, wrap: boolean) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  if (wrap) {
    if (dx > 1) dx -= N;
    if (dx < -1) dx += N;
    if (dy > 1) dy -= N;
    if (dy < -1) dy += N;
  }
  return { x: dx, y: dy };
}

function lerp(a: P, b: P, t: number, wrap: boolean): P {
  const d = delta(a, b, wrap);
  const p = { x: a.x + d.x * t, y: a.y + d.y * t };
  return wrap ? { x: (p.x + N) % N, y: (p.y + N) % N } : p;
}

/** #rrggbb 加透明度；不是十六进制颜色时原样返回 */
function alpha(hex: string, a: number) {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})` : hex;
}

const easeOut = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

/**
 * t 是这一格走了多少（0~1）。规则仍然按格子走，这里只在两次走格之间补间：
 * 蛇头从上一格滑向这一格，蛇尾从上一个尾巴位置滑过来，中间的身体就是格子中心连成的折线
 */
function draw(el: HTMLCanvasElement | null, g: Game, t = 1) {
  const ctx = el?.getContext("2d");
  if (!el || !ctx) return;
  const css = getComputedStyle(el);
  const accent = css.getPropertyValue("--accent").trim() || "#ff3ea5";
  const fg = css.getPropertyValue("--fg").trim() || "#fff";
  const cell = el.width / N;
  const now = g.time + (t * interval(g)) / 1000; // 平滑的时间，给动画用
  const cx = (p: P) => (p.x + 0.5) * cell;
  const cy = (p: P) => (p.y + 0.5) * cell;

  ctx.clearRect(0, 0, el.width, el.height);
  ctx.fillStyle = "rgb(255 255 255 / 0.035)";
  for (let y = 0; y < N; y++) for (let x = (y + 1) % 2; x < N; x += 2) ctx.fillRect(x * cell, y * cell, cell, cell);

  // 穿墙关：脉冲虚线边框 + 四边中点箭头，提示头会从对面出来
  if (g.wrap) {
    const pulse = 0.4 + 0.35 * (0.5 + 0.5 * Math.sin(now * 3));
    ctx.strokeStyle = `rgb(122 245 255 / ${pulse})`;
    ctx.lineWidth = Math.max(2, cell * 0.14);
    ctx.setLineDash([cell * 0.55, cell * 0.35]);
    ctx.strokeRect(1, 1, el.width - 2, el.height - 2);
    ctx.setLineDash([]);
    const mid = el.width / 2;
    const tip = Math.max(4, cell * 0.35);
    const drawArrow = (x: number, y: number, dx: number, dy: number) => {
      ctx.fillStyle = `rgb(122 245 255 / ${0.55 + pulse * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - dy * tip - dx * tip, y - dx * tip - dy * tip);
      ctx.lineTo(x + dy * tip - dx * tip, y + dx * tip - dy * tip);
      ctx.closePath();
      ctx.fill();
    };
    drawArrow(mid, tip * 0.9, 0, 1);
    drawArrow(mid, el.height - tip * 0.9, 0, -1);
    drawArrow(tip * 0.9, mid, 1, 0);
    drawArrow(el.width - tip * 0.9, mid, -1, 0);
  }

  for (const i of g.walls) {
    const x = (i % N) * cell;
    const y = Math.floor(i / N) * cell;
    ctx.fillStyle = "#3a1a55";
    ctx.fillRect(x, y, cell, cell);
    ctx.fillStyle = "rgb(255 62 165 / 0.35)";
    ctx.fillRect(x, y, cell, Math.max(1, cell * 0.12));
  }

  const dot = (p: P, color: string, r: number) => {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = cell * 0.8;
    ctx.beginPath();
    ctx.arc(cx(p), cy(p), cell * r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  };
  // 新食物从小弹到正常大小，之后轻轻呼吸
  if (g.food) {
    const pop = g.foodAt < 0 ? 1 : easeOut((now - g.foodAt) / 0.25);
    dot(g.food, FOOD, (0.3 + Math.sin(now * 4) * 0.02) * (0.3 + 0.7 * pop) + (1 - pop) * 0.12);
  }
  if (g.gold) {
    const left = g.gold.until - now;
    // 快消失时闪烁
    if (left > 1.5 || Math.floor(left * 6) % 2 === 0) dot(g.gold.p, GOLD, 0.36 + Math.sin(now * 8) * 0.04);
  }

  // 吃到东西：一圈扩散变淡的光环
  for (const f of g.fx) {
    const k = (now - f.at) / 0.45;
    if (k < 0 || k > 1) continue;
    ctx.strokeStyle = f.color;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = cell * 0.12 * (1 - k) + 1;
    ctx.beginPath();
    ctx.arc(cx(f), cy(f), cell * (0.35 + easeOut(k) * 0.9), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 蛇身：补间后的蛇头 → 身体各格中心 → 补间后的蛇尾，画成一条圆角粗线
  const s = g.snake;
  const head = s.length > 1 ? lerp(s[1], s[0], t, g.wrap) : s[0];
  const tail = lerp(g.prevTail, s[s.length - 1], t, g.wrap);
  const pts = [head, ...s.slice(1), tail];
  const tailEnd = pts[pts.length - 1];
  const grad = ctx.createLinearGradient(cx(head), cy(head), cx(tailEnd), cy(tailEnd));
  grad.addColorStop(0, accent);
  grad.addColorStop(1, alpha(accent, 0.55));
  ctx.strokeStyle = grad;
  ctx.lineWidth = cell * 0.68;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = accent;
  ctx.shadowBlur = cell * 0.5;
  ctx.beginPath();
  pts.forEach((p, i) => {
    // 穿墙时相邻两点隔着整个棋盘，断开不连
    const jump = i > 0 && (Math.abs(p.x - pts[i - 1].x) > 1.5 || Math.abs(p.y - pts[i - 1].y) > 1.5);
    if (i === 0 || jump) ctx.moveTo(cx(p), cy(p));
    else ctx.lineTo(cx(p), cy(p));
  });
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 蛇头：圆头加两只朝前的眼睛
  const d = s.length > 1 ? delta(s[1], s[0], g.wrap) : { x: 1, y: 0 };
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(cx(head), cy(head), cell * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#14021f";
  for (const side of [-1, 1]) {
    const ex = cx(head) + d.x * cell * 0.14 - d.y * side * cell * 0.17;
    const ey = cy(head) + d.y * cell * 0.14 + d.x * side * cell * 0.17;
    ctx.beginPath();
    ctx.arc(ex, ey, cell * 0.075, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function Snake() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [initial] = useState(() => newGame({ kind: "level", index: 0 }));
  const game = useRef<Game>(initial);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [phase, setPhase] = useState<Phase>("select");
  const [hud, setHud] = useState<Hud>({
    eaten: 0,
    score: 0,
    seconds: 0,
    len: 3,
    wrap: false,
    edgeHint: null,
    speedMs: 150,
    speedTier: "mid",
    nextSpeed: nextSpeedTier(150),
    goldLeft: null,
    goldEta: null,
  });
  const [record, setRecord] = useState(false);
  const [unlocked] = useRecord("snake-unlocked", higher);
  const [best] = useRecord("snake", higher);
  const levelBests = useRecordList(LEVEL_KEYS);
  const level = mode.kind === "level" ? SNAKE_LEVELS[mode.index] : null;
  const levelNo = mode.kind === "level" ? mode.index + 1 : 0;
  const t = useT(SNAKE_MESSAGES);
  const lang = useLang();
  const levelName = level ? level.name[lang] : "";
  // HUD 里存的是 key，显示时再按当前语言翻译
  const tierName = t.tier[hud.speedTier];
  const nextText = hud.nextSpeed
    ? t.nextSpeed(t.tier[hud.nextSpeed], TIER_BELOW[hud.nextSpeed], Math.round(hud.speedMs))
    : null;
  const nextSuffix = nextText ? ` · ${nextText}` : t.maxed;
  const isEdge = hud.edgeHint?.tier === "edge";
  const isNear = hud.edgeHint?.tier === "near";
  const edgeText = hud.edgeHint
    ? isEdge
      ? t.exitHint[hud.edgeHint.dir]
      : isNear
        ? t.nearHint[hud.edgeHint.dir]
        : t.safeHint
    : null;
  const isFast = hud.speedTier === "max" || hud.speedTier === "faster";

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const px = Math.round(el.clientWidth * Math.min(devicePixelRatio, 2));
      el.width = el.height = px;
      draw(el, game.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sync = () => {
    const g = game.current;
    const speedMs = interval(g);
    setHud({
      eaten: g.eaten,
      score: g.score,
      seconds: Math.floor(g.time),
      len: g.snake.length,
      wrap: g.wrap,
      edgeHint: wrapHint(g),
      speedMs,
      speedTier: speedTier(speedMs),
      nextSpeed: nextSpeedTier(speedMs),
      goldLeft: g.gold ? Math.max(0, g.gold.until - g.time) : null,
      goldEta: !g.gold && g.bonus ? Math.max(0, g.nextGold - g.time) : null,
    });
  };

  const finish = useEffectEvent((result: "dead" | "clear") => {
    const g = game.current;
    sync();
    if (result === "dead") {
      buzz([40, 40, 80]);
      setRecord(g.mode.kind === "endless" && g.score > 0 && saveRecord("snake", g.score, higher));
      setPhase("over");
      return;
    }
    buzz([20, 30, 20, 30, 60]);
    if (g.mode.kind === "level") {
      const i = g.mode.index;
      saveRecord("snake-unlocked", Math.min(i + 2, SNAKE_LEVELS.length), higher);
      setRecord(saveRecord(LEVEL_KEYS[i], Math.round(g.time), lower));
    }
    setPhase("clear");
  });

  useEffect(() => {
    draw(canvas.current, game.current);
    if (phase !== "running") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      // 切回标签页时不要一口气补走很多步
      acc = Math.min(acc + now - last, 300);
      last = now;
      const g = game.current;
      while (acc >= interval(g)) {
        acc -= interval(g);
        const second = Math.floor(g.time);
        const r = step(g);
        if (r === "dead" || r === "clear") {
          draw(canvas.current, g);
          finish(r);
          return;
        }
        if (r === "eat" || r === "gold") buzz(r === "gold" ? [15, 30, 15] : 12);
        if (r !== "move" || Math.floor(g.time) !== second) sync();
      }
      draw(canvas.current, g, acc / interval(g));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onHide = () => document.hidden && setPhase("paused");
    document.addEventListener("visibilitychange", onHide);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [phase]);

  const start = (m: Mode) => {
    game.current = newGame(m);
    setMode(m);
    sync();
    setRecord(false);
    setPhase("ready");
  };
  const retry = () => start(mode);
  const hasNext = levelNo > 0 && levelNo < SNAKE_LEVELS.length;
  const next = () => hasNext && start({ kind: "level", index: levelNo });

  const turn = (d: Dir) => {
    if (phase !== "ready" && phase !== "running" && phase !== "paused") return;
    const g = game.current;
    const last = g.queue.at(-1) ?? g.dir;
    if (d !== last && d !== OPPOSITE[last] && g.queue.length < 3) g.queue.push(d);
    if (phase !== "running") setPhase("running");
  };

  const toggle = () => {
    if (phase === "running") setPhase("paused");
    else if (phase === "paused" || phase === "ready") setPhase("running");
  };

  useKeys((key, repeat) => {
    const dir = KEY_DIR[key];
    if (dir) turn(dir);
    else if (key === " " || key === "p" || key === "P") {
      if (!repeat) toggle();
    } else if (key === "Enter" && !repeat) {
      if (phase === "over") retry();
      else if (phase === "clear") {
        if (hasNext) next();
        else setPhase("select");
      }
    } else return false;
    return true;
  });

  const swipe = useSwipe(turn, { continuous: true });
  const levelCards = SNAKE_LEVELS.map((l, i) => ({
    name: l.name[lang],
    best: levelBests[i] !== null ? t.levelBest(levelBests[i]) : undefined,
  }));

  return (
    <div className="game">
      <div className="game-bar">
        {phase === "select" ? (
          <span>
            {t.selectLevel}
            <b>
              {unlocked ?? 1}/{SNAKE_LEVELS.length}
            </b>
            <span
              className="snake-unlock-bar"
              data-full={(unlocked ?? 1) >= SNAKE_LEVELS.length || undefined}
              title={t.unlockedTitle(unlocked ?? 1, SNAKE_LEVELS.length)}
              aria-label={t.unlockedAria(unlocked ?? 1)}
            >
              <i
                style={{
                  width: `${Math.min(100, Math.round(((unlocked ?? 1) / Math.max(1, SNAKE_LEVELS.length)) * 100))}%`,
                }}
              />
            </span>
          </span>
        ) : level ? (
          <>
            <span>
              {t.levelNo(levelNo)}
              <b>{levelName}</b>
              <span
                className="snake-level-bar"
                data-late={levelNo >= Math.max(1, SNAKE_LEVELS.length - 1) || undefined}
                title={t.levelIndexTitle(levelNo, SNAKE_LEVELS.length)}
                aria-label={t.levelIndexAria(levelNo, SNAKE_LEVELS.length)}
              >
                <i
                  style={{
                    width: `${Math.min(100, Math.round((levelNo / Math.max(1, SNAKE_LEVELS.length)) * 100))}%`,
                  }}
                />
              </span>
            </span>
            <span>
              {t.progress}
              <b>
                {Math.min(hud.eaten, level.goal)}/{level.goal}
              </b>
              <span
                className="snake-eaten-bar"
                data-near={hud.eaten / level.goal >= 0.8 || undefined}
                data-done={hud.eaten >= level.goal || undefined}
                title={t.progressTitle(Math.min(hud.eaten, level.goal), level.goal)}
                aria-label={t.progressAria(Math.min(100, Math.round((hud.eaten / Math.max(1, level.goal)) * 100)))}
              >
                <i
                  style={{
                    width: `${Math.min(100, Math.round((hud.eaten / Math.max(1, level.goal)) * 100))}%`,
                  }}
                />
              </span>
            </span>
            <span>
              {t.time}
              <b>{hud.seconds}s</b>
              <span
                className="snake-time-bar"
                data-long={hud.seconds >= 60 || undefined}
                data-over={hud.seconds >= 120 || undefined}
                title={t.timeTitle(hud.seconds)}
                aria-label={t.timeAria(hud.seconds)}
              >
                <i style={{ width: `${Math.min(100, Math.round((hud.seconds / 120) * 100))}%` }} />
              </span>
              <span
                className="snake-pace-bar"
                data-fast={(hud.seconds > 0 && hud.eaten / hud.seconds >= 0.35) || undefined}
                data-slow={(hud.seconds >= 20 && hud.eaten / Math.max(1, hud.seconds) < 0.12) || undefined}
                title={t.paceTitle(hud.seconds > 0 ? Math.round((hud.eaten / hud.seconds) * 100) / 100 : null)}
                aria-label={t.paceAria(hud.seconds > 0 ? Math.round((hud.eaten / hud.seconds) * 100) / 100 : null)}
              >
                <i
                  style={{
                    width: `${hud.seconds > 0 ? Math.min(100, Math.round((hud.eaten / hud.seconds / 0.5) * 100)) : 0}%`,
                  }}
                />
              </span>
              <span
                className="snake-speed-ms-bar"
                data-fast={hud.speedMs <= 120 || undefined}
                data-slow={hud.speedMs >= 220 || undefined}
                title={t.stepTitle(hud.speedMs)}
                aria-label={t.stepAria(hud.speedMs)}
              >
                <i
                  style={{
                    width: `${Math.min(100, Math.max(0, Math.round(((280 - hud.speedMs) / 200) * 100)))}%`,
                  }}
                />
              </span>
              <span
                className="snake-score-pace-bar"
                data-hot={(hud.seconds > 0 && hud.score / hud.seconds >= 40) || undefined}
                data-slow={(hud.seconds >= 15 && hud.score / Math.max(1, hud.seconds) < 8) || undefined}
                title={t.scorePaceTitle(hud.seconds > 0 ? Math.round((hud.score / hud.seconds) * 10) / 10 : null)}
                aria-label={t.scorePaceAria(hud.seconds > 0 ? Math.round((hud.score / hud.seconds) * 10) / 10 : null)}
              >
                <i
                  style={{
                    width: `${hud.seconds > 0 ? Math.min(100, Math.round((hud.score / hud.seconds / 50) * 100)) : 0}%`,
                  }}
                />
              </span>
              <span
                className="snake-len-pace-bar"
                data-hot={(hud.seconds > 0 && hud.len / hud.seconds >= 0.35) || undefined}
                data-slow={(hud.seconds >= 20 && hud.len / Math.max(1, hud.seconds) < 0.08) || undefined}
                title={t.lenPaceTitle(hud.seconds > 0 ? Math.round((hud.len / hud.seconds) * 100) / 100 : null)}
                aria-label={t.lenPaceAria(hud.seconds > 0 ? Math.round((hud.len / hud.seconds) * 100) / 100 : null)}
              >
                <i
                  style={{
                    width: `${hud.seconds > 0 ? Math.min(100, Math.round((hud.len / hud.seconds / 0.5) * 100)) : 0}%`,
                  }}
                />
              </span>
            </span>
            <span title={t.lenTitle(hud.len)}>
              {t.length}
              <b>{hud.len}</b>
              <span
                className="snake-len-bar"
                data-long={hud.len >= 24 || undefined}
                data-huge={hud.len >= 32 || undefined}
                title={t.lenBarTitle(hud.len)}
                aria-label={t.lenAria(hud.len)}
              >
                <i style={{ width: `${Math.min(100, Math.round((hud.len / 40) * 100))}%` }} />
              </span>
              <span title={t.effTitle(hud.eaten > 0 ? Math.round((hud.score / hud.eaten) * 10) / 10 : null)}>
                {t.eff}
                <b>{hud.eaten > 0 ? Math.round((hud.score / hud.eaten) * 10) / 10 : "—"}</b>
                <span
                  className="snake-eff-bar"
                  data-hot={(hud.eaten > 0 && hud.score / hud.eaten >= 15) || undefined}
                  data-low={(hud.eaten >= 3 && hud.score / hud.eaten < 8) || undefined}
                  title={t.effTitle(hud.eaten > 0 ? Math.round((hud.score / hud.eaten) * 10) / 10 : null)}
                  aria-label={t.effAria(hud.eaten > 0 ? Math.round((hud.score / hud.eaten) * 10) / 10 : null)}
                >
                  <i
                    style={{
                      width: `${hud.eaten > 0 ? Math.min(100, Math.round((hud.score / hud.eaten / 20) * 100)) : 0}%`,
                    }}
                  />
                </span>
              </span>
              <span title={t.densityTitle(hud.len > 0 ? Math.round((hud.score / hud.len) * 10) / 10 : null)}>
                {t.density}
                <b>{hud.len > 0 ? Math.round((hud.score / hud.len) * 10) / 10 : "—"}</b>
                <span
                  className="snake-density-bar"
                  data-hot={(hud.len > 0 && hud.score / hud.len >= 30) || undefined}
                  data-low={(hud.len >= 8 && hud.score / hud.len < 10) || undefined}
                  title={t.densityTitle(hud.len > 0 ? Math.round((hud.score / hud.len) * 10) / 10 : null)}
                  aria-label={t.densityAria(hud.len > 0 ? Math.round((hud.score / hud.len) * 10) / 10 : null)}
                >
                  <i
                    style={{
                      width: `${hud.len > 0 ? Math.min(100, Math.round((hud.score / hud.len / 40) * 100)) : 0}%`,
                    }}
                  />
                </span>
                <span
                  className="snake-food-eff-bar"
                  data-hot={(hud.eaten > 0 && hud.score / hud.eaten >= 35) || undefined}
                  data-low={(hud.eaten >= 5 && hud.score / hud.eaten < 12) || undefined}
                  title={t.foodEffTitle(hud.eaten > 0 ? Math.round((hud.score / hud.eaten) * 10) / 10 : null)}
                  aria-label={t.foodEffAria(hud.eaten > 0 ? Math.round((hud.score / hud.eaten) * 10) / 10 : null)}
                >
                  <i
                    style={{
                      width: `${hud.eaten > 0 ? Math.min(100, Math.round((hud.score / hud.eaten / 50) * 100)) : 0}%`,
                    }}
                  />
                </span>
                <span
                  className="snake-eat-pace-bar"
                  data-hot={(hud.seconds > 0 && hud.eaten / hud.seconds >= 0.35) || undefined}
                  data-slow={(hud.seconds >= 20 && hud.eaten / Math.max(1, hud.seconds) < 0.08) || undefined}
                  title={t.eatPaceTitle(hud.seconds > 0 ? Math.round((hud.eaten / hud.seconds) * 100) / 100 : null)}
                  aria-label={t.eatPaceAria(hud.seconds > 0 ? Math.round((hud.eaten / hud.seconds) * 100) / 100 : null)}
                >
                  <i
                    style={{
                      width: `${
                        hud.seconds > 0 ? Math.min(100, Math.round((hud.eaten / hud.seconds / 0.5) * 100)) : 0
                      }%`,
                    }}
                  />
                </span>
                <span
                  className="snake-score-len-bar"
                  data-hot={(hud.len > 0 && hud.score / hud.len >= 8) || undefined}
                  data-low={(hud.len >= 5 && hud.score / Math.max(1, hud.len) < 2) || undefined}
                  title={t.scoreLenTitle(hud.len > 0 ? Math.round((hud.score / hud.len) * 10) / 10 : null)}
                  aria-label={t.scoreLenAria(hud.len > 0 ? Math.round((hud.score / hud.len) * 10) / 10 : null)}
                >
                  <i
                    style={{
                      width: `${hud.len > 0 ? Math.min(100, Math.round((hud.score / hud.len / 10) * 100)) : 0}%`,
                    }}
                  />
                </span>
                <span
                  className="snake-grow-pace-bar"
                  data-hot={(hud.seconds > 0 && hud.len / hud.seconds >= 0.35) || undefined}
                  data-slow={(hud.seconds >= 20 && hud.len / Math.max(1, hud.seconds) < 0.08) || undefined}
                  title={t.growPaceTitle(hud.seconds > 0 ? Math.round((hud.len / hud.seconds) * 100) / 100 : null)}
                  aria-label={t.growPaceAria(hud.seconds > 0 ? Math.round((hud.len / hud.seconds) * 100) / 100 : null)}
                >
                  <i
                    style={{
                      width: `${hud.seconds > 0 ? Math.min(100, Math.round((hud.len / hud.seconds / 0.5) * 100)) : 0}%`,
                    }}
                  />
                </span>
              </span>
            </span>
            <span
              className={
                hud.goldLeft != null || hud.goldEta != null || hud.wrap
                  ? "snake-speed-gold snake-wrap-gold snake-gold-dual"
                  : undefined
              }
              data-gold={hud.goldLeft != null || undefined}
              data-eta={hud.goldEta != null || undefined}
              data-gold-tier={
                hud.goldLeft == null ? undefined : hud.goldLeft <= 2 ? "hot" : hud.goldLeft <= 5 ? "warm" : "cool"
              }
              data-eta-tier={
                hud.goldEta == null ? undefined : hud.goldEta <= 2 ? "hot" : hud.goldEta <= 5 ? "warm" : "cool"
              }
              data-wrap={hud.wrap || undefined}
              data-urgent={
                (hud.goldLeft != null && hud.goldLeft <= 2) || (hud.goldEta != null && hud.goldEta <= 2) || undefined
              }
              data-edge={(hud.wrap && isEdge) || undefined}
              data-near={(hud.wrap && isNear) || undefined}
              data-edge-tier={!hud.wrap ? undefined : isEdge ? "edge" : isNear ? "near" : "safe"}
              data-fast={isFast || undefined}
              title={
                hud.wrap && hud.goldLeft != null
                  ? t.speedWrapGoldTitle(edgeText ?? t.wrapOn, hud.goldLeft.toFixed(1), tierName)
                  : hud.goldLeft != null
                    ? t.speedGoldTitle(tierName, hud.speedMs, nextSuffix, hud.goldLeft.toFixed(1))
                    : hud.wrap
                      ? t.speedWrapTitle(edgeText ?? t.wrapOnShort, tierName)
                      : t.stepNext(hud.speedMs, nextSuffix)
              }
            >
              {t.speed}
              <b className={isFast ? "game-tip--alert" : undefined}>{tierName}</b>
              <span
                className="snake-speed-gauge"
                data-fast={isFast || undefined}
                data-tier={hud.speedTier}
                title={t.gaugeTitle(hud.speedMs, tierName, nextSuffix)}
                aria-label={t.gaugeAria(tierName, hud.speedMs)}
              >
                <i
                  style={{
                    width: `${Math.min(100, Math.max(0, Math.round(((150 - hud.speedMs) / (150 - 65)) * 100)))}%`,
                  }}
                />
              </span>
              {hud.goldLeft != null && (
                <>
                  <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
                  {t.gold}
                  <b className={hud.goldLeft <= 2 ? "game-tip--alert" : undefined}>{hud.goldLeft.toFixed(1)}s</b>
                  <small
                    className="snake-gold-tier"
                    data-tier={hud.goldLeft <= 2 ? "hot" : hud.goldLeft <= 5 ? "warm" : "cool"}
                    style={{ marginLeft: 4 }}
                  >
                    {hud.goldLeft <= 2 ? "hot" : hud.goldLeft <= 5 ? "warm" : "cool"}
                  </small>
                  <span
                    className="snake-gold-life-bar"
                    data-tier={hud.goldLeft <= 2 ? "hot" : hud.goldLeft <= 5 ? "warm" : "cool"}
                    title={t.goldLeftTitle(hud.goldLeft.toFixed(1))}
                    aria-label={t.goldLeftAria(hud.goldLeft.toFixed(1))}
                  >
                    <i style={{ width: `${Math.min(100, Math.round((hud.goldLeft / 6) * 100))}%` }} />
                  </span>
                  {nextText ? (
                    <small style={{ marginLeft: 4, opacity: 0.7 }}>{nextText}</small>
                  ) : (
                    <small style={{ marginLeft: 4, opacity: 0.55 }}>{t.maxShort}</small>
                  )}
                </>
              )}
              {hud.goldLeft == null && hud.goldEta != null && (
                <>
                  <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
                  {t.goldEta}
                  <b className={hud.goldEta <= 2 ? "game-tip--alert" : undefined}>{hud.goldEta.toFixed(1)}s</b>
                  <small
                    className="snake-gold-tier"
                    data-tier={hud.goldEta <= 2 ? "hot" : hud.goldEta <= 5 ? "warm" : "cool"}
                    style={{ marginLeft: 4 }}
                  >
                    {hud.goldEta <= 2 ? "hot" : hud.goldEta <= 5 ? "warm" : "cool"}
                  </small>
                  <span
                    className="snake-gold-life-bar snake-gold-eta-bar"
                    data-tier={hud.goldEta <= 2 ? "hot" : hud.goldEta <= 5 ? "warm" : "cool"}
                    title={t.goldEtaTitle(hud.goldEta.toFixed(1))}
                    aria-label={t.goldEtaAria(hud.goldEta.toFixed(1))}
                  >
                    <i style={{ width: `${Math.min(100, Math.round((hud.goldEta / 14) * 100))}%` }} />
                  </span>
                </>
              )}
              {hud.wrap && (
                <>
                  <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
                  <span
                    className="snake-wrap-badge snake-wrap-badge--tier"
                    data-edge={isEdge || undefined}
                    data-near={isNear || undefined}
                    data-edge-tier={isEdge ? "edge" : isNear ? "near" : "safe"}
                    title={
                      isEdge
                        ? t.wrapTierTitle("edge", edgeText ?? "")
                        : isNear
                          ? t.wrapTierTitle("near", edgeText ?? "")
                          : t.wrapTierSafe
                    }
                  >
                    {t.wrap}
                    {isEdge ? (
                      <small className="snake-wrap-badge__warn">{t.wrapExiting}</small>
                    ) : isNear ? (
                      <small className="snake-wrap-badge__near">{t.wrapNear}</small>
                    ) : (
                      <small>{t.wrapOpen}</small>
                    )}
                  </span>
                  <span
                    className="snake-edge-bar"
                    data-edge={isEdge || undefined}
                    data-near={isNear || undefined}
                    title={
                      isEdge
                        ? t.edgeBarTitle("edge", edgeText ?? "")
                        : isNear
                          ? t.edgeBarTitle("near", edgeText ?? "")
                          : t.edgeBarSafe
                    }
                    aria-label={isEdge ? t.edgeAria.edge : isNear ? t.edgeAria.near : t.edgeAria.safe}
                  >
                    <i
                      style={{
                        width: `${isEdge ? 100 : isNear ? 60 : 20}%`,
                      }}
                    />
                  </span>
                </>
              )}
            </span>
          </>
        ) : (
          <>
            <span>
              {t.endlessScore}
              <b>{hud.score}</b>
              <span
                className="snake-score-bar"
                data-record={(best != null && hud.score >= best && hud.score > 0) || undefined}
                data-near={(best != null && best > 0 && hud.score / best >= 0.8) || undefined}
                title={t.scoreTitle(hud.score, best)}
                aria-label={t.scoreAria(hud.score)}
              >
                <i
                  style={{
                    width: `${Math.min(100, Math.round((hud.score / Math.max(1, best ?? hud.score, 1)) * 100))}%`,
                  }}
                />
              </span>
            </span>
            <span>
              {t.best}
              <b>{best ?? 0}</b>
              <span
                className="snake-best-gap-bar"
                data-record={(best != null && hud.score >= best && hud.score > 0) || undefined}
                data-near={(best != null && best > 0 && hud.score / best >= 0.8) || undefined}
                title={
                  best != null && best > 0
                    ? t.bestGapTitle(Math.max(0, best - hud.score), hud.score, best)
                    : t.bestTitle(best ?? 0)
                }
                aria-label={
                  best != null && best > 0
                    ? t.bestPctAria(Math.min(100, Math.round((hud.score / best) * 100)))
                    : t.bestAria(best ?? 0)
                }
              >
                <i
                  style={{
                    width: `${best != null && best > 0 ? Math.min(100, Math.round((hud.score / best) * 100)) : 0}%`,
                  }}
                />
              </span>
            </span>
            <span title={t.endlessLenTitle(hud.len)}>
              {t.length}
              <b>{hud.len}</b>
              <span
                className="snake-len-bar"
                data-long={hud.len >= 24 || undefined}
                data-huge={hud.len >= 32 || undefined}
                title={t.endlessLenBarTitle(hud.len)}
                aria-label={t.lenAria(hud.len)}
              >
                <i style={{ width: `${Math.min(100, Math.round((hud.len / 40) * 100))}%` }} />
              </span>
            </span>
            <span
              className={
                hud.goldLeft != null || hud.goldEta != null
                  ? "snake-speed-gold snake-gold-timer snake-endless-gold snake-gold-dual"
                  : undefined
              }
              data-gold={hud.goldLeft != null || undefined}
              data-eta={hud.goldEta != null || undefined}
              data-gold-tier={
                hud.goldLeft == null ? undefined : hud.goldLeft <= 2 ? "hot" : hud.goldLeft <= 5 ? "warm" : "cool"
              }
              data-eta-tier={
                hud.goldEta == null ? undefined : hud.goldEta <= 2 ? "hot" : hud.goldEta <= 5 ? "warm" : "cool"
              }
              data-urgent={
                (hud.goldLeft != null && hud.goldLeft <= 2) || (hud.goldEta != null && hud.goldEta <= 2) || undefined
              }
              data-fast={isFast || undefined}
              title={
                hud.goldLeft != null
                  ? t.endlessGoldTitle(tierName, hud.speedMs, hud.goldLeft.toFixed(1), nextSuffix)
                  : hud.goldEta != null
                    ? t.endlessEtaTitle(tierName, hud.speedMs, hud.goldEta.toFixed(1), nextSuffix)
                    : t.stepNext(hud.speedMs, nextSuffix)
              }
            >
              {t.speed}
              <b className={isFast ? "game-tip--alert" : undefined}>{tierName}</b>
              <span
                className="snake-speed-gauge"
                data-fast={isFast || undefined}
                data-tier={hud.speedTier}
                title={t.gaugeTitle(hud.speedMs, tierName, nextSuffix)}
                aria-label={t.gaugeAria(tierName, hud.speedMs)}
              >
                <i
                  style={{
                    width: `${Math.min(100, Math.max(0, Math.round(((150 - hud.speedMs) / (150 - 65)) * 100)))}%`,
                  }}
                />
              </span>
              {hud.goldLeft != null && (
                <>
                  <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
                  {t.gold}
                  <b className={hud.goldLeft <= 2 ? "game-tip--alert" : undefined}>{hud.goldLeft.toFixed(1)}s</b>
                  <small
                    className="snake-gold-tier"
                    data-tier={hud.goldLeft <= 2 ? "hot" : hud.goldLeft <= 5 ? "warm" : "cool"}
                    style={{ marginLeft: 4 }}
                  >
                    {hud.goldLeft <= 2 ? "hot" : hud.goldLeft <= 5 ? "warm" : "cool"}
                  </small>
                  <span
                    className="snake-gold-life-bar"
                    data-tier={hud.goldLeft <= 2 ? "hot" : hud.goldLeft <= 5 ? "warm" : "cool"}
                    title={t.endlessGoldLeftTitle(hud.goldLeft.toFixed(1))}
                    aria-label={t.goldLeftAria(hud.goldLeft.toFixed(1))}
                  >
                    <i style={{ width: `${Math.min(100, Math.round((hud.goldLeft / 6) * 100))}%` }} />
                  </span>
                  <small className="snake-endless-gold__tag" style={{ marginLeft: 4, opacity: 0.8 }}>
                    {t.endlessTag}
                  </small>
                  {nextText ? (
                    <small style={{ marginLeft: 4, opacity: 0.7 }}>{nextText}</small>
                  ) : (
                    <small style={{ marginLeft: 4, opacity: 0.55 }}>{t.maxShort}</small>
                  )}
                </>
              )}
              {hud.goldLeft == null && hud.goldEta != null && (
                <>
                  <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
                  {t.goldEta}
                  <b className={hud.goldEta <= 2 ? "game-tip--alert" : undefined}>{hud.goldEta.toFixed(1)}s</b>
                  <small
                    className="snake-gold-tier"
                    data-tier={hud.goldEta <= 2 ? "hot" : hud.goldEta <= 5 ? "warm" : "cool"}
                    style={{ marginLeft: 4 }}
                  >
                    {hud.goldEta <= 2 ? "hot" : hud.goldEta <= 5 ? "warm" : "cool"}
                  </small>
                  <span
                    className="snake-gold-life-bar snake-gold-eta-bar"
                    data-tier={hud.goldEta <= 2 ? "hot" : hud.goldEta <= 5 ? "warm" : "cool"}
                    title={t.endlessEtaBarTitle(hud.goldEta.toFixed(1))}
                    aria-label={t.goldEtaAria(hud.goldEta.toFixed(1))}
                  >
                    <i style={{ width: `${Math.min(100, Math.round((hud.goldEta / 14) * 100))}%` }} />
                  </span>
                  <small className="snake-endless-gold__tag" style={{ marginLeft: 4, opacity: 0.8 }}>
                    {t.endlessTag}
                  </small>
                </>
              )}
            </span>
          </>
        )}
        <span className="spacer" />
        {(phase === "running" || phase === "paused") && (
          <button type="button" className="game-btn" onClick={toggle}>
            {phase === "running" ? t.pause : t.resume}
          </button>
        )}
      </div>
      {(phase === "running" || phase === "paused") && (
        <p
          className={
            hud.wrap || isFast || hud.goldLeft != null || (hud.goldEta != null && hud.goldEta <= 2)
              ? "game-tip game-tip--alert"
              : "game-tip"
          }
          aria-live="polite"
        >
          {`${
            hud.wrap && hud.goldLeft != null
              ? t.tipWrapGold(edgeText ?? t.wrapOn, hud.goldLeft.toFixed(1), hud.goldLeft <= 2, tierName)
              : hud.wrap && hud.goldEta != null
                ? t.tipWrapEta(edgeText ?? t.wrapOn, hud.goldEta.toFixed(1), tierName)
                : hud.wrap && isEdge
                  ? t.tipWrapEdge(edgeText ?? "", tierName)
                  : hud.wrap && isNear
                    ? t.tipWrapNear(edgeText ?? "", tierName, hud.speedMs)
                    : hud.wrap && edgeText
                      ? t.tipWrapHint(edgeText, tierName, hud.speedMs)
                      : hud.wrap
                        ? t.tipWrap(
                            tierName,
                            hud.speedMs,
                            level ? `${Math.min(hud.eaten, level.goal)}/${level.goal}` : null,
                          )
                        : hud.goldLeft != null
                          ? level
                            ? t.tipLevelGold(hud.goldLeft.toFixed(1), tierName, hud.speedMs)
                            : t.tipEndlessGold(hud.goldLeft.toFixed(1), hud.goldLeft <= 2, tierName, hud.speedMs)
                          : level
                            ? t.tipLevel(
                                levelNo,
                                levelName,
                                `${Math.min(hud.eaten, level.goal)}/${level.goal}`,
                                !!level.bonus,
                                tierName,
                                hud.speedMs,
                              )
                            : hud.goldEta != null
                              ? t.tipEndlessEta(hud.goldEta.toFixed(1), tierName, hud.speedMs)
                              : t.tipEndless(tierName, hud.speedMs)
          }${
            hud.wrap && hud.goldLeft != null
              ? nextText
                ? ` · ${nextText}`
                : ""
              : nextSuffix +
                (hud.goldLeft != null && !hud.wrap
                  ? ""
                  : hud.goldLeft != null
                    ? t.tipGoldSuffix(hud.goldLeft.toFixed(1))
                    : "")
          }`}
        </p>
      )}
      <div className="game-stage" {...swipe}>
        <canvas ref={canvas} aria-label={level ? t.canvasLevel(levelNo) : t.canvasEndless} />
        {phase !== "running" && (
          <div className="game-overlay">
            {phase === "select" && (
              <LevelSelect
                title={t.selectLevel}
                levels={levelCards}
                unlocked={unlocked ?? 1}
                onPick={(i) => start({ kind: "level", index: i })}
              >
                <button type="button" className="game-btn" onClick={() => start({ kind: "endless" })}>
                  {t.endless}
                  {best ? t.endlessBest(best) : ""}
                </button>
              </LevelSelect>
            )}
            {phase === "ready" && (
              <>
                <strong>{level ? t.readyTitle(levelNo, levelName) : t.endless}</strong>
                <p>
                  {level ? t.readyGoal(level.goal) : t.readyEndless}
                  {level?.wrap ? t.readyWrap : ""}
                  {(level ? level.bonus : true) ? t.readyGold : ""}
                </p>
                <button type="button" className="game-btn game-btn--primary" onClick={() => setPhase("running")}>
                  {t.start}
                </button>
              </>
            )}
            {phase === "paused" && (
              <>
                <strong>{t.paused}</strong>
                <span style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="game-btn game-btn--primary" onClick={toggle}>
                    {t.resume}
                  </button>
                  <button type="button" className="game-btn" onClick={() => setPhase("select")}>
                    {t.levels}
                  </button>
                </span>
              </>
            )}
            {phase === "over" && (
              <>
                <strong>{record ? t.newRecord : t.crashed}</strong>
                <p>{level ? t.overLevel(Math.min(hud.eaten, level.goal), level.goal) : t.overEndless(hud.score)}</p>
                <span style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="game-btn game-btn--primary" onClick={retry}>
                    {t.retry}
                  </button>
                  <button type="button" className="game-btn" onClick={() => setPhase("select")}>
                    {t.levels}
                  </button>
                </span>
              </>
            )}
            {phase === "clear" && (
              <>
                <strong>{hasNext ? t.cleared : t.allCleared}</strong>
                <p>{t.clearTime(hud.seconds, record)}</p>
                <span style={{ display: "flex", gap: 8 }}>
                  {hasNext && (
                    <button type="button" className="game-btn game-btn--primary" onClick={next}>
                      {t.nextLevel}
                    </button>
                  )}
                  <button
                    type="button"
                    className={hasNext ? "game-btn" : "game-btn game-btn--primary"}
                    onClick={() => setPhase("select")}
                  >
                    {t.levels}
                  </button>
                </span>
              </>
            )}
          </div>
        )}
      </div>
      {/* 触屏：加大 dpad，按下即转向 + 轻震；附带暂停 */}
      <div className="dpad dpad--lg" aria-label={t.dpad}>
        {PAD.map(([dir, arrow]) => (
          <button
            key={dir}
            type="button"
            aria-label={t.pad[dir]}
            style={{ gridArea: dir }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture?.(e.pointerId);
              turn(dir);
              buzz(10);
            }}
          >
            {arrow}
          </button>
        ))}
        {(phase === "running" || phase === "paused") && (
          <button
            type="button"
            className="dpad__pause"
            style={{ gridArea: "pause" }}
            aria-label={phase === "paused" ? t.resume : t.pause}
            onPointerDown={(e) => {
              e.preventDefault();
              toggle();
            }}
          >
            {phase === "paused" ? t.resume : t.pause}
          </button>
        )}
      </div>
      <p className="game-hint when-mouse">{t.hintMouse}</p>
      <p className="game-hint when-touch">{t.hintTouch}</p>
    </div>
  );
}
