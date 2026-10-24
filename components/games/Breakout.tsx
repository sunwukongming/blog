"use client";

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { BREAKOUT_LEVELS } from "./breakoutLevels";
import { buzz, higher, saveRecord, setBuzzMuted, useBuzzMuted, useKeys, useRecord } from "./input";
import LevelSelect from "./LevelSelect";

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
const HP_COLORS = ["", "", "#cfd3e6", "#ffd95e"];
const ITEM_FALL = 150;
const WIDE_TIME = 12;
const SLOW_TIME = 10;
const MAX_LIVES = 5;

type Item = "W" | "S" | "L" | "M";
type Ball = { x: number; y: number; vx: number; vy: number };
const ITEM_LOOK: Record<Item, { label: string; color: string }> = {
  W: { label: "宽", color: "#7af5c0" },
  S: { label: "慢", color: "#6fa8ff" },
  L: { label: "命", color: "#ff5c8a" },
  M: { label: "多", color: "#ffe066" },
};

type Brick = { x: number; y: number; hp: number; maxHp: number; metal: boolean; item?: Item; color: string };
type Drop = { x: number; y: number; kind: Item };
type Phase = "select" | "aim" | "running" | "paused" | "over" | "clear" | "done";
type Game = {
  level: number;
  bricks: Brick[];
  drops: Drop[];
  paddle: number;
  target: number | null;
  balls: Ball[];
  score: number;
  lives: number;
  time: number;
  wideUntil: number;
  slowUntil: number;
  combo: number;
  bestCombo: number;
};
type Hud = { score: number; lives: number; level: number; wide: boolean; slow: boolean; wideLeft: number; slowLeft: number; balls: number; brickLeft: number; brickTotal: number; progress: number; combo: number; bestCombo: number; ballSpeed: number; paddleW: number; dropsAir: number; metalLeft: number };


/** breakable bricks still alive (metal ignored) */
function brickStats(g: Game) {
  const breakable = g.bricks.filter((br) => !br.metal);
  const total = breakable.length;
  const left = breakable.filter((br) => br.hp > 0).length;
  const progress = total === 0 ? 100 : Math.round(((total - left) / total) * 100);
  return { brickLeft: left, brickTotal: total, progress };
}

const baseSpeed = (level: number) => 320 + level * 25;
const ballSpeed = (g: Game) => baseSpeed(g.level) * (g.time < g.slowUntil ? 0.7 : 1);
const paddleW = (g: Game) => Math.max(64, 88 - g.level * 3) * (g.time < g.wideUntil ? 1.5 : 1);

function layBricks(level: number): Brick[] {
  const out: Brick[] = [];
  BREAKOUT_LEVELS[level].rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === ".") return;
      const hp = ch === "2" ? 2 : ch === "3" ? 3 : 1;
      out.push({
        x: 12 + c * (BRICK_W + BRICK_GAP),
        y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
        hp,
        maxHp: hp,
        metal: ch === "#",
        item: ch === "W" || ch === "S" || ch === "L" || ch === "M" ? ch : undefined,
        color: ROW_COLORS[r % ROW_COLORS.length],
      });
    }),
  );
  return out;
}

function newGame(level: number, carry?: Pick<Game, "score" | "lives" | "bestCombo">): Game {
  return {
    level,
    bricks: layBricks(level),
    drops: [],
    paddle: W / 2,
    target: null,
    balls: [{ x: W / 2, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 }],
    score: carry?.score ?? 0,
    lives: carry?.lives ?? 3,
    time: 0,
    wideUntil: 0,
    slowUntil: 0,
    combo: 0,
    bestCombo: carry?.bestCombo ?? 0,
  };
}

function launch(g: Game) {
  const a = (Math.random() - 0.5) * 0.6;
  const v = ballSpeed(g);
  const b = g.balls[0] ?? { x: g.paddle, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 };
  b.x = g.paddle;
  b.y = PADDLE_Y - BALL_R;
  b.vx = v * Math.sin(a);
  b.vy = -v * Math.cos(a);
  g.balls = [b];
}

function splitBall(g: Game) {
  const src = g.balls.find((b) => b.vy !== 0 || b.vx !== 0) ?? g.balls[0];
  if (!src) return;
  const v = ballSpeed(g);
  const base = Math.atan2(src.vx, -src.vy || 1);
  for (const delta of [-0.35, 0.35]) {
    if (g.balls.length >= 3) break;
    const ang = base + delta;
    g.balls.push({
      x: src.x,
      y: src.y,
      vx: v * Math.sin(ang),
      vy: -v * Math.cos(ang),
    });
  }
}

/** 保持方向，把球速调整到当前应有的速度（变慢道具开始或结束时用） */
function rescale(g: Game) {
  const target = ballSpeed(g);
  for (const b of g.balls) {
    const v = Math.hypot(b.vx, b.vy);
    if (!v) continue;
    const k = target / v;
    b.vx *= k;
    b.vy *= k;
  }
}

type StepResult = "ok" | "miss" | "clear" | "hit" | "item";

/** 推进 dt 秒；球的移动拆成小步，保证每步位移小于球半径，不会穿过砖块 */
function step(g: Game, dt: number, held: number): StepResult {
  const wasSlow = g.time < g.slowUntil;
  g.time += dt;
  if (wasSlow !== g.time < g.slowUntil) rescale(g);

  const half = paddleW(g) / 2;
  if (g.target !== null) g.paddle += (g.target - g.paddle) * Math.min(1, dt * 18);
  g.paddle += held * 560 * dt;
  g.paddle = Math.max(half, Math.min(W - half, g.paddle));

  // 掉落的道具：碰到球拍就生效，掉出底部就消失
  let result: StepResult = "ok";
  g.drops = g.drops.filter((d) => {
    d.y += ITEM_FALL * dt;
    if (d.y + 10 >= PADDLE_Y && d.y - 10 <= PADDLE_Y + PADDLE_H && Math.abs(d.x - g.paddle) <= half + 14) {
      if (d.kind === "W") g.wideUntil = g.time + WIDE_TIME;
      if (d.kind === "S") {
        g.slowUntil = g.time + SLOW_TIME;
        rescale(g);
      }
      if (d.kind === "L") g.lives = Math.min(MAX_LIVES, g.lives + 1);
      if (d.kind === "M") splitBall(g);
      result = "item";
      return false;
    }
    return d.y < H + 20;
  });

  if (g.balls.length === 0) {
    g.balls = [{ x: g.paddle, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 }];
  }
  const resting = g.balls.length === 1 && g.balls[0].vx === 0 && g.balls[0].vy === 0;
  if (resting) {
    g.balls[0].x = g.paddle;
    g.balls[0].y = PADDLE_Y - BALL_R;
    return result;
  }

  const still: Ball[] = [];
  for (const b of g.balls) {
    let alive = true;
    const n = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / (BALL_R * 0.8)));
    for (let i = 0; i < n && alive; i++) {
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
      if (b.y > H + BALL_R * 2) {
        alive = false;
        break;
      }

      if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && py + BALL_R <= PADDLE_Y + 4 && Math.abs(b.x - g.paddle) <= half + BALL_R) {
        const k = Math.max(-1, Math.min(1, (b.x - g.paddle) / half));
        const v = ballSpeed(g);
        b.vx = v * Math.sin(k * 1.05);
        b.vy = -v * Math.cos(k * 1.05);
        b.y = PADDLE_Y - BALL_R;
      }

      for (const br of g.bricks) {
        if (br.hp <= 0) continue;
        const cx = Math.max(br.x, Math.min(b.x, br.x + BRICK_W));
        const cy = Math.max(br.y, Math.min(b.y, br.y + BRICK_H));
        const dx = b.x - cx;
        const dy = b.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > BALL_R * BALL_R) continue;
        let nx = 0;
        let ny = 0;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          nx = dx / d;
          ny = dy / d;
        } else if (px < br.x || px > br.x + BRICK_W) nx = px < br.x ? -1 : 1;
        else ny = py < br.y ? -1 : 1;
        if (d2 > 1e-6) {
          b.x = cx + nx * (BALL_R + 0.5);
          b.y = cy + ny * (BALL_R + 0.5);
        } else if (nx) b.x = nx < 0 ? br.x - BALL_R - 0.5 : br.x + BRICK_W + BALL_R + 0.5;
        else b.y = ny < 0 ? br.y - BALL_R - 0.5 : br.y + BRICK_H + BALL_R + 0.5;
        if (b.vx * nx + b.vy * ny >= 0) break;
        if (Math.abs(nx) > Math.abs(ny)) b.vx = -b.vx;
        else b.vy = -b.vy;
        if (!br.metal) {
          br.hp--;
          const per = 10 * (g.level + 1);
          g.score += br.hp > 0 ? per / 2 : per * br.maxHp;
          if (br.hp === 0 && br.item) g.drops.push({ x: br.x + BRICK_W / 2, y: br.y + BRICK_H / 2, kind: br.item });
          if (result === "ok") result = "hit";
          g.combo += 1;
          if (g.combo > g.bestCombo) g.bestCombo = g.combo;
        }
        break;
      }
      if (result === "hit" && g.bricks.every((br) => br.metal || br.hp <= 0)) {
        g.balls = still.concat(alive ? [b] : []);
        return "clear";
      }
    }
    if (alive) still.push(b);
  }
  g.balls = still;
  if (g.balls.length === 0) return "miss";
  return result;
}

function draw(el: HTMLCanvasElement | null, g: Game) {
  const ctx = el?.getContext("2d");
  if (!el || !ctx) return;
  const k = el.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, W, H);

  for (const br of g.bricks) {
    if (br.hp <= 0) continue;
    ctx.beginPath();
    ctx.roundRect(br.x, br.y, BRICK_W, BRICK_H, 4);
    if (br.metal) {
      ctx.fillStyle = "#4a4360";
      ctx.fill();
      ctx.strokeStyle = "#8a83a3";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = "rgb(255 255 255 / 0.18)";
      ctx.beginPath();
      ctx.moveTo(br.x + 8, br.y + BRICK_H - 4);
      ctx.lineTo(br.x + 18, br.y + 4);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = br.maxHp > 1 ? HP_COLORS[br.maxHp] : br.color;
    // 打过一下的硬砖变暗
    ctx.globalAlpha = br.maxHp > 1 ? 0.45 + 0.55 * (br.hp / br.maxHp) : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgb(255 255 255 / 0.22)";
    ctx.fillRect(br.x + 4, br.y + 3, BRICK_W - 8, 3);
    if (br.item) {
      ctx.fillStyle = "rgb(20 2 31 / 0.75)";
      ctx.beginPath();
      ctx.arc(br.x + BRICK_W / 2, br.y + BRICK_H / 2 + 1, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const d of g.drops) {
    const look = ITEM_LOOK[d.kind];
    ctx.fillStyle = look.color;
    ctx.beginPath();
    ctx.roundRect(d.x - 16, d.y - 10, 32, 20, 10);
    ctx.fill();
    ctx.fillStyle = "#14021f";
    ctx.fillText(look.label, d.x, d.y + 1);
  }

  const accent = getComputedStyle(el).getPropertyValue("--accent").trim() || "#ff3ea5";
  const pw = paddleW(g);
  ctx.shadowColor = accent;
  ctx.shadowBlur = 16;
  ctx.fillStyle = g.time < g.wideUntil ? "#7af5c0" : accent;
  ctx.beginPath();
  ctx.roundRect(g.paddle - pw / 2, PADDLE_Y, pw, PADDLE_H, PADDLE_H / 2);
  ctx.fill();
  ctx.shadowColor = "#fff";
  ctx.fillStyle = g.time < g.slowUntil ? "#a8c8ff" : "#fff";
  for (const b of g.balls) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

export default function Breakout() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [initial] = useState(() => newGame(0));
  const game = useRef<Game>(initial);
  const held = useRef({ left: false, right: false });
    const buzzMuted = useBuzzMuted();
const [phase, setPhase] = useState<Phase>("select");
  const [hud, setHud] = useState<Hud>({ score: 0, lives: 3, level: 0, wide: false, slow: false, wideLeft: 0, slowLeft: 0, balls: 1, brickLeft: 0, brickTotal: 0, progress: 0, combo: 0, bestCombo: 0, ballSpeed: 320, paddleW: 88 , dropsAir: 0, metalLeft: 0});
  const [record, setRecord] = useState(false);
  const [best] = useRecord("breakout", higher);
  const [unlocked] = useRecord("breakout-unlocked", higher);

  const sync = () => {
    const g = game.current;
    const bs = brickStats(g);
    setHud({
      score: g.score,
      lives: g.lives,
      level: g.level,
      wide: g.time < g.wideUntil,
      slow: g.time < g.slowUntil,
      wideLeft: Math.max(0, g.wideUntil - g.time),
      slowLeft: Math.max(0, g.slowUntil - g.time),
      balls: g.balls.length,
      combo: g.combo,
      bestCombo: g.bestCombo,
      dropsAir: g.drops.length,
      metalLeft: g.bricks.filter((br) => br.metal).length,
      ballSpeed: Math.round(ballSpeed(g)),
      paddleW: Math.round(paddleW(g)),
      ...bs,
    });
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

  const endRun = (phaseAfter: "over" | "done") => {
    const g = game.current;
    setRecord(g.score > 0 && saveRecord("breakout", g.score, higher));
    setPhase(phaseAfter);
  };

  const onResult = useEffectEvent((r: StepResult) => {
    const g = game.current;
    if (r === "hit" || r === "item") {
      if (r === "item") buzz(20);
      sync();
    } else if (r === "clear") {
      buzz([20, 30, 20, 30, 60]);
      saveRecord("breakout-unlocked", Math.min(g.level + 2, BREAKOUT_LEVELS.length), higher);
      sync();
      if (g.level + 1 < BREAKOUT_LEVELS.length) setPhase("clear");
      else endRun("done");
    } else if (r === "miss") {
      buzz(70);
      g.lives--;
      g.combo = 0;
      g.drops = [];
      sync();
      if (g.lives <= 0) endRun("over");
      else {
        g.balls = [{ x: g.paddle, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 }];
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
    let shown = "";
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const h = held.current;
      const g = game.current;
      const r = step(g, dt, Number(h.right) - Number(h.left));
      draw(canvas.current, g);
      // 道具到期时刷新状态栏
      const effects = `${g.time < g.wideUntil}${g.time < g.slowUntil}:${g.balls.length}`;
      if (effects !== shown) {
        shown = effects;
        sync();
      }
      if (r !== "ok") onResult(r);
      if (r === "ok" || r === "hit" || r === "item") raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onHide = () => document.hidden && setPhase("paused");
    document.addEventListener("visibilitychange", onHide);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [phase]);

  const start = (level: number, carry?: Pick<Game, "score" | "lives" | "bestCombo">) => {
    game.current = newGame(level, carry);
    sync();
    setRecord(false);
    setPhase("aim");
  };
  const nextLevel = () => {
    const g = game.current;
    start(g.level + 1, { score: g.score, lives: g.lives, bestCombo: g.bestCombo });
  };

  const serve = () => {
    if (phase !== "aim") return;
    launch(game.current);
    setPhase("running");
  };

  const toggle = () => {
    if (phase === "running" || phase === "aim") setPhase("paused");
    else if (phase === "paused") setPhase(game.current.balls.every((b) => b.vy === 0 && b.vx === 0) ? "aim" : "running");
  };

  useKeys((key, repeat) => {
    const left = key === "ArrowLeft" || key === "a" || key === "A";
    const right = key === "ArrowRight" || key === "d" || key === "D";
    if (left || right) {
      held.current[left ? "left" : "right"] = true;
      // 改用键盘后不再追鼠标最后停留的位置
      game.current.target = null;
    } else if (key === " " || key === "p" || key === "P" || key === "Escape" || key === "Enter") {
      // 按住不放的重复事件不反复发球或暂停
      if (repeat) return true;
      if (key === " " && phase === "aim") serve();
      else if (key === "Enter" && phase === "clear") nextLevel();
      else if (key === "Enter" && (phase === "over" || phase === "done")) setPhase("select");
      else if (key !== "Enter") toggle();
    } else return false;
    return true;
  });

  useEffect(() => {
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") held.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") held.current.right = false;
    };
    // 按住方向键时切走窗口会丢掉 keyup，回来时球拍不应该自己一直滑
    const release = () => {
      held.current.left = held.current.right = false;
    };
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
    };
  }, []);

  // 鼠标追踪；触屏直接设球拍，减少拖尾
  const aimAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const g = game.current;
    const half = paddleW(g) / 2;
    const clamped = Math.max(half, Math.min(W - half, x));
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      g.paddle = clamped;
      g.target = null;
    } else {
      g.target = clamped;
    }
  };

  const level = BREAKOUT_LEVELS[hud.level];

  return (
    <div className="game">
      <div className="game-bar">
        {phase === "select" ? (
          <span>
            选择关卡<b>{unlocked ?? 1}/{BREAKOUT_LEVELS.length}</b>
          </span>
        ) : (
          <>
            <span>
              第 {hud.level + 1} 关<b>{level.name}</b>
            </span>
            <span>
              分数<b>{hud.score}</b>
            </span>
            <span title="多球与残命同屏（掉球扣一命；多球道具可叠加）">
              生命<b className={hud.lives <= 1 ? "game-tip--alert" : undefined}>{"♥".repeat(Math.max(0, hud.lives)) || "0"}</b>
              <small style={{ marginLeft: 4, opacity: 0.7 }}>/3</small>
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              球<b className={hud.balls > 1 ? "game-tip--alert" : undefined}>{hud.balls}</b>
              {hud.balls > 1 ? <small style={{ marginLeft: 4, opacity: 0.85 }}>多球</small> : null}
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              速<b className={hud.lives <= 1 || hud.slow ? "game-tip--alert" : undefined}>{hud.ballSpeed}</b>
            </span>
            <span
              className="breakout-progress breakout-progress-items breakout-progress-combo breakout-metal-host"
              data-low={(hud.brickLeft <= 3 && hud.brickLeft > 0) || undefined}
              data-done={hud.progress >= 100 || undefined}
              data-items={(hud.wide || hud.slow || hud.dropsAir > 0 || hud.metalLeft > 0) || undefined}
              data-metal={hud.metalLeft > 0 || undefined}
              data-metal-air={(hud.metalLeft > 0 || hud.dropsAir > 0) || undefined}
              data-combo={hud.combo >= 5 || undefined}
              title={
                [
                  `本关进度 ${hud.progress}% · 砖 ${hud.brickLeft}/${hud.brickTotal}`,
                  `连击 ${hud.combo}${hud.bestCombo > 0 ? `（峰${hud.bestCombo}）` : ""}`,
                  hud.dropsAir > 0 ? `空降道具 ${hud.dropsAir}` : "",
                  hud.metalLeft > 0 ? `金属砖 ${hud.metalLeft}` : "",
                  hud.wide ? `加宽 ${hud.wideLeft.toFixed(1)}s` : "",
                  hud.slow ? `减速 ${hud.slowLeft.toFixed(1)}s` : "",
                  `拍宽 ${hud.paddleW}`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              }
            >
              连击<b className={hud.combo >= 5 ? "game-tip--alert" : undefined}>{hud.combo}</b>
              {hud.bestCombo > 0 ? <small style={{ marginLeft: 2, opacity: 0.7 }}>峰{hud.bestCombo}</small> : null}
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              关卡
              <b>{hud.progress}%</b>
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              砖<b className={hud.brickLeft <= 3 && hud.brickLeft > 0 ? "game-tip--alert" : undefined}>{hud.brickLeft}/{hud.brickTotal}</b>
              <span
                className="breakout-progress__bar"
                aria-hidden="true"
                style={{ ["--bo-pct" as string]: `${hud.progress}%` } as CSSProperties}
              />
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              拍宽<b className={hud.wide ? "game-tip--alert" : undefined}>{hud.paddleW}</b>
              {(hud.dropsAir > 0 || hud.metalLeft > 0) && (
                <>
                  <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
                  <span
                    className="breakout-metal-air"
                    data-air={hud.dropsAir > 0 || undefined}
                    data-metal={hud.metalLeft > 0 || undefined}
                    title={`金属|空降：金属砖 ${hud.metalLeft} · 空降道具 ${hud.dropsAir}`}
                  >
                    {hud.metalLeft > 0 ? (
                      <>
                        金属<b>{hud.metalLeft}</b>
                      </>
                    ) : null}
                    {hud.metalLeft > 0 && hud.dropsAir > 0 ? (
                      <small style={{ margin: "0 4px", opacity: 0.45 }}>|</small>
                    ) : null}
                    {hud.dropsAir > 0 ? (
                      <>
                        空降<b className="game-tip--alert">{hud.dropsAir}</b>
                      </>
                    ) : null}
                  </span>
                </>
              )}
              {(hud.wide || hud.slow) && (
                <>
                  <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
                  <span className="breakout-item-timer">
                    {hud.wide && (
                      <>
                        <b style={{ color: ITEM_LOOK.W.color }}>宽</b>
                        <small style={{ marginLeft: 2, color: ITEM_LOOK.W.color }}>{hud.wideLeft.toFixed(1)}s</small>
                      </>
                    )}
                    {hud.wide && hud.slow ? <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small> : null}
                    {hud.slow && (
                      <>
                        <b style={{ color: ITEM_LOOK.S.color }}>慢</b>
                        <small style={{ marginLeft: 2, color: ITEM_LOOK.S.color }}>{hud.slowLeft.toFixed(1)}s</small>
                      </>
                    )}
                  </span>
                </>
              )}
            </span>
          </>
        )}
        <span className="spacer" />
                <button
          type="button"
          className="game-btn"
          aria-pressed={buzzMuted}
          onClick={() => setBuzzMuted(!buzzMuted)}
        >
          {buzzMuted ? "震动关" : "震动开"}
        </button>
{(phase === "running" || phase === "aim" || phase === "paused") && (
          <button type="button" className="game-btn" onClick={toggle}>
            {phase === "paused" ? "继续" : "暂停"}
          </button>
        )}
      </div>
      {(phase === "running" || phase === "aim" || phase === "paused") && (
        <p className={hud.lives <= 1 || hud.balls > 1 || (hud.brickLeft <= 3 && hud.brickLeft > 0) ? "game-tip game-tip--alert" : "game-tip"} aria-live="polite">
          {hud.lives <= 1 && hud.balls > 1
            ? `多球/残命：多球×${hud.balls} · 残命 ${hud.lives} · 速 ${hud.ballSpeed} · 拍 ${hud.paddleW}`
            : hud.lives <= 1
            ? `多球/残命：残命 ${hud.lives} · 球×${hud.balls} · 速 ${hud.ballSpeed} · 拍 ${hud.paddleW}`
            : hud.balls > 1
              ? `多球/残命：多球×${hud.balls} · ♥×${hud.lives} · 速 ${hud.ballSpeed} · 连击 ${hud.combo}`
            : hud.brickLeft <= 3 && hud.brickLeft > 0
              ? `多球/残命：♥×${hud.lives} · 球×${hud.balls} · 残局 ${hud.brickLeft} 块 · 拍 ${hud.paddleW}`
              : `连击|进度|道具：连${hud.combo}${hud.bestCombo > 0 ? `/峰${hud.bestCombo}` : ""} · ${hud.progress}%（砖 ${hud.brickLeft}/${hud.brickTotal}）${hud.metalLeft > 0 || hud.dropsAir > 0 ? ` · 金属|空降 ${hud.metalLeft}/${hud.dropsAir}` : ""}${hud.wide ? ` · 宽${hud.wideLeft.toFixed(1)}s` : ""}${hud.slow ? ` · 慢${hud.slowLeft.toFixed(1)}s` : ""} · ♥×${hud.lives} · 球×${hud.balls} · 速 ${hud.ballSpeed} · 连击 ${hud.combo}`}
        </p>
      )}
      {(phase === "running" || phase === "aim" || phase === "paused" || phase === "select") && (
        <p className="game-tip breakout-items" aria-label="道具说明">
          道具：
          <b style={{ color: ITEM_LOOK.W.color }}>宽</b>加长挡板 ·
          <b style={{ color: ITEM_LOOK.S.color }}>慢</b>减速 ·
          <b style={{ color: ITEM_LOOK.L.color }}>命</b>多一命 ·
          <b style={{ color: ITEM_LOOK.M.color }}>多</b>分裂多球
          {hud.wide || hud.slow || hud.balls > 1
            ? ` · 当前${hud.wide ? `加宽${hud.wideLeft.toFixed(1)}s` : ""}${hud.wide && hud.slow ? "/" : ""}${hud.slow ? `减速${hud.slowLeft.toFixed(1)}s` : ""}${hud.balls > 1 ? `${hud.wide || hud.slow ? "/" : ""}多球×${hud.balls}` : ""}`
            : " · 打碎带标记的砖后用挡板接住"}
        </p>
      )}
      <div
        className="game-stage breakout"
        style={{ touchAction: "none" }}
        onPointerMove={(e) => {
          if (e.pointerType === "touch" || e.currentTarget.hasPointerCapture?.(e.pointerId)) aimAt(e);
          else aimAt(e);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") game.current.target = null;
        }}
        onPointerUp={(e) => {
          try {
            e.currentTarget.releasePointerCapture?.(e.pointerId);
          } catch {}
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          aimAt(e);
          if (phase === "aim") serve();
        }}
      >
        <canvas ref={canvas} aria-label={`打砖块，第 ${hud.level + 1} 关，${hud.score} 分`} />
        {phase === "aim" && (
          <p className="breakout-hint">
            <span className="when-mouse">点击棋盘或按空格发球</span>
            <span className="when-touch">拖动手指移球拍，点一下发球；也可用下方按钮</span>
          </p>
        )}
        {phase !== "aim" && phase !== "running" && (
          <div className="game-overlay">
            {phase === "select" && (
              <LevelSelect
                title="选择关卡"
                levels={BREAKOUT_LEVELS.map((l) => ({ name: l.name }))}
                unlocked={unlocked ?? 1}
                onPick={(i) => start(i)}
              >
                <p>
                  从选中的关卡一路打下去，3 条命。关卡越高球越快、球拍越短。
                  <span style={{ color: ITEM_LOOK.W.color }}>宽</span>{" "}
                  <span style={{ color: ITEM_LOOK.S.color }}>慢</span>{" "}
                  <span style={{ color: ITEM_LOOK.L.color }}>命</span>{" "}
                  <span style={{ color: ITEM_LOOK.M.color }}>多</span>{" "}
                  是道具（多=多球），用球拍接住{best ? ` · 最高 ${best} 分` : ""}
                </p>
              </LevelSelect>
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
            {phase === "clear" && (
              <>
                <strong>第 {hud.level + 1} 关通过！</strong>
                <p>
                  下一关：{BREAKOUT_LEVELS[hud.level + 1]?.name} · 目前 {hud.score} 分
                </p>
                <button type="button" className="game-btn game-btn--primary" onClick={nextLevel}>
                  下一关
                </button>
              </>
            )}
            {(phase === "over" || phase === "done") && (
              <>
                <strong>{phase === "done" ? "全部通关！" : record ? "新纪录！" : "球没接住"}</strong>
                <p>
                  {hud.score} 分 · 打到第 {hud.level + 1} 关{phase === "done" && record ? " · 新纪录" : ""}
                </p>
                <span style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="game-btn game-btn--primary" onClick={() => start(phase === "done" ? 0 : hud.level)}>
                    {phase === "done" ? "再打一遍" : "重打这关"}
                  </button>
                  <button type="button" className="game-btn" onClick={() => setPhase("select")}>
                    选关
                  </button>
                </span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="pad pad--breakout" aria-label="球拍">
        <button
          type="button"
          aria-label="左移"
          onPointerDown={(e) => {
            e.preventDefault();
            held.current.left = true;
            game.current.target = null;
            buzz(8);
          }}
          onPointerUp={() => (held.current.left = false)}
          onPointerLeave={() => (held.current.left = false)}
          onPointerCancel={() => (held.current.left = false)}
        >
          ←
        </button>
        <button
          type="button"
          aria-label="发球 / 暂停"
          className="pad__text"
          onPointerDown={(e) => {
            e.preventDefault();
            if (phase === "aim") serve();
            else toggle();
          }}
        >
          {phase === "aim" ? "发球" : phase === "paused" ? "继续" : "暂停"}
        </button>
        <button
          type="button"
          aria-label="右移"
          onPointerDown={(e) => {
            e.preventDefault();
            held.current.right = true;
            game.current.target = null;
            buzz(8);
          }}
          onPointerUp={() => (held.current.right = false)}
          onPointerLeave={() => (held.current.right = false)}
          onPointerCancel={() => (held.current.right = false)}
        >
          →
        </button>
      </div>
    </div>
  );
}
