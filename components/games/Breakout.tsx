"use client";

import { useEffect, useEffectEvent, useRef, useState, type PointerEvent } from "react";
import { useKeys, useRecord } from "./input";

// 逻辑坐标，画的时候按画布宽度缩放
const W = 480;
const H = 600;
const PADDLE_Y = H - 36;
const PADDLE_H = 12;
const BALL_R = 7;
const COLS = 10;
const BRICK_H = 18;
const BRICK_GAP = 5;
const BRICK_TOP = 64;
const BRICK_W = (W - 24 - (COLS - 1) * BRICK_GAP) / COLS;
const ROW_COLORS = ["#ff5c8a", "#ff3ea5", "#c49bff", "#6fa8ff", "#7af5ff", "#7af5c0", "#ffe066", "#ffb86b", "#ff9ed2"];

type Brick = { x: number; y: number; color: string; alive: boolean };
type Phase = "ready" | "aim" | "running" | "paused" | "over";
type Game = {
  bricks: Brick[];
  paddle: number;
  paddleW: number;
  target: number | null;
  ball: { x: number; y: number; vx: number; vy: number };
  score: number;
  lives: number;
  level: number;
};
type Stats = Pick<Game, "score" | "lives" | "level">;

const speed = (level: number) => 330 + level * 35;

function layBricks(level: number): Brick[] {
  const rows = Math.min(4 + level, ROW_COLORS.length);
  const out: Brick[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < COLS; c++)
      out.push({ x: 12 + c * (BRICK_W + BRICK_GAP), y: BRICK_TOP + r * (BRICK_H + BRICK_GAP), color: ROW_COLORS[r], alive: true });
  return out;
}

function newGame(): Game {
  return {
    bricks: layBricks(1),
    paddle: W / 2,
    paddleW: 88,
    target: null,
    ball: { x: W / 2, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 },
    score: 0,
    lives: 3,
    level: 1,
  };
}

/** 球回到球拍上等待发球 */
function rest(g: Game) {
  g.ball = { x: g.paddle, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 };
}

function launch(g: Game) {
  const a = (Math.random() - 0.5) * 0.6;
  const v = speed(g.level);
  g.ball.vx = v * Math.sin(a);
  g.ball.vy = -v * Math.cos(a);
}

type StepResult = "ok" | "miss" | "clear" | "hit";

/** 推进 dt 秒；拆成小步，保证每步位移小于球半径，不会穿过砖块 */
function step(g: Game, dt: number, held: number): StepResult {
  const half = g.paddleW / 2;
  if (g.target !== null) g.paddle += (g.target - g.paddle) * Math.min(1, dt * 18);
  g.paddle += held * 560 * dt;
  g.paddle = Math.max(half, Math.min(W - half, g.paddle));
  const b = g.ball;
  if (b.vx === 0 && b.vy === 0) {
    b.x = g.paddle;
    return "ok";
  }

  let result: StepResult = "ok";
  const n = Math.ceil((Math.hypot(b.vx, b.vy) * dt) / (BALL_R * 0.8));
  for (let i = 0; i < n; i++) {
    const px = b.x;
    const py = b.y;
    b.x += (b.vx * dt) / n;
    b.y += (b.vy * dt) / n;

    if (b.x < BALL_R || b.x > W - BALL_R) {
      b.x = Math.max(BALL_R, Math.min(W - BALL_R, b.x));
      b.vx = -b.vx;
    }
    if (b.y < BALL_R) {
      b.y = BALL_R;
      b.vy = Math.abs(b.vy);
    }
    if (b.y > H + BALL_R * 2) return "miss";

    // 球拍：按击中位置决定反弹角度，越靠边越斜
    if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && py + BALL_R <= PADDLE_Y + 4 && Math.abs(b.x - g.paddle) <= half + BALL_R) {
      const k = Math.max(-1, Math.min(1, (b.x - g.paddle) / half));
      const v = speed(g.level);
      b.vx = v * Math.sin(k * 1.05);
      b.vy = -v * Math.cos(k * 1.05);
      b.y = PADDLE_Y - BALL_R;
    }

    for (const br of g.bricks) {
      if (!br.alive) continue;
      const cx = Math.max(br.x, Math.min(b.x, br.x + BRICK_W));
      const cy = Math.max(br.y, Math.min(b.y, br.y + BRICK_H));
      if ((b.x - cx) ** 2 + (b.y - cy) ** 2 > BALL_R * BALL_R) continue;
      br.alive = false;
      g.score += 10 * g.level;
      result = "hit";
      // 上一步球在砖块左右两侧就反转横向速度，否则反转纵向
      const wasSide = px < br.x || px > br.x + BRICK_W;
      const wasAboveBelow = py < br.y || py > br.y + BRICK_H;
      if (wasSide && !wasAboveBelow) b.vx = -b.vx;
      else b.vy = -b.vy;
      break;
    }
    if (result === "hit" && g.bricks.every((br) => !br.alive)) return "clear";
  }
  return result;
}

function draw(el: HTMLCanvasElement | null, g: Game) {
  const ctx = el?.getContext("2d");
  if (!el || !ctx) return;
  const k = el.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, W, H);

  for (const br of g.bricks) {
    if (!br.alive) continue;
    ctx.fillStyle = br.color;
    ctx.beginPath();
    ctx.roundRect(br.x, br.y, BRICK_W, BRICK_H, 4);
    ctx.fill();
    ctx.fillStyle = "rgb(255 255 255 / 0.22)";
    ctx.fillRect(br.x + 4, br.y + 3, BRICK_W - 8, 3);
  }

  const accent = getComputedStyle(el).getPropertyValue("--accent").trim() || "#ff3ea5";
  ctx.shadowColor = accent;
  ctx.shadowBlur = 16;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(g.paddle - g.paddleW / 2, PADDLE_Y, g.paddleW, PADDLE_H, PADDLE_H / 2);
  ctx.fill();
  ctx.shadowColor = "#fff";
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(g.ball.x, g.ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

export default function Breakout() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game>(newGame());
  const held = useRef({ left: false, right: false });
  const [phase, setPhase] = useState<Phase>("ready");
  const [stats, setStats] = useState<Stats>({ score: 0, lives: 3, level: 1 });
  const [record, setRecord] = useState(false);
  const [best, submitBest] = useRecord("breakout", (next, prev) => next > prev);

  const sync = () => {
    const { score, lives, level } = game.current;
    setStats({ score, lives, level });
  };

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.clientWidth * Math.min(devicePixelRatio, 2));
      el.width = w;
      el.height = Math.round((w * H) / W);
      draw(el, game.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onResult = useEffectEvent((r: StepResult) => {
    const g = game.current;
    if (r === "hit") sync();
    else if (r === "clear") {
      g.level++;
      g.bricks = layBricks(g.level);
      g.paddleW = Math.max(60, 88 - (g.level - 1) * 4);
      rest(g);
      sync();
      setPhase("aim");
    } else if (r === "miss") {
      g.lives--;
      sync();
      if (g.lives <= 0) {
        setPhase("over");
        setRecord(g.score > 0 && submitBest(g.score));
      } else {
        rest(g);
        setPhase("aim");
      }
    }
  });

  // 发球前球拍也能动，所以 aim 状态也要跑循环
  useEffect(() => {
    draw(canvas.current, game.current);
    if (phase !== "running" && phase !== "aim") return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const h = held.current;
      const r = step(game.current, dt, Number(h.right) - Number(h.left));
      draw(canvas.current, game.current);
      if (r !== "ok") onResult(r);
      if (r === "ok" || r === "hit") raf = requestAnimationFrame(frame);
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
    setPhase("aim");
  };

  const serve = () => {
    if (phase === "ready") setPhase("aim");
    else if (phase === "aim") {
      launch(game.current);
      setPhase("running");
    }
  };

  const toggle = () => {
    if (phase === "over") restart();
    else if (phase === "running") setPhase("paused");
    else if (phase === "paused") setPhase(game.current.ball.vy === 0 ? "aim" : "running");
    else serve();
  };

  useKeys((key) => {
    if (key === "ArrowLeft" || key === "a" || key === "A") held.current.left = true;
    else if (key === "ArrowRight" || key === "d" || key === "D") held.current.right = true;
    else if (key === " ") {
      if (phase === "ready" || phase === "aim") serve();
      else toggle();
    } else if (key === "p" || key === "P" || key === "Escape") toggle();
    else if (key === "Enter" && phase === "over") restart();
    else return false;
    if (phase === "ready" && key !== " ") setPhase("aim");
    return true;
  });

  useEffect(() => {
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") held.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") held.current.right = false;
    };
    window.addEventListener("keyup", up);
    return () => window.removeEventListener("keyup", up);
  }, []);

  // 鼠标或手指在棋盘上的横向位置就是球拍的位置
  const aimAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    game.current.target = ((e.clientX - r.left) / r.width) * W;
  };

  return (
    <div className="game">
      <div className="game-bar">
        <span>
          分数<b>{stats.score}</b>
        </span>
        <span>
          关卡<b>{stats.level}</b>
        </span>
        <span>
          生命<b>{"♥".repeat(Math.max(0, stats.lives)) || "0"}</b>
        </span>
        <span className="spacer" />
        <span>
          最高<b>{best ?? 0}</b>
        </span>
      </div>
      <div
        className="game-stage breakout"
        onPointerMove={aimAt}
        onPointerDown={(e) => {
          aimAt(e);
          if (phase === "aim") serve();
        }}
      >
        <canvas ref={canvas} aria-label={`打砖块，第 ${stats.level} 关，${stats.score} 分`} />
        {phase === "aim" && <p className="breakout-hint">点击棋盘或按空格发球</p>}
        {(phase === "ready" || phase === "paused" || phase === "over") && (
          <div className="game-overlay">
            {phase === "ready" && (
              <>
                <strong>打砖块</strong>
                <p>移动球拍接住球，打掉所有砖块进入下一关</p>
                <button type="button" className="game-btn game-btn--primary" onClick={() => setPhase("aim")}>
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
                <strong>{record ? "新纪录！" : "球没接住"}</strong>
                <p>
                  {stats.score} 分 · 打到第 {stats.level} 关
                </p>
                <button type="button" className="game-btn game-btn--primary" onClick={restart}>
                  再来一局
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
