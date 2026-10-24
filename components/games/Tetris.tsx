"use client";

import { useEffect, useEffectEvent, useRef, useState, type PointerEvent } from "react";
import { buzz, useKeys, useRecord, useSwipe, type Dir } from "./input";

const W = 10;
const H = 20;

type Kind = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
type Cell = [number, number];
/** id 只在出新块时变，用来判断画面上的缓动位置要不要直接跳到新块 */
type Piece = { id: number; kind: Kind; cells: Cell[]; x: number; y: number };
type Phase = "ready" | "running" | "paused" | "over";
/** 消行动画：rows 是被消掉的行（消之前的行号），shift[y] 是新棋盘第 y 行往下掉了几行 */
type ClearFx = { rows: number[]; shift: number[]; at: number };
/** 硬降拖影 */
type DropFx = { cells: Cell[]; x: number; fromY: number; toY: number; color: string; at: number };
type Game = {
  board: (Kind | null)[];
  piece: Piece;
  bag: Kind[];
  /** side hold slot; null when empty */
  hold: Kind | null;
  /** false after a hold until current piece locks */
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  clearFx: ClearFx | null;
  dropFx: DropFx | null;
  /** remaining lock delay ms while grounded; 0 = not locking */
  lockMs: number;
  /** how many times lock timer was reset for this piece */
  lockResets: number;
  /** last successful input was rotate (for T-Spin check) */
  lastWasRotate: boolean;
  /** latest clear announcement */
  clearTip: string | null;
  /** consecutive line-clear locks */
  combo: number;
  /** peak combo this run */
  comboPeak: number;
  /** last clear was difficult (Tetris / T-Spin) — arms Back-to-Back */
  b2bArmed: boolean;
};
type Stats = {
  score: number;
  lines: number;
  level: number;
  next: Kind[];
  hold: Kind | null;
  canHold: boolean;
  clearTip: string | null;
  combo: number;
  comboPeak: number;
  b2b: boolean;
  /** ghost soft-drop distance in cells */
  ghost: number;
  /** lines until next level (10-line steps) */
  linesToLevel: number;
};

const KINDS: Kind[] = ["I", "O", "T", "S", "Z", "J", "L"];
// 每种方块在自己旋转框里的初始格子
const SHAPES: Record<Kind, Cell[]> = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};
const BOX: Record<Kind, number> = { I: 4, O: 2, T: 3, S: 3, Z: 3, J: 3, L: 3 };
const COLORS: Record<Kind, string> = {
  I: "#7af5ff",
  O: "#ffe066",
  T: "#c49bff",
  S: "#7af5c0",
  Z: "#ff5c8a",
  J: "#6fa8ff",
  L: "#ffb86b",
};
// 旋转被挡住时依次尝试的偏移（简化版踢墙）
const KICKS: Cell[] = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]];
const LINE_SCORE = [0, 100, 300, 500, 800];
const CLEAR_MS = 260;
const DROP_MS = 180;
// 按住左右、下：先等 DAS 毫秒，之后每 ARR 毫秒移动一格（比系统按键重复的半秒停顿跟手得多）
const DAS = 140;
const ARR = 40;
/** Guideline-ish lock delay: grounded piece waits before locking */
const LOCK_DELAY = 500;
/** max lock-timer resets per piece (move/rotate while grounded) */
const MAX_LOCK_RESETS = 15;
let pieceId = 0;

const gravity = (level: number) => Math.max(70, 800 - (level - 1) * 75);

/** 7 个一袋随机打乱，保证不会连续很久等不到长条 */
function refill(bag: Kind[]) {
  const next = [...KINDS];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return [...bag, ...next];
}

function spawn(kind: Kind): Piece {
  return { id: ++pieceId, kind, cells: SHAPES[kind], x: kind === "O" ? 4 : 3, y: kind === "I" ? -1 : 0 };
}

function newGame(): Game {
  const bag = refill(refill([]));
  return {
    board: Array(W * H).fill(null),
    piece: spawn(bag.shift()!),
    bag,
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    clearFx: null,
    dropFx: null,
    lockMs: 0,
    lockResets: 0,
    lastWasRotate: false,
    clearTip: null,
    combo: 0,
    comboPeak: 0,
    b2bArmed: false,
  };
}

function collides(board: Game["board"], p: Piece, dx = 0, dy = 0, cells = p.cells) {
  return cells.some(([cx, cy]) => {
    const x = p.x + cx + dx;
    const y = p.y + cy + dy;
    return x < 0 || x >= W || y >= H || (y >= 0 && board[y * W + x] !== null);
  });
}

function move(g: Game, dx: number, dy: number) {
  if (collides(g.board, g.piece, dx, dy)) return false;
  g.piece = { ...g.piece, x: g.piece.x + dx, y: g.piece.y + dy };
  if (dx !== 0) g.lastWasRotate = false;
  return true;
}

function rotate(g: Game) {
  const n = BOX[g.piece.kind];
  if (n === 2) return;
  const cells = g.piece.cells.map(([x, y]): Cell => [n - 1 - y, x]);
  const kick = KICKS.find(([dx, dy]) => !collides(g.board, g.piece, dx, dy, cells));
  if (kick) {
    g.piece = { ...g.piece, cells, x: g.piece.x + kick[0], y: g.piece.y + kick[1] };
    g.lastWasRotate = true;
  }
}

const dropDistance = (g: Game) => {
  let d = 0;
  while (!collides(g.board, g.piece, 0, d + 1)) d++;
  return d;
};

const grounded = (g: Game) => collides(g.board, g.piece, 0, 1);


const CLEAR_NAMES = ["", "单消", "双消！", "三消！", "Tetris！！"];

/** 3+ of 4 corners around T center occupied/OOB => T-Spin candidate */
function tSpinCorners(g: Game) {
  const cx = g.piece.x + 1;
  const cy = g.piece.y + 1;
  let n = 0;
  for (const [x, y] of [
    [cx - 1, cy - 1],
    [cx + 1, cy - 1],
    [cx - 1, cy + 1],
    [cx + 1, cy + 1],
  ] as Cell[]) {
    if (x < 0 || x >= W || y >= H || (y >= 0 && g.board[y * W + x] !== null)) n++;
  }
  return n;
}

/** Reset lock timer after a successful shift/rotate that stays grounded */
function touchLock(g: Game) {
  if (!grounded(g)) {
    g.lockMs = 0;
    g.lockResets = 0;
    return;
  }
  if (g.lockResets < MAX_LOCK_RESETS) {
    g.lockMs = LOCK_DELAY;
    g.lockResets += 1;
  } else if (g.lockMs <= 0) {
    g.lockMs = LOCK_DELAY;
  }
}

/** Hold / swap current piece; once per piece until lock */
function swapHold(g: Game) {
  if (!g.canHold) return false;
  const cur = g.piece.kind;
  if (g.hold == null) {
    if (g.bag.length < 7) g.bag = refill(g.bag);
    g.hold = cur;
    g.piece = spawn(g.bag.shift()!);
  } else {
    const kept = g.hold;
    g.hold = cur;
    g.piece = spawn(kept);
  }
  g.canHold = false;
  g.lockMs = 0;
  g.lockResets = 0;
  return true;
}

/** 固定当前方块、消行、出下一块；返回 false 表示堆到顶了 */
function lock(g: Game) {
  const { piece } = g;
  const tspin = piece.kind === "T" && g.lastWasRotate && tSpinCorners(g) >= 3;
  for (const [cx, cy] of piece.cells) {
    const y = piece.y + cy;
    if (y < 0) return false;
    g.board[y * W + piece.x + cx] = piece.kind;
  }
  const rows: (Kind | null)[][] = [];
  for (let y = 0; y < H; y++) rows.push(g.board.slice(y * W, y * W + W));
  const keptRows = rows.flatMap((r, y) => (r.some((c) => c === null) ? [y] : []));
  const cleared = H - keptRows.length;
  if (cleared) {
    g.board = [...Array(cleared * W).fill(null), ...keptRows.flatMap((y) => rows[y])];
    const shift = Array<number>(H).fill(0);
    keptRows.forEach((oldY, i) => (shift[cleared + i] = cleared + i - oldY));
    g.clearFx = { rows: rows.flatMap((r, y) => (r.every((c) => c !== null) ? [y] : [])), shift, at: performance.now() };
    const difficult = tspin || cleared >= 4;
    const b2b = difficult && g.b2bArmed;
    g.combo += 1;
    if (g.combo > g.comboPeak) g.comboPeak = g.combo;
    const base = LINE_SCORE[cleared] * g.level;
    let gained = tspin ? base + 400 * g.level * cleared : base;
    if (b2b) gained = Math.floor(gained * 1.5);
    if (g.combo > 1) gained += 50 * (g.combo - 1) * g.level;
    g.score += gained;
    g.lines += cleared;
    g.level = 1 + Math.floor(g.lines / 10);
    const core = tspin
      ? cleared >= 2
        ? `T-Spin ${CLEAR_NAMES[cleared]}`
        : "T-Spin 单消！"
      : CLEAR_NAMES[cleared];
    const parts = [b2b ? "Back-to-Back" : null, core, g.combo > 1 ? `连消 ×${g.combo}` : null].filter(Boolean);
    g.clearTip = parts.join(" · ");
    g.b2bArmed = difficult;
  } else {
    g.clearTip = null;
    g.combo = 0;
  }
  g.lastWasRotate = false;
  if (g.bag.length < 7) g.bag = refill(g.bag);
  g.piece = spawn(g.bag.shift()!);
  g.canHold = true;
  g.lockMs = 0;
  g.lockResets = 0;
  return !collides(g.board, g.piece);
}

const easeOut = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

/**
 * view 是当前方块在画面上的位置（可以是小数）：下落时连续往下滑，左右移动时缓动过去。
 * 不传就画在逻辑位置上（暂停、结束等静止画面）
 */
function draw(el: HTMLCanvasElement | null, g: Game, showPiece: boolean, view?: { x: number; y: number }) {
  const ctx = el?.getContext("2d");
  if (!el || !ctx) return;
  const now = performance.now();
  const s = el.width / W;
  ctx.clearRect(0, 0, el.width, el.height);
  ctx.strokeStyle = "rgb(255 255 255 / 0.05)";
  ctx.lineWidth = 1;
  for (let x = 1; x < W; x++) {
    ctx.beginPath();
    ctx.moveTo(x * s, 0);
    ctx.lineTo(x * s, el.height);
    ctx.stroke();
  }
  for (let y = 1; y < H; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * s);
    ctx.lineTo(el.width, y * s);
    ctx.stroke();
  }

  const block = (x: number, y: number, color: string, alpha = 1) => {
    if (y < -0.99) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3, s * 0.18);
    ctx.fill();
    ctx.fillStyle = "rgb(255 255 255 / 0.25)";
    ctx.fillRect(x * s + s * 0.2, y * s + s * 0.18, s * 0.6, s * 0.12);
    ctx.globalAlpha = 1;
  };

  // 消行：被消的行闪一下白光，上面的行从原来的位置滑下来
  const clear = g.clearFx && now - g.clearFx.at < CLEAR_MS ? g.clearFx : null;
  const cp = clear ? (now - clear.at) / CLEAR_MS : 1;
  if (clear) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * (1 - cp)})`;
    for (const y of clear.rows) ctx.fillRect(0, y * s, el.width, s);
  }
  g.board.forEach((k, i) => {
    if (!k) return;
    const y = Math.floor(i / W);
    block(i % W, y - (clear ? clear.shift[y] * (1 - easeOut(cp)) : 0), COLORS[k]);
  });

  // 硬降：从原位置到落点留一道渐隐的拖影
  const drop = g.dropFx && now - g.dropFx.at < DROP_MS ? g.dropFx : null;
  if (drop && drop.toY > drop.fromY) {
    const q = (now - drop.at) / DROP_MS;
    const cols = new Map<number, number>();
    for (const [cx, cy] of drop.cells) cols.set(cx, Math.min(cols.get(cx) ?? Infinity, cy));
    for (const [cx, cy] of cols) {
      const top = (drop.fromY + cy) * s;
      const bottom = (drop.toY + cy) * s;
      const grad = ctx.createLinearGradient(0, top, 0, bottom);
      grad.addColorStop(0, "rgba(255, 255, 255, 0)");
      grad.addColorStop(1, drop.color);
      ctx.globalAlpha = 0.45 * (1 - q);
      ctx.fillStyle = grad;
      ctx.fillRect((drop.x + cx) * s + s * 0.2, top, s * 0.6, bottom - top);
      ctx.globalAlpha = 1;
    }
  }

  if (!showPiece) return;
  const { piece } = g;
  const ghost = dropDistance(g);
  ctx.strokeStyle = COLORS[piece.kind];
  ctx.globalAlpha = 0.45;
  for (const [cx, cy] of piece.cells) {
    const y = piece.y + cy + ghost;
    if (y >= 0) ctx.strokeRect((piece.x + cx) * s + 2.5, y * s + 2.5, s - 5, s - 5);
  }
  ctx.globalAlpha = 1;
  const px = view?.x ?? piece.x;
  const py = view?.y ?? piece.y;
  const locking = g.lockMs > 0 && !collides(g.board, g.piece, 0, 1);
  const lockAlpha = locking ? 0.55 + 0.45 * Math.abs(Math.sin(now / 90)) : 1;
  for (const [cx, cy] of piece.cells) block(px + cx, py + cy, COLORS[piece.kind], lockAlpha);
}

type Action = "left" | "right" | "rotate" | "down" | "drop" | "hold";
const PAD: [Action, string, string][] = [
  ["left", "←", "左移"],
  ["rotate", "旋转", "旋转"],
  ["down", "↓", "下移"],
  ["drop", "落底", "直接落下"],
  ["right", "→", "右移"],
  ["hold", "Hold", "暂存 / 交换"],
];
const REPEAT: Partial<Record<Action, true>> = { left: true, right: true, down: true };
const KEY_ACTION: Record<string, Action> = {
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
  ArrowUp: "rotate",
  w: "rotate",
  W: "rotate",
  x: "rotate",
  X: "rotate",
  ArrowDown: "down",
  s: "down",
  S: "down",
  " ": "drop",
  c: "hold",
  C: "hold",
  Shift: "hold",
};

export default function Tetris() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [initial] = useState(newGame);
  const game = useRef<Game>(initial);
  const [phase, setPhase] = useState<Phase>("ready");
  const [stats, setStats] = useState<Stats>({
    score: 0,
    lines: 0,
    level: 1,
    next: initial.bag.slice(0, 3),
    hold: null,
    canHold: true,
    clearTip: null,
    combo: 0,
    comboPeak: 0,
    b2b: false,
    ghost: 0,
    linesToLevel: 10,
  });
  const [record, setRecord] = useState(false);
  const [best, submitBest] = useRecord("tetris", (next, prev) => next > prev);
  const repeat = useRef<number | null>(null);
  const holding = useRef<Action | null>(null);
  // 当前方块在画面上的位置（小数），每帧缓动追向逻辑位置
  const view = useRef({ id: -1, x: 0, y: 0 });
  // 堆到顶之后到 effect 清理之前，循环和长按连发都不能再推进游戏
  const dead = useRef(false);

  const sync = () => {
    const g = game.current;
    setStats({
      score: g.score,
      lines: g.lines,
      level: g.level,
      next: g.bag.slice(0, 3),
      hold: g.hold,
      canHold: g.canHold,
      clearTip: g.clearTip,
      combo: g.combo,
      comboPeak: g.comboPeak,
      b2b: g.b2bArmed,
      ghost: dropDistance(g),
      linesToLevel: 10 - (g.lines % 10),
    });
  };

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.clientWidth * Math.min(devicePixelRatio, 2));
      el.width = w;
      el.height = w * 2;
      draw(el, game.current, true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const gameOver = () => {
    dead.current = true;
    buzz([40, 40, 80]);
    const g = game.current;
    sync();
    setPhase("over");
    setRecord(g.score > 0 && submitBest(g.score));
  };

  /** 固定当前方块并结算；堆到顶时结束游戏 */
  const settle = () => {
    const g = game.current;
    const before = g.lines;
    if (!lock(g)) return gameOver();
    if (g.lines > before) {
      const n = g.lines - before;
      buzz(
        g.clearTip?.includes("Back-to-Back") || g.clearTip?.startsWith("T-Spin") || n >= 4
          ? [20, 30, 20, 40]
          : g.combo > 1
            ? [15, 25, 15]
            : 25,
      );
    }
    sync();
  };

  const onLockExpire = useEffectEvent(() => {
    settle();
  });

  const tick = useEffectEvent(() => {
    if (dead.current) return;
    const g = game.current;
    if (move(g, 0, 1)) {
      g.lockMs = 0;
      g.lockResets = 0;
      return;
    }
    // grounded: start lock delay if needed; actual settle happens in the frame loop
    if (g.lockMs <= 0) {
      g.lockMs = LOCK_DELAY;
      g.lockResets = 0;
    }
  });

  useEffect(() => {
    draw(canvas.current, game.current, phase !== "ready");
    if (phase !== "running") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      acc = Math.min(acc + now - last, 1000);
      last = now;
      while (acc >= gravity(game.current.level) && !dead.current) {
        acc -= gravity(game.current.level);
        tick();
      }
      let g = game.current;
      let canFall = !collides(g.board, g.piece, 0, 1);
      // lock delay: grounded piece counts down in real time, then settles
      if (!canFall && !dead.current) {
        if (g.lockMs <= 0) {
          g.lockMs = LOCK_DELAY;
          g.lockResets = 0;
        } else {
          g.lockMs -= dt * 1000;
          if (g.lockMs <= 0) {
            g.lockMs = 0;
            onLockExpire();
            if (dead.current) {
              draw(canvas.current, game.current, true);
              return;
            }
            g = game.current;
          }
        }
      } else if (canFall) {
        g.lockMs = 0;
        g.lockResets = 0;
      }
      canFall = !collides(g.board, g.piece, 0, 1);
      // 平滑下落：在逻辑位置上加上这一格已经走过的比例；落到底时不再往下滑
      const targetY = g.piece.y + (canFall ? acc / gravity(g.level) : 0);
      const v = view.current;
      if (v.id !== g.piece.id) Object.assign(v, { id: g.piece.id, x: g.piece.x, y: targetY });
      const k = 1 - Math.exp(-dt * 30);
      v.x += (g.piece.x - v.x) * k;
      v.y += (targetY - v.y) * k;
      // 缓动不能让方块看起来穿进下面的方块
      v.y = Math.min(v.y, g.piece.y + (canFall ? 1 : 0));
      draw(canvas.current, g, true, v);
      if (!dead.current) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onHide = () => document.hidden && setPhase("paused");
    document.addEventListener("visibilitychange", onHide);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [phase]);

  const restart = () => {
    dead.current = false;
    game.current = newGame();
    sync();
    setRecord(false);
    setPhase("running");
  };

  const act = (a: Action) => {
    if (phase === "over" || dead.current) return;
    if (phase !== "running") {
      setPhase("running");
      return;
    }
    const g = game.current;
    if (a === "left") {
      if (move(g, -1, 0)) touchLock(g);
    } else if (a === "right") {
      if (move(g, 1, 0)) touchLock(g);
    } else if (a === "rotate") {
      const before = g.piece;
      rotate(g);
      if (g.piece !== before) touchLock(g);
    } else if (a === "hold") {
      g.lastWasRotate = false;
      if (swapHold(g)) buzz(10);
    } else if (a === "down") {
      if (move(g, 0, 1)) {
        g.score += 1;
        g.lockMs = 0;
        g.lockResets = 0;
      } else if (grounded(g)) {
        // soft-drop into ground: hasten lock
        g.lockMs = Math.min(g.lockMs > 0 ? g.lockMs : LOCK_DELAY, 120);
      }
    } else {
      const d = dropDistance(g);
      const { cells, x, y, kind } = g.piece;
      move(g, 0, d);
      g.dropFx = { cells, x, fromY: view.current.id === g.piece.id ? view.current.y : y, toY: y + d, color: COLORS[kind], at: performance.now() };
      g.score += d * 2;
      g.lockMs = 0;
      settle();
    }
    if (dead.current) return;
    // 画面由动画循环每帧重画，这里只更新分数
    sync();
  };
  // 长按连发的定时器在按下时创建，通过 ref 调用最新的 act，避免用到按下那一刻的旧状态
  const actRef = useRef(act);
  useEffect(() => {
    actRef.current = act;
  });

  const toggle = () => {
    if (phase === "over") restart();
    else setPhase(phase === "running" ? "paused" : "running");
  };


  // 键盘和触屏按钮共用：按下立即动一次，左右和下按住超过 DAS 后每 ARR 毫秒连发
  const stopRepeat = () => {
    if (repeat.current) clearInterval(repeat.current);
    repeat.current = null;
    holding.current = null;
  };
  const hold = (a: Action) => {
    act(a);
    stopRepeat();
    if (!REPEAT[a]) return;
    holding.current = a;
    let ticks = 0;
    repeat.current = window.setInterval(() => ++ticks * ARR > DAS && actRef.current(a), ARR);
  };
  const press = (a: Action) => (e: PointerEvent) => {
    e.preventDefault();
    hold(a);
  };

  // swipe-tetris-mobile: hard-drop on swipe down
  const swipe = useSwipe((dir: Dir) => {
    if (phase !== "running") return;
    if (dir === "left") hold("left");
    else if (dir === "right") hold("right");
    else if (dir === "down") {
      hold("drop");
      buzz(12);
      window.setTimeout(stopRepeat, 80);
      return;
    } else hold("rotate");
    window.setTimeout(stopRepeat, 120);
  });


  useKeys((key, repeat) => {
    const a = KEY_ACTION[key];
    if (a) {
      // 系统的按键重复一律忽略：左右和下由 hold() 自己连发，旋转和落底按一次只动一次
      if (!repeat) hold(a);
    } else if (key === "p" || key === "P" || key === "Escape") {
      if (!repeat) toggle();
    }
    else if (key === "Enter" && phase === "over") restart();
    else return false;
    return true;
  });
  // 松开按住的那个键、或者窗口失焦时停止连发
  useEffect(() => {
    const release = () => {
      if (repeat.current) clearInterval(repeat.current);
      repeat.current = null;
      holding.current = null;
    };
    const up = (e: KeyboardEvent) => {
      if (KEY_ACTION[e.key] && KEY_ACTION[e.key] === holding.current) release();
    };
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    return () => {
      release();
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
    };
  }, []);

  return (
    <div className="game">
      <div className="game-bar">
        <span>
          分数<b>{stats.score}</b>
          <span
            className="tetris-score-bar"
            data-hot={stats.score >= 5000 || undefined}
            data-huge={stats.score >= 10000 || undefined}
            title={`本局分数 ${stats.score}（满刻度 10000）`}
            aria-label={`分数 ${stats.score}`}
          >
            <i style={{ width: `${Math.min(100, Math.round((stats.score / 10000) * 100))}%` }} />
          </span>
        </span>
        <span>
          行<b>{stats.lines}</b>
          <span
            className="tetris-lines-bar"
            data-hot={stats.lines >= 40 || undefined}
            title={`本局消行 ${stats.lines}（满刻度按 50）`}
            aria-label={`消行 ${stats.lines}`}
          >
            <i style={{ width: `${Math.min(100, Math.round((stats.lines / 50) * 100))}%` }} />
          </span>
          <span
            className="tetris-sprint-bar"
            data-done={stats.lines >= 40 || undefined}
            data-near={stats.lines >= 30 && stats.lines < 40 || undefined}
            title={`40 行短冲 ${Math.min(40, stats.lines)}/40`}
            aria-label={`短冲进度 ${Math.min(40, stats.lines)} 之 40`}
          >
            <i
              style={{
                width: `${Math.min(100, Math.round((stats.lines / 40) * 100))}%`,
              }}
            />
          </span>
        </span>
        <span>
          等级<b>{stats.level}</b>
          <span
            className="tetris-level-bar"
            data-hot={stats.level >= 10 || undefined}
            data-huge={stats.level >= 15 || undefined}
            title={`等级 ${stats.level}（满刻度按 15）`}
            aria-label={`等级 ${stats.level}`}
          >
            <i style={{ width: `${Math.min(100, Math.round((stats.level / 15) * 100))}%` }} />
          </span>
        </span>
        {(phase === "running" || phase === "paused") ? (
          <span
            className={
              stats.canHold === false
                ? "tetris-hold-hud tetris-combo-hold tetris-hold-preview tetris-level-eta-host tetris-hold-hud--cool"
                : "tetris-hold-hud tetris-combo-hold tetris-hold-preview tetris-level-eta-host game-tip--alert"
            }
            data-ready={stats.canHold || undefined}
            data-cool={stats.canHold === false || undefined}
            data-combo={stats.combo > 1 || undefined}
            data-preview={stats.next[0] || undefined}
            title={`连消|Hold：连消 ×${stats.combo}${stats.comboPeak > 1 ? ` · 峰 ${stats.comboPeak}` : ""} · B2B ${stats.b2b ? "就绪" : "—"} · Hold ${stats.canHold === false ? "冷却" : "可用"}${stats.hold ? `/${stats.hold}` : "/空"} · 距升级 ${stats.linesToLevel} · 预览 ${stats.next[0] ?? "—"} · 幽灵 ${stats.ghost} 格`}
          >
            连消<b className={stats.combo > 1 ? "game-tip--alert" : undefined}>×{stats.combo}</b>
            <span
              className="tetris-combo-now-bar"
              data-hot={stats.combo >= 5 || undefined}
              data-warm={stats.combo >= 2 && stats.combo < 5 || undefined}
              title={`当前连消 ×${stats.combo}（满刻度按 8）`}
              aria-label={`当前连消 ${stats.combo}`}
            >
              <i
                className="tetris-combo-now-bar__fill"
                style={{
                  width: `${Math.min(100, Math.round((stats.combo / 8) * 100))}%`,
                }}
              />
            </span>
            <span
              className="tetris-ghost-depth-bar"
              data-deep={stats.ghost >= 12 || undefined}
              data-shallow={stats.ghost > 0 && stats.ghost <= 3 || undefined}
              title={`幽灵落点深度 ${stats.ghost} 格（满刻度按 20）`}
              aria-label={`幽灵深度 ${stats.ghost} 格`}
            >
              <i
                className="tetris-ghost-depth-bar__fill"
                style={{
                  width: `${Math.min(100, Math.round((stats.ghost / 20) * 100))}%`,
                }}
              />
            </span>
            <span
              className="tetris-eff-bar"
              data-hot={stats.lines > 0 && stats.score / stats.lines >= 300 || undefined}
              data-low={stats.lines >= 5 && stats.score / Math.max(1, stats.lines) < 80 || undefined}
              title={
                stats.lines > 0
                  ? `行均分 ${Math.round(stats.score / stats.lines)}（满刻度按 400）`
                  : "行均分 —"
              }
              aria-label={
                stats.lines > 0
                  ? `每行约 ${Math.round(stats.score / stats.lines)} 分`
                  : "行均分未知"
              }
            >
              <i
                className="tetris-eff-bar__fill"
                style={{
                  width: `${
                    stats.lines > 0
                      ? Math.min(100, Math.round((stats.score / stats.lines / 400) * 100))
                      : 0
                  }%`,
                }}
              />
            </span>
            <span
              className="tetris-pressure-bar"
              data-hot={stats.ghost > 0 && stats.ghost <= 3 || undefined}
              data-safe={stats.ghost >= 12 || undefined}
              title={`堆高压力（幽灵越浅越高）深度 ${stats.ghost}（满压按深度 0）`}
              aria-label={`堆高压力，幽灵深度 ${stats.ghost}`}
            >
              <i
                className="tetris-pressure-bar__fill"
                style={{
                  width: `${Math.min(100, Math.round(((20 - Math.min(20, stats.ghost)) / 20) * 100))}%`,
                }}
              />
            </span>
            <span
              className="tetris-level-fill-bar"
              data-near={stats.linesToLevel <= 3 || undefined}
              data-fresh={stats.linesToLevel >= 9 || undefined}
              title={`本级进度 ${(10 - stats.linesToLevel) % 10}/10（距升级 ${stats.linesToLevel} 行）`}
              aria-label={`本级进度 ${(10 - stats.linesToLevel) % 10} 之 10`}
            >
              <i
                className="tetris-level-fill-bar__fill"
                style={{
                  width: `${Math.min(100, Math.round((((10 - stats.linesToLevel) % 10) / 10) * 100))}%`,
                }}
              />
            </span>
            <span
              className="tetris-score-level-bar"
              data-hot={stats.score / Math.max(1, stats.level) >= 2000 || undefined}
              data-cold={stats.level >= 3 && stats.score / Math.max(1, stats.level) < 600 || undefined}
              title={`级均分 ${Math.round(stats.score / Math.max(1, stats.level))}（满刻度 3000）`}
              aria-label={`级均分 ${Math.round(stats.score / Math.max(1, stats.level))}`}
            >
              <i
                className="tetris-score-level-bar__fill"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((stats.score / Math.max(1, stats.level) / 3000) * 100),
                  )}%`,
                }}
              />
            </span>
            {stats.comboPeak > 1 ? (
              <small style={{ marginLeft: 4, opacity: 0.7 }} title={`本局连消峰值 ×${stats.comboPeak}`}>
                峰{stats.comboPeak}
              </small>
            ) : null}
            {stats.comboPeak > 1 ? (
              <span
                className="tetris-combo-peak-bar"
                data-peak={stats.combo >= stats.comboPeak && stats.combo > 0 || undefined}
                data-hot={stats.combo >= 5 || undefined}
                title={`连消相对峰值 ${stats.combo}/${stats.comboPeak}`}
                aria-label={`连消相对峰值 ${stats.combo}/${stats.comboPeak}`}
              >
                <i
                  className="tetris-combo-peak-bar__fill"
                  style={{
                    width: `${Math.min(100, Math.round((stats.combo / Math.max(1, stats.comboPeak)) * 100))}%`,
                  }}
                />
              </span>
            ) : null}
            <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
            B2B<b className={stats.b2b ? "game-tip--alert" : undefined}>{stats.b2b ? "就绪" : "—"}</b>
            <span
              className="tetris-b2b-bar"
              data-armed={stats.b2b || undefined}
              title={stats.b2b ? "B2B 已武装：下一次困难消行享加成" : "B2B 未武装"}
              aria-label={stats.b2b ? "B2B armed" : "B2B idle"}
            >
              <i style={{ width: stats.b2b ? "100%" : "8%" }} />
            </span>
            <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
            Hold
            <b className={stats.canHold === false ? undefined : "game-tip--alert"}>
              {stats.canHold === false ? "冷却" : "可用"}
            </b>
            {stats.hold ? <small style={{ marginLeft: 4, opacity: 0.75 }}>{stats.hold}</small> : <small style={{ marginLeft: 4, opacity: 0.55 }}>空</small>}
            <span
              className="tetris-hold-bar"
              data-cool={stats.canHold === false || undefined}
              data-ready={stats.canHold || undefined}
              title={stats.canHold === false ? "Hold 条：冷却中" : "Hold 条：可用"}
              aria-label={stats.canHold === false ? "Hold 冷却" : "Hold 可用"}
            >
              <i style={{ width: stats.canHold === false ? "28%" : "100%" }} />
            </span>
            <span
              className="tetris-hold-coolbar"
              data-cool={stats.canHold === false || undefined}
              data-ready={stats.canHold || undefined}
              title={stats.canHold === false ? "Hold 冷却：落地后恢复" : "Hold 可用"}
              aria-hidden="true"
            >
              <i style={{ ["--hold-cool-pct" as string]: stats.canHold === false ? "100%" : "0%" } as { [key: string]: string }} />
            </span>
            <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
            预览
            <b className={stats.next[0] === "I" || stats.next[0] === "T" ? "game-tip--alert" : undefined}>
              {stats.next[0] ?? "—"}
            </b>
            <span
              className="tetris-preview-bar"
              data-prime={stats.next[0] === "I" || stats.next[0] === "T" || undefined}
              data-i={stats.next[0] === "I" || undefined}
              title={`预览 ${stats.next[0] ?? "空"}（I/T 高亮）`}
              aria-label={`预览 ${stats.next[0] ?? "空"}`}
            >
              <i
                style={{
                  width: `${
                    stats.next[0] === "I"
                      ? 100
                      : stats.next[0] === "T"
                        ? 80
                        : stats.next[0]
                          ? 40
                          : 8
                  }%`,
                }}
              />
            </span>
            <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
            <span
              className="tetris-ghost-tier"
              data-tier={stats.ghost <= 2 ? "land" : stats.ghost <= 6 ? "low" : stats.ghost <= 12 ? "mid" : "high"}
              data-land={stats.ghost <= 2 || undefined}
              title={`幽灵落距 ${stats.ghost} 格（land≤2 / low≤6 / mid≤12 / high>12）`}
            >
              幽灵<b className={stats.ghost <= 2 ? "game-tip--alert" : undefined}>{stats.ghost}</b>
              <small className="tetris-ghost-tier__label" style={{ marginLeft: 4, opacity: 0.75 }}>
                {stats.ghost <= 2 ? "land" : stats.ghost <= 6 ? "low" : stats.ghost <= 12 ? "mid" : "high"}
              </small>
              <span className="tetris-ghost-bar" aria-hidden="true">
                <i style={{ width: `${Math.min(100, Math.round((stats.ghost / 20) * 100))}%` }} />
              </span>
            </span>
            <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
            <span
              className="tetris-level-eta tetris-level-eta--tier"
              data-near={stats.linesToLevel <= 2 || undefined}
              data-tier={
                stats.linesToLevel <= 2 ? "near" : stats.linesToLevel <= 5 ? "mid" : "far"
              }
              title={`距升级色阶：还差 ${stats.linesToLevel} 行（near≤2 / mid≤5 / far>5）`}
            >
              距升级<b className={stats.linesToLevel <= 2 ? "game-tip--alert" : undefined}>{stats.linesToLevel}</b>
              <small className="tetris-level-eta__tier" style={{ marginLeft: 4, opacity: 0.75 }}>
                {stats.linesToLevel <= 2 ? "near" : stats.linesToLevel <= 5 ? "mid" : "far"}
              </small>
              <span
                className="tetris-level-fill"
                data-near={stats.linesToLevel <= 2 || undefined}
                data-tier={stats.linesToLevel <= 2 ? "near" : stats.linesToLevel <= 5 ? "mid" : "far"}
                title={`升级进度 ${(10 - stats.linesToLevel) % 10}/10（还差 ${stats.linesToLevel}）`}
                aria-label={`升级进度 ${10 - stats.linesToLevel}/10`}
              >
                <i
                  className="tetris-level-fill__bar"
                  style={{
                    width: `${Math.min(100, Math.round(((10 - stats.linesToLevel) / 10) * 100))}%`,
                  }}
                />
              </span>
            </span>
          </span>
        ) : (
          <span title="连消与 B2B 同屏：连续消行累加；Tetris/T-Spin 武装 B2B">
            连消<b className={stats.combo > 1 ? "game-tip--alert" : undefined}>×{stats.combo}</b>
            <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
            B2B<b className={stats.b2b ? "game-tip--alert" : undefined}>{stats.b2b ? "就绪" : "—"}</b>
          </span>
        )}
        <span className="spacer" />
        {(phase === "running" || phase === "paused") && (
          <button type="button" className="game-btn" onClick={toggle}>
            {phase === "running" ? "暂停" : "继续"}
          </button>
        )}
      </div>
      {stats.clearTip && phase === "running" && (
        <p className="game-tip game-tip--alert" aria-live="polite">
          {stats.clearTip}
        </p>
      )}
      {phase === "running" && !stats.clearTip && (
        <p className={stats.b2b || stats.combo > 1 || stats.canHold || stats.next[0] === "I" || stats.next[0] === "T" ? "game-tip game-tip--alert" : "game-tip"} aria-live="polite">
          {`连消|Hold：×${stats.combo} · B2B ${stats.b2b ? "就绪" : "未武装"} · Hold ${stats.canHold === false ? "冷却条满" : "可用"}${stats.hold ? `/${stats.hold}` : "/空"} · 预览 ${stats.next[0] ?? "—"}${stats.next.length > 1 ? ` · ${stats.next.join("→")}` : ""}`}
          {" · 幽灵 "}
          {stats.ghost}
          {" 格"}
          {` · 距升级色阶 ${stats.linesToLevel} 行（${stats.linesToLevel <= 2 ? "near" : stats.linesToLevel <= 5 ? "mid" : "far"}）`}
        </p>
      )}
      <div className="tetris">
        <div className="game-stage tetris-board" {...swipe}>
          <canvas ref={canvas} aria-label={`俄罗斯方块，${stats.score} 分`} />
          {phase !== "running" && (
            <div className="game-overlay">
              {phase === "ready" && (
                <>
                  <strong>俄罗斯方块</strong>
                  <p>右侧预览下一块与队列；消一行得分，一次消得越多分越高</p>
                  <button type="button" className="game-btn game-btn--primary" onClick={() => setPhase("running")}>
                    开始
                  </button>
                </>
              )}
              {phase === "paused" && (
                <>
                  <strong>暂停中</strong>
                  <button type="button" className="game-btn game-btn--primary" onClick={toggle}>
                    继续
                  </button>
                </>
              )}
              {phase === "over" && (
                <>
                  <strong>{record ? "新纪录！" : "堆到顶了"}</strong>
                  <p>
                    {stats.score} 分 · 消了 {stats.lines} 行
                  </p>
                  <button type="button" className="game-btn game-btn--primary" onClick={restart}>
                    再来一局
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="tetris-side">
          <span title={stats.canHold === false ? "Hold 冷却：落地后再可交换" : "C / Shift：与当前块交换；落地前每块限一次"}>
            暂存
            <small style={{ marginLeft: 6, opacity: 0.8 }}>{stats.canHold === false ? "冷却" : "可用"}</small>
            <span
              className="tetris-hold-coolbar tetris-hold-coolbar--side"
              data-cool={stats.canHold === false || undefined}
              data-ready={stats.canHold || undefined}
              aria-hidden="true"
            >
              <i style={{ ["--hold-cool-pct" as string]: stats.canHold === false ? "100%" : "0%" } as { [key: string]: string }} />
            </span>
          </span>
          <div
            className="tetris-next"
            data-dim={stats.canHold === false ? "true" : undefined}
            aria-label={stats.hold ? `暂存 ${stats.hold} 形` : "暂存为空"}
          >
            {Array.from({ length: 8 }, (_, i) => {
              const kind = stats.hold;
              const on = kind ? SHAPES[kind].some(([x, y]) => x === i % 4 && y === Math.floor(i / 4)) : false;
              return <i key={i} style={on && kind ? { background: COLORS[kind] } : undefined} />;
            })}
          </div>
          <span title={`预览队列：${stats.next.join(" → ")}（7-bag）`}>
            下一个
            {stats.next[0] ? <small style={{ marginLeft: 6, opacity: 0.8 }}>首{stats.next[0]}</small> : null}
          </span>
          <div className="tetris-next-queue" aria-label={`下一个：${stats.next.join("、")}`} data-preview-tip="true">
            {stats.next.map((kind, qi) => (
              <div key={`${kind}-${qi}`} className="tetris-next" data-queue={qi === 0 ? "primary" : "next"}>
                {Array.from({ length: 8 }, (_, i) => {
                  const on = SHAPES[kind].some(([x, y]) => x === i % 4 && y === Math.floor(i / 4));
                  return <i key={i} style={on ? { background: COLORS[kind] } : undefined} />;
                })}
              </div>
            ))}
          </div>
          <span>最高</span>
          <b>{best ?? 0}</b>
        </div>
      </div>
      <div className="pad pad--tetris">
        {PAD.map(([a, icon, label]) => (
          <button
            key={a}
            type="button"
            aria-label={label}
            className={a === "drop" ? "pad__text pad__drop" : icon.length > 1 ? "pad__text" : undefined}
            style={{ gridArea: a }}
            onPointerDown={press(a)}
            onPointerUp={stopRepeat}
            onPointerLeave={stopRepeat}
            onPointerCancel={stopRepeat}
          >
            {icon}
          </button>
        ))}
        <button
          type="button"
          aria-label={phase === "paused" ? "继续" : "暂停"}
          className="pad__text"
          style={{ gridArea: "pause" }}
          onClick={toggle}
        >
          {phase === "paused" ? "继续" : "暂停"}
        </button>
      </div>
      <p className="game-hint when-mouse">右侧看下一个与暂存；连续消行有连消加成；Tetris / T-Spin 可累积 Back-to-Back。旋转卡住 T 形再消行可 T-Spin。</p>
      <p className="game-hint when-touch">棋盘滑动：左右移动，上滑旋转，下滑落底；下方 Hold 暂存，↓ 加速，可点暂停。消行与 T-Spin 有顶部提示。</p>
    </div>
  );
}
