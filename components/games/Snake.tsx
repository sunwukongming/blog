"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { buzz, higher, KEY_DIR, lower, saveRecord, useKeys, useRecord, useRecordList, useSwipe, type Dir } from "./input";
import LevelSelect from "./LevelSelect";
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
type Hud = { eaten: number; score: number; seconds: number; wrap: boolean; edgeHint: string | null; speedMs: number; speedTier: string; nextSpeed: string | null; goldLeft: number | null };

const VEC: Record<Dir, P> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
const PAD: [Dir, string, string][] = [
  ["up", "↑", "向上"],
  ["left", "←", "向左"],
  ["down", "↓", "向下"],
  ["right", "→", "向右"],
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


const EXIT_HINT: Record<Dir, string> = {
  left: "← 穿墙 · 将从右侧出现",
  right: "→ 穿墙 · 将从左侧出现",
  up: "↑ 穿墙 · 将从下侧出现",
  down: "↓ 穿墙 · 将从上侧出现",
};
const NEAR_HINT: Record<Dir, string> = {
  left: "穿墙关 · 靠左缘，出界从右回",
  right: "穿墙关 · 靠右缘，出界从左回",
  up: "穿墙关 · 靠上缘，出界从下回",
  down: "穿墙关 · 靠下缘，出界从上回",
};

/** 穿墙关：贴边/近边时提示头会从对面出来 */
function wrapHint(g: Game): string | null {
  if (!g.wrap) return null;
  const h = g.snake[0];
  const d = g.queue[0] ?? g.dir;
  if ((d === "left" && h.x === 0) || (d === "right" && h.x === N - 1) || (d === "up" && h.y === 0) || (d === "down" && h.y === N - 1)) {
    return EXIT_HINT[d];
  }
  if ((d === "left" && h.x <= 2) || (d === "right" && h.x >= N - 3) || (d === "up" && h.y <= 2) || (d === "down" && h.y >= N - 3)) {
    return NEAR_HINT[d];
  }
  return "穿墙关 · 边缘可出入，头从对面出";
}

const goalOf = (g: Game) => (g.mode.kind === "level" ? SNAKE_LEVELS[g.mode.index].goal : Infinity);

// 关卡模式每吃一个快 2ms；无尽模式沿用原来的节奏
const interval = (g: Game) =>
  g.mode.kind === "level"
    ? Math.max(60, SNAKE_LEVELS[g.mode.index].speed - g.eaten * 2)
    : Math.max(65, 150 - g.score * 3);


function speedTier(ms: number) {
  if (ms >= 140) return "慢";
  if (ms >= 110) return "中";
  if (ms >= 85) return "快";
  if (ms >= 70) return "很快";
  return "极速";
}

/** next speed tier hint for tip line */
function nextSpeedHint(ms: number): string | null {
  if (ms >= 140) return `下一档「中」需步进 <140ms（当前 ${Math.round(ms)}ms）`;
  if (ms >= 110) return `下一档「快」需步进 <110ms（当前 ${Math.round(ms)}ms）`;
  if (ms >= 85) return `下一档「很快」需步进 <85ms（当前 ${Math.round(ms)}ms）`;
  if (ms >= 70) return `下一档「极速」需步进 <70ms（当前 ${Math.round(ms)}ms）`;
  return null;
}

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
  const [hud, setHud] = useState<Hud>({ eaten: 0, score: 0, seconds: 0, wrap: false, edgeHint: null, speedMs: 150, speedTier: "中", nextSpeed: nextSpeedHint(150), goldLeft: null });
  const [record, setRecord] = useState(false);
  const [unlocked] = useRecord("snake-unlocked", higher);
  const [best] = useRecord("snake", higher);
  const levelBests = useRecordList(LEVEL_KEYS);
  const level = mode.kind === "level" ? SNAKE_LEVELS[mode.index] : null;
  const levelNo = mode.kind === "level" ? mode.index + 1 : 0;

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
      wrap: g.wrap,
      edgeHint: wrapHint(g),
      speedMs,
      speedTier: speedTier(speedMs),
      nextSpeed: nextSpeedHint(speedMs),
      goldLeft: g.gold ? Math.max(0, g.gold.until - g.time) : null,
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
    name: l.name,
    best: levelBests[i] !== null ? `${levelBests[i]} 秒` : undefined,
  }));

  return (
    <div className="game">
      <div className="game-bar">
        {phase === "select" ? (
          <span>
            选择关卡<b>{unlocked ?? 1}/{SNAKE_LEVELS.length}</b>
          </span>
        ) : level ? (
          <>
            <span>
              第 {levelNo} 关<b>{level.name}</b>
            </span>
            <span>
              进度<b>{Math.min(hud.eaten, level.goal)}/{level.goal}</b>
            </span>
            <span>
              时间<b>{hud.seconds}s</b>
            </span>
            <span
              className={hud.goldLeft != null ? "snake-speed-gold" : undefined}
              data-gold={hud.goldLeft != null || undefined}
              data-urgent={(hud.goldLeft != null && hud.goldLeft <= 2) || undefined}
              data-fast={hud.speedTier === "极速" || hud.speedTier === "很快" || undefined}
              title={
                hud.goldLeft != null
                  ? `速度 ${hud.speedTier}（${hud.speedMs}ms）${hud.nextSpeed ? ` · ${hud.nextSpeed}` : " · 已达极速"} · 金食 ${hud.goldLeft.toFixed(1)}s（×3）`
                  : hud.nextSpeed
                    ? `步进 ${hud.speedMs}ms · ${hud.nextSpeed}`
                    : `步进 ${hud.speedMs}ms · 已达极速`
              }
            >
              速度<b className={hud.speedTier === "极速" || hud.speedTier === "很快" ? "game-tip--alert" : undefined}>{hud.speedTier}</b>
              {hud.goldLeft != null && (
                <>
                  <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
                  金食<b className={hud.goldLeft <= 2 ? "game-tip--alert" : undefined}>{hud.goldLeft.toFixed(1)}s</b>
                  {hud.nextSpeed ? <small style={{ marginLeft: 4, opacity: 0.7 }}>{hud.nextSpeed}</small> : <small style={{ marginLeft: 4, opacity: 0.55 }}>极速</small>}
                </>
              )}
            </span>
            {hud.wrap && (
              <span
                className="snake-wrap-badge"
                data-edge={hud.edgeHint?.includes("将从") || undefined}
                data-near={hud.edgeHint?.includes("靠") || undefined}
                title={hud.edgeHint ?? "本关边缘可穿墙"}
              >
                穿墙
                {hud.edgeHint?.includes("将从") ? (
                  <small className="snake-wrap-badge__warn"> · 将穿出</small>
                ) : hud.edgeHint?.includes("靠") ? (
                  <small className="snake-wrap-badge__near"> · 近缘</small>
                ) : (
                  <small> · 开</small>
                )}
              </span>
            )}
          </>
        ) : (
          <>
            <span>
              无尽模式 分数<b>{hud.score}</b>
            </span>
            <span>
              最高<b>{best ?? 0}</b>
            </span>
            <span
              className={hud.goldLeft != null ? "snake-speed-gold snake-gold-timer" : undefined}
              data-gold={hud.goldLeft != null || undefined}
              data-urgent={(hud.goldLeft != null && hud.goldLeft <= 2) || undefined}
              data-fast={hud.speedTier === "极速" || hud.speedTier === "很快" || undefined}
              title={
                hud.goldLeft != null
                  ? `速度 ${hud.speedTier}（${hud.speedMs}ms）${hud.nextSpeed ? ` · ${hud.nextSpeed}` : " · 已达极速"} · 金食 ${hud.goldLeft.toFixed(1)}s（×3）`
                  : hud.nextSpeed
                    ? `步进 ${hud.speedMs}ms · ${hud.nextSpeed}`
                    : `步进 ${hud.speedMs}ms · 已达极速`
              }
            >
              速度<b className={hud.speedTier === "极速" || hud.speedTier === "很快" ? "game-tip--alert" : undefined}>{hud.speedTier}</b>
              {hud.goldLeft != null && (
                <>
                  <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
                  金食<b className={hud.goldLeft <= 2 ? "game-tip--alert" : undefined}>{hud.goldLeft.toFixed(1)}s</b>
                  {hud.nextSpeed ? <small style={{ marginLeft: 4, opacity: 0.7 }}>{hud.nextSpeed}</small> : <small style={{ marginLeft: 4, opacity: 0.55 }}>极速</small>}
                </>
              )}
            </span>
          </>
        )}
        <span className="spacer" />
        {(phase === "running" || phase === "paused") && (
          <button type="button" className="game-btn" onClick={toggle}>
            {phase === "running" ? "暂停" : "继续"}
          </button>
        )}
      </div>
      {(phase === "running" || phase === "paused") && (
        <p
          className={
            hud.wrap || hud.speedTier === "极速" || hud.speedTier === "很快" || hud.goldLeft != null
              ? "game-tip game-tip--alert"
              : "game-tip"
          }
          aria-live="polite"
        >
          {`${
            hud.wrap && hud.goldLeft != null
              ? `金食+穿墙：金色 ${hud.goldLeft.toFixed(1)}s（一个顶三个） · ${hud.edgeHint ?? "穿墙开"} · 档 ${hud.speedTier}`
              : hud.wrap && hud.edgeHint?.includes("将从")
              ? `穿墙预警：下一格将穿出 · ${hud.edgeHint} · 档 ${hud.speedTier}`
              : hud.wrap && hud.edgeHint?.includes("靠")
              ? `穿墙近缘：${hud.edgeHint} · 档 ${hud.speedTier}（${hud.speedMs}ms）`
              : hud.wrap && hud.edgeHint
              ? `穿墙+加速：${hud.edgeHint} · 档位 ${hud.speedTier}（${hud.speedMs}ms）`
              : hud.wrap
                ? `穿墙模式 · 加速档 ${hud.speedTier}（${hud.speedMs}ms）${level ? ` · 目标 ${Math.min(hud.eaten, level.goal)}/${level.goal}` : " · 无尽"}`
                : hud.goldLeft != null
                  ? `金色食物 ${hud.goldLeft.toFixed(1)}s（一个顶三个） · 档 ${hud.speedTier}（${hud.speedMs}ms）`
                : level
                  ? `第 ${levelNo} 关·${level.name}：目标 ${Math.min(hud.eaten, level.goal)}/${level.goal}${level.bonus ? " · 有金色食物" : ""} · 加速档 ${hud.speedTier}（${hud.speedMs}ms）`
                  : `无尽模式 · 加速档 ${hud.speedTier}（${hud.speedMs}ms）· 越高分越快`
          }${
            hud.wrap && hud.goldLeft != null
              ? (hud.nextSpeed ? ` · ${hud.nextSpeed}` : "")
              : (hud.nextSpeed ? ` · ${hud.nextSpeed}` : " · 已达极速") + (hud.goldLeft != null && !hud.wrap ? "" : hud.goldLeft != null ? ` · 金色食物 ${hud.goldLeft.toFixed(1)}s` : "")
          }`}
        </p>
      )}
      <div className="game-stage" {...swipe}>
        <canvas ref={canvas} aria-label={level ? `贪吃蛇第 ${levelNo} 关` : "贪吃蛇无尽模式"} />
        {phase !== "running" && (
          <div className="game-overlay">
            {phase === "select" && (
              <LevelSelect title="选择关卡" levels={levelCards} unlocked={unlocked ?? 1} onPick={(i) => start({ kind: "level", index: i })}>
                <button type="button" className="game-btn" onClick={() => start({ kind: "endless" })}>
                  无尽模式{best ? ` · 最高 ${best}` : ""}
                </button>
              </LevelSelect>
            )}
            {phase === "ready" && (
              <>
                <strong>{level ? `第 ${levelNo} 关 · ${level.name}` : "无尽模式"}</strong>
                <p>
                  {level ? `吃够 ${level.goal} 个过关` : "没有终点，越吃越快"}
                  {level?.wrap ? "，边缘可穿墙——头从对面出来" : ""}
                  {(level ? level.bonus : true) ? "，金色食物一个顶三个" : ""}
                </p>
                <button type="button" className="game-btn game-btn--primary" onClick={() => setPhase("running")}>
                  开始
                </button>
              </>
            )}
            {phase === "paused" && (
              <>
                <strong>暂停中</strong>
                <span style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="game-btn game-btn--primary" onClick={toggle}>
                    继续
                  </button>
                  <button type="button" className="game-btn" onClick={() => setPhase("select")}>
                    选关
                  </button>
                </span>
              </>
            )}
            {phase === "over" && (
              <>
                <strong>{record ? "新纪录！" : "撞上了"}</strong>
                <p>{level ? `吃到 ${Math.min(hud.eaten, level.goal)}/${level.goal}` : `这局得了 ${hud.score} 分`}</p>
                <span style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="game-btn game-btn--primary" onClick={retry}>
                    再试一次
                  </button>
                  <button type="button" className="game-btn" onClick={() => setPhase("select")}>
                    选关
                  </button>
                </span>
              </>
            )}
            {phase === "clear" && (
              <>
                <strong>{hasNext ? "过关！" : "全部通关！"}</strong>
                <p>
                  用时 {hud.seconds} 秒{record ? "，本关最快" : ""}
                </p>
                <span style={{ display: "flex", gap: 8 }}>
                  {hasNext && (
                    <button type="button" className="game-btn game-btn--primary" onClick={next}>
                      下一关
                    </button>
                  )}
                  <button type="button" className={hasNext ? "game-btn" : "game-btn game-btn--primary"} onClick={() => setPhase("select")}>
                    选关
                  </button>
                </span>
              </>
            )}
          </div>
        )}
      </div>
      {/* 触屏：加大 dpad，按下即转向 + 轻震；附带暂停 */}
      <div className="dpad dpad--lg" aria-label="方向键">
        {PAD.map(([dir, arrow, label]) => (
          <button
            key={dir}
            type="button"
            aria-label={label}
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
            aria-label={phase === "paused" ? "继续" : "暂停"}
            onPointerDown={(e) => {
              e.preventDefault();
              toggle();
            }}
          >
            {phase === "paused" ? "继续" : "暂停"}
          </button>
        )}
      </div>
      <p className="game-hint when-mouse">穿墙关顶栏有「穿墙」标记；贴边时提示将从哪一侧出现。</p>
      <p className="game-hint when-touch">方向键或在棋盘上滑动转向；也可点暂停。穿墙关贴边时有出口提示。</p>
    </div>
  );
}
