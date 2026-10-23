"use client";

import { useEffect, useEffectEvent, useRef, useState, type PointerEvent } from "react";
import { useKeys, useRecord } from "./input";

const W = 10;
const H = 20;

type Kind = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
type Cell = [number, number];
type Piece = { kind: Kind; cells: Cell[]; x: number; y: number };
type Phase = "ready" | "running" | "paused" | "over";
type Game = { board: (Kind | null)[]; piece: Piece; bag: Kind[]; score: number; lines: number; level: number };
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
  return { kind, cells: SHAPES[kind], x: kind === "O" ? 4 : 3, y: kind === "I" ? -1 : 0 };
}

function newGame(): Game {
  const bag = refill(refill([]));
  return { board: Array(W * H).fill(null), piece: spawn(bag.shift()!), bag, score: 0, lines: 0, level: 1 };
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
  const kept = rows.filter((r) => r.some((c) => c === null));
  const cleared = H - kept.length;
  if (cleared) {
    g.board = [...Array(cleared * W).fill(null), ...kept.flat()];
    g.score += LINE_SCORE[cleared] * g.level;
    g.lines += cleared;
    g.level = 1 + Math.floor(g.lines / 10);
  }
  if (g.bag.length < 7) g.bag = refill(g.bag);
  g.piece = spawn(g.bag.shift()!);
  return !collides(g.board, g.piece);
}

function draw(el: HTMLCanvasElement | null, g: Game, showPiece: boolean) {
  const ctx = el?.getContext("2d");
  if (!el || !ctx) return;
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
    if (y < 0) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3, s * 0.18);
    ctx.fill();
    ctx.fillStyle = "rgb(255 255 255 / 0.25)";
    ctx.fillRect(x * s + s * 0.2, y * s + s * 0.18, s * 0.6, s * 0.12);
    ctx.globalAlpha = 1;
  };

  g.board.forEach((k, i) => k && block(i % W, Math.floor(i / W), COLORS[k]));
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
  for (const [cx, cy] of piece.cells) block(piece.x + cx, piece.y + cy, COLORS[piece.kind]);
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

export default function Tetris() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [initial] = useState(newGame);
  const game = useRef<Game>(initial);
  const [phase, setPhase] = useState<Phase>("ready");
  const [stats, setStats] = useState<Stats>({ score: 0, lines: 0, level: 1, next: initial.bag[0] });
  const [record, setRecord] = useState(false);
  const [best, submitBest] = useRecord("tetris", (next, prev) => next > prev);
  const repeat = useRef<number | null>(null);

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
    const g = game.current;
    sync();
    setPhase("over");
    setRecord(g.score > 0 && submitBest(g.score));
  };

  const tick = useEffectEvent(() => {
    const g = game.current;
    if (move(g, 0, 1)) return;
    if (!lock(g)) return gameOver();
    sync();
  });

  useEffect(() => {
    draw(canvas.current, game.current, phase !== "ready");
    if (phase !== "running") return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      acc = Math.min(acc + now - last, 1000);
      last = now;
      while (acc >= gravity(game.current.level)) {
        acc -= gravity(game.current.level);
        tick();
      }
      draw(canvas.current, game.current, true);
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

  const restart = () => {
    game.current = newGame();
    sync();
    setRecord(false);
    setPhase("running");
  };

  const act = (a: Action) => {
    if (phase === "over") return;
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
      move(g, 0, d);
      g.score += d * 2;
      if (!lock(g)) return gameOver();
    }
    sync();
    draw(canvas.current, g, true);
  };

  const toggle = () => {
    if (phase === "over") restart();
    else setPhase(phase === "running" ? "paused" : "running");
  };

  useKeys((key) => {
    const map: Record<string, Action> = {
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
    if (map[key]) act(map[key]);
    else if (key === "p" || key === "P" || key === "Escape") toggle();
    else if (key === "Enter" && phase === "over") restart();
    else return false;
    return true;
  });

  // 触屏按钮：按住左右和下会连续触发
  const stopRepeat = () => {
    if (repeat.current) clearInterval(repeat.current);
    repeat.current = null;
  };
  useEffect(() => stopRepeat, []);
  const press = (a: Action) => (e: PointerEvent) => {
    e.preventDefault();
    act(a);
    stopRepeat();
    if (!REPEAT[a]) return;
    const started = Date.now();
    repeat.current = window.setInterval(() => Date.now() - started > 170 && act(a), 50);
  };

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
        <div className="game-stage tetris-board">
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
      <div className="pad pad--5">
        {PAD.map(([a, icon, label]) => (
          <button
            key={a}
            type="button"
            aria-label={label}
            className={icon.length > 1 ? "pad__text" : undefined}
            onPointerDown={press(a)}
            onPointerUp={stopRepeat}
            onPointerLeave={stopRepeat}
            onPointerCancel={stopRepeat}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}
