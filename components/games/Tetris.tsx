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
  score: number;
  lines: number;
  level: number;
  clearFx: ClearFx | null;
  dropFx: DropFx | null;
};
type Stats = { score: number; lines: number; level: number; next: Kind };

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
    score: 0,
    lines: 0,
    level: 1,
    clearFx: null,
    dropFx: null,
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
  return true;
}

function rotate(g: Game) {
  const n = BOX[g.piece.kind];
  if (n === 2) return;
  const cells = g.piece.cells.map(([x, y]): Cell => [n - 1 - y, x]);
  const kick = KICKS.find(([dx, dy]) => !collides(g.board, g.piece, dx, dy, cells));
  if (kick) g.piece = { ...g.piece, cells, x: g.piece.x + kick[0], y: g.piece.y + kick[1] };
}

const dropDistance = (g: Game) => {
  let d = 0;
  while (!collides(g.board, g.piece, 0, d + 1)) d++;
  return d;
};

/** 固定当前方块、消行、出下一块；返回 false 表示堆到顶了 */
function lock(g: Game) {
  const { piece } = g;
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
    g.score += LINE_SCORE[cleared] * g.level;
    g.lines += cleared;
    g.level = 1 + Math.floor(g.lines / 10);
  }
  if (g.bag.length < 7) g.bag = refill(g.bag);
  g.piece = spawn(g.bag.shift()!);
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
  for (const [cx, cy] of piece.cells) block(px + cx, py + cy, COLORS[piece.kind]);
}

type Action = "left" | "right" | "rotate" | "down" | "drop";
const PAD: [Action, string, string][] = [
  ["left", "←", "左移"],
  ["rotate", "旋转", "旋转"],
  ["down", "↓", "下移"],
  ["drop", "落底", "直接落下"],
  ["right", "→", "右移"],
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
};

export default function Tetris() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [initial] = useState(newGame);
  const game = useRef<Game>(initial);
  const [phase, setPhase] = useState<Phase>("ready");
  const [stats, setStats] = useState<Stats>({ score: 0, lines: 0, level: 1, next: initial.bag[0] });
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
    setStats({ score: g.score, lines: g.lines, level: g.level, next: g.bag[0] });
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
    if (g.lines > before) buzz(25);
    sync();
  };

  const tick = useEffectEvent(() => {
    if (!dead.current && !move(game.current, 0, 1)) settle();
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
      // 平滑下落：在逻辑位置上加上这一格已经走过的比例；落到底时不再往下滑
      const g = game.current;
      const canFall = !collides(g.board, g.piece, 0, 1);
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
    if (a === "left") move(g, -1, 0);
    else if (a === "right") move(g, 1, 0);
    else if (a === "rotate") rotate(g);
    else if (a === "down") {
      if (move(g, 0, 1)) g.score += 1;
    } else {
      const d = dropDistance(g);
      const { cells, x, y, kind } = g.piece;
      move(g, 0, d);
      g.dropFx = { cells, x, fromY: view.current.id === g.piece.id ? view.current.y : y, toY: y + d, color: COLORS[kind], at: performance.now() };
      g.score += d * 2;
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

  // swipe-tetris-mobile: board swipe maps to pad actions
  const swipe = useSwipe((dir: Dir) => {
    if (phase !== "running") return;
    if (dir === "left") hold("left");
    else if (dir === "right") hold("right");
    else if (dir === "down") hold("down");
    else hold("rotate");
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
        </span>
        <span>
          行<b>{stats.lines}</b>
        </span>
        <span>
          等级<b>{stats.level}</b>
        </span>
        <span className="spacer" />
        {(phase === "running" || phase === "paused") && (
          <button type="button" className="game-btn" onClick={toggle}>
            {phase === "running" ? "暂停" : "继续"}
          </button>
        )}
      </div>
      <div className="tetris">
        <div className="game-stage tetris-board" {...swipe}>
          <canvas ref={canvas} aria-label={`俄罗斯方块，${stats.score} 分`} />
          {phase !== "running" && (
            <div className="game-overlay">
              {phase === "ready" && (
                <>
                  <strong>俄罗斯方块</strong>
                  <p>消掉一行得分，一次消得越多分越高</p>
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
          <span>下一个</span>
          <div className="tetris-next" aria-label={`下一个是 ${stats.next} 形`}>
            {Array.from({ length: 8 }, (_, i) => {
              const on = SHAPES[stats.next].some(([x, y]) => x === i % 4 && y === Math.floor(i / 4));
              return <i key={i} style={on ? { background: COLORS[stats.next] } : undefined} />;
            })}
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
            className={icon.length > 1 ? "pad__text" : undefined}
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
      <p className="game-hint when-touch">棋盘上可滑动：左右移动，上滑旋转，下滑加速。</p>
    </div>
  );
}
