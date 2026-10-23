"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { KEY_DIR, useKeys, useRecord, useSwipe, type Dir } from "./input";

const N = 20;
const FOOD = "#7af5ff";

type P = { x: number; y: number };
type Phase = "ready" | "running" | "paused" | "over";
type Game = { snake: P[]; dir: Dir; queue: Dir[]; food: P | null; score: number };

const VEC: Record<Dir, P> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

function newGame(): Game {
  const snake = [
    { x: 7, y: 10 },
    { x: 6, y: 10 },
    { x: 5, y: 10 },
  ];
  return { snake, dir: "right", queue: [], food: placeFood(snake), score: 0 };
}

function placeFood(snake: P[]): P | null {
  const taken = new Set(snake.map((p) => p.y * N + p.x));
  const free: number[] = [];
  for (let i = 0; i < N * N; i++) if (!taken.has(i)) free.push(i);
  if (!free.length) return null;
  const i = free[Math.floor(Math.random() * free.length)];
  return { x: i % N, y: Math.floor(i / N) };
}

/** 前进一格；撞墙、撞到自己或者铺满棋盘时返回 false */
function step(g: Game) {
  g.dir = g.queue.shift() ?? g.dir;
  const head = g.snake[0];
  const next = { x: head.x + VEC[g.dir].x, y: head.y + VEC[g.dir].y };
  if (next.x < 0 || next.y < 0 || next.x >= N || next.y >= N) return false;
  const eating = g.food !== null && next.x === g.food.x && next.y === g.food.y;
  const body = eating ? g.snake : g.snake.slice(0, -1);
  if (body.some((p) => p.x === next.x && p.y === next.y)) return false;
  g.snake = [next, ...body];
  if (eating) {
    g.score++;
    g.food = placeFood(g.snake);
    if (!g.food) return false;
  }
  return true;
}

// 每吃一个快一点，最快 65ms 一格
const interval = (score: number) => Math.max(65, 150 - score * 3);

function draw(el: HTMLCanvasElement | null, g: Game) {
  const ctx = el?.getContext("2d");
  if (!el || !ctx) return;
  const css = getComputedStyle(el);
  const accent = css.getPropertyValue("--accent").trim() || "#ff3ea5";
  const fg = css.getPropertyValue("--fg").trim() || "#fff";
  const cell = el.width / N;

  ctx.clearRect(0, 0, el.width, el.height);
  ctx.fillStyle = "rgb(255 255 255 / 0.035)";
  for (let y = 0; y < N; y++) for (let x = (y + 1) % 2; x < N; x += 2) ctx.fillRect(x * cell, y * cell, cell, cell);

  if (g.food) {
    ctx.fillStyle = FOOD;
    ctx.shadowColor = FOOD;
    ctx.shadowBlur = cell * 0.8;
    ctx.beginPath();
    ctx.arc((g.food.x + 0.5) * cell, (g.food.y + 0.5) * cell, cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowColor = accent;
  ctx.shadowBlur = cell * 0.5;
  const pad = cell * 0.08;
  g.snake.forEach((p, i) => {
    ctx.fillStyle = i === 0 ? fg : accent;
    ctx.globalAlpha = i === 0 ? 1 : Math.max(0.45, 1 - i / (g.snake.length * 1.5));
    ctx.beginPath();
    ctx.roundRect(p.x * cell + pad, p.y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.28);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

export default function Snake() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game>(newGame());
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [record, setRecord] = useState(false);
  const [best, submitBest] = useRecord("snake", (next, prev) => next > prev);

  // 画布按显示尺寸和像素比设置分辨率
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

  const gameOver = useEffectEvent((final: number) => {
    setPhase("over");
    setRecord(final > 0 && submitBest(final));
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
      while (acc >= interval(g.score)) {
        acc -= interval(g.score);
        const before = g.score;
        if (!step(g)) {
          draw(canvas.current, g);
          gameOver(g.score);
          return;
        }
        if (g.score !== before) setScore(g.score);
      }
      draw(canvas.current, g);
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
    setScore(0);
    setRecord(false);
    setPhase("running");
  };

  const turn = (d: Dir) => {
    if (phase === "over") return;
    const g = game.current;
    const last = g.queue.at(-1) ?? g.dir;
    if (d !== last && d !== OPPOSITE[last] && g.queue.length < 3) g.queue.push(d);
    if (phase !== "running") setPhase("running");
  };

  const toggle = () => {
    if (phase === "over") restart();
    else setPhase(phase === "running" ? "paused" : "running");
  };

  useKeys((key) => {
    const dir = KEY_DIR[key];
    if (dir) turn(dir);
    else if (key === " " || key === "p" || key === "P") toggle();
    else if (key === "Enter" && phase === "over") restart();
    else return false;
    return true;
  });

  const swipe = useSwipe(turn);

  return (
    <div className="game">
      <div className="game-bar">
        <span>
          分数<b>{score}</b>
        </span>
        <span>
          最高<b>{best ?? 0}</b>
        </span>
        <span className="spacer" />
        {(phase === "running" || phase === "paused") && (
          <button type="button" className="game-btn" onClick={toggle}>
            {phase === "running" ? "暂停" : "继续"}
          </button>
        )}
      </div>
      <div className="game-stage" {...swipe}>
        <canvas ref={canvas} aria-label={`贪吃蛇棋盘，当前 ${score} 分`} />
        {phase !== "running" && (
          <div className="game-overlay">
            {phase === "ready" && (
              <>
                <strong>准备好了吗</strong>
                <p>按方向键或在棋盘上滑动开始</p>
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
                <strong>{record ? "新纪录！" : "撞上了"}</strong>
                <p>这局得了 {score} 分</p>
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
