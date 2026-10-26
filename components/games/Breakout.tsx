"use client";

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useLang, useT } from "@/components/i18n/LangProvider";
import { BREAKOUT_MESSAGES } from "./Breakout.messages";
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
// 道具上的字随语言变化，见 Breakout.messages.ts 的 items
const ITEM_LOOK: Record<Item, { color: string }> = {
  W: { color: "#7af5c0" },
  S: { color: "#6fa8ff" },
  L: { color: "#ff5c8a" },
  M: { color: "#ffe066" },
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
type Hud = {
  score: number;
  lives: number;
  level: number;
  wide: boolean;
  slow: boolean;
  wideLeft: number;
  slowLeft: number;
  balls: number;
  brickLeft: number;
  brickTotal: number;
  progress: number;
  combo: number;
  bestCombo: number;
  ballSpeed: number;
  paddleW: number;
  dropsAir: number;
  metalLeft: number;
  seconds: number;
};

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

      if (
        b.vy > 0 &&
        b.y + BALL_R >= PADDLE_Y &&
        py + BALL_R <= PADDLE_Y + 4 &&
        Math.abs(b.x - g.paddle) <= half + BALL_R
      ) {
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

function draw(el: HTMLCanvasElement | null, g: Game, labels: Record<Item, string>) {
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
    ctx.fillText(labels[d.kind], d.x, d.y + 1);
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
  const t = useT(BREAKOUT_MESSAGES);
  const lang = useLang();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [initial] = useState(() => newGame(0));
  const game = useRef<Game>(initial);
  const held = useRef({ left: false, right: false });
  const buzzMuted = useBuzzMuted();
  const [phase, setPhase] = useState<Phase>("select");
  const [hud, setHud] = useState<Hud>({
    score: 0,
    lives: 3,
    level: 0,
    wide: false,
    slow: false,
    wideLeft: 0,
    slowLeft: 0,
    balls: 1,
    brickLeft: 0,
    brickTotal: 0,
    progress: 0,
    combo: 0,
    bestCombo: 0,
    ballSpeed: 320,
    paddleW: 88,
    dropsAir: 0,
    metalLeft: 0,
    seconds: 0,
  });
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
      seconds: Math.floor(g.time),
    });
  };

  // 用最新语言的道具文字画；切换语言时也重画一次
  const paint = useEffectEvent(() => draw(canvas.current, game.current, t.items));
  useEffect(() => paint(), [t]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.clientWidth * Math.min(devicePixelRatio, 2));
      el.width = w;
      el.height = Math.round((w * H) / W);
      paint();
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
    paint();
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
      paint();
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
    else if (phase === "paused")
      setPhase(game.current.balls.every((b) => b.vy === 0 && b.vx === 0) ? "aim" : "running");
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
            {t.selectLevel}
            <b>
              {unlocked ?? 1}/{BREAKOUT_LEVELS.length}
            </b>
          </span>
        ) : (
          <>
            <span>
              {t.levelN(hud.level + 1)}
              <b>{level.name[lang]}</b>
              <span
                className="breakout-level-bar"
                data-late={hud.level + 1 >= Math.max(1, BREAKOUT_LEVELS.length - 1) || undefined}
                title={t.levelBarTitle(hud.level + 1, BREAKOUT_LEVELS.length)}
                aria-label={t.levelBarAria(hud.level + 1, BREAKOUT_LEVELS.length)}
              >
                <i
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(((hud.level + 1) / Math.max(1, BREAKOUT_LEVELS.length)) * 100),
                    )}%`,
                  }}
                />
              </span>
            </span>
            <span>
              {t.score}
              <b>{hud.score}</b>
              <span
                className="breakout-score-bar"
                data-hot={hud.score >= 2000 || undefined}
                title={t.scoreBarTitle(hud.score)}
                aria-label={t.scoreAria(hud.score)}
              >
                <i
                  style={{
                    width: `${Math.min(100, Math.round((hud.score / Math.max(500, (hud.level + 1) * 800)) * 100))}%`,
                  }}
                />
              </span>
            </span>
            <span title={t.livesGroupTitle}>
              {t.lives}
              <b className={hud.lives <= 1 ? "game-tip--alert" : undefined}>
                {"♥".repeat(Math.max(0, hud.lives)) || "0"}
              </b>
              <small style={{ marginLeft: 4, opacity: 0.7 }}>/5</small>
              <span
                className="breakout-lives-bar"
                data-low={hud.lives <= 1 || undefined}
                data-mid={hud.lives === 2 || undefined}
                title={t.livesBarTitle(hud.lives)}
                aria-label={t.livesBarAria(hud.lives)}
              >
                <i style={{ width: `${Math.min(100, Math.round((hud.lives / 5) * 100))}%` }} />
              </span>
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              {t.balls}
              <b className={hud.balls > 1 ? "game-tip--alert" : undefined}>{hud.balls}</b>
              {hud.balls > 1 ? <small style={{ marginLeft: 4, opacity: 0.85 }}>{t.multiBall}</small> : null}
              <span
                className="breakout-balls-bar"
                data-multi={hud.balls > 1 || undefined}
                data-many={hud.balls >= 3 || undefined}
                title={t.ballsBarTitle(hud.balls)}
                aria-label={t.ballsBarAria(hud.balls)}
              >
                <i style={{ width: `${Math.min(100, Math.round((hud.balls / 5) * 100))}%` }} />
              </span>
              <span
                className="breakout-combo-now-bar"
                data-hot={hud.combo >= 5 || undefined}
                data-mid={(hud.combo >= 3 && hud.combo < 5) || undefined}
                title={t.comboNowTitle(hud.combo)}
                aria-label={t.comboNowAria(hud.combo)}
              >
                <i
                  style={{
                    width: `${Math.min(100, Math.round((hud.combo / 10) * 100))}%`,
                  }}
                />
              </span>
              <span
                className="breakout-combo-gap-bar"
                data-peak={(hud.bestCombo > 0 && hud.combo >= hud.bestCombo) || undefined}
                data-near={
                  (hud.bestCombo > 0 && hud.combo >= hud.bestCombo * 0.7 && hud.combo < hud.bestCombo) || undefined
                }
                title={hud.bestCombo > 0 ? t.comboVsPeak(hud.combo, hud.bestCombo) : t.comboNoPeakTitle(hud.combo)}
                aria-label={hud.bestCombo > 0 ? t.comboVsPeak(hud.combo, hud.bestCombo) : t.comboN(hud.combo)}
              >
                <i
                  style={{
                    width: `${
                      hud.bestCombo > 0
                        ? Math.min(100, Math.round((hud.combo / hud.bestCombo) * 100))
                        : Math.min(100, Math.round((hud.combo / 10) * 100))
                    }%`,
                  }}
                />
              </span>
              <span
                className="breakout-clear-bar"
                data-done={hud.progress >= 100 || undefined}
                data-late={(hud.progress >= 70 && hud.progress < 100) || undefined}
                title={t.clearBarTitle(hud.progress, hud.brickLeft, hud.brickTotal)}
                aria-label={t.clearBarAria(hud.progress)}
              >
                <i
                  style={{
                    width: `${Math.min(100, Math.max(0, Math.round(hud.progress)))}%`,
                  }}
                />
              </span>
              <span
                className="breakout-remain-bar"
                data-low={(hud.brickLeft > 0 && hud.brickLeft <= 3) || undefined}
                data-empty={hud.brickLeft === 0 || undefined}
                title={t.bricksLeft(hud.brickLeft, hud.brickTotal)}
                aria-label={t.bricksLeftAria(hud.brickLeft)}
              >
                <i
                  style={{
                    width: `${
                      hud.brickTotal > 0 ? Math.min(100, Math.round((hud.brickLeft / hud.brickTotal) * 100)) : 0
                    }%`,
                  }}
                />
              </span>
              <span
                className="breakout-score-pace-bar"
                data-hot={(hud.seconds > 0 && hud.score / hud.seconds >= 40) || undefined}
                data-slow={(hud.seconds >= 20 && hud.score / Math.max(1, hud.seconds) < 8) || undefined}
                title={
                  hud.seconds > 0 ? t.scorePaceTitle(Math.round((hud.score / hud.seconds) * 10) / 10) : t.scorePaceNone
                }
                aria-label={
                  hud.seconds > 0
                    ? t.scorePaceAria(Math.round((hud.score / hud.seconds) * 10) / 10)
                    : t.scorePaceUnknown
                }
              >
                <i
                  style={{
                    width: `${hud.seconds > 0 ? Math.min(100, Math.round((hud.score / hud.seconds / 50) * 100)) : 0}%`,
                  }}
                />
              </span>
              <span
                className="breakout-clear-pace-bar"
                data-hot={(hud.seconds > 0 && hud.progress / hud.seconds >= 4) || undefined}
                data-slow={(hud.seconds >= 25 && hud.progress / Math.max(1, hud.seconds) < 1) || undefined}
                title={
                  hud.seconds > 0
                    ? t.clearPaceTitle(Math.round((hud.progress / hud.seconds) * 10) / 10)
                    : t.clearPaceNone
                }
                aria-label={
                  hud.seconds > 0
                    ? t.clearPaceAria(Math.round((hud.progress / hud.seconds) * 10) / 10)
                    : t.clearPaceUnknown
                }
              >
                <i
                  style={{
                    width: `${
                      hud.seconds > 0 ? Math.min(100, Math.round((hud.progress / hud.seconds / 5) * 100)) : 0
                    }%`,
                  }}
                />
              </span>
              <span
                className="breakout-combo-ratio-bar"
                data-hot={(hud.bestCombo > 0 && hud.combo >= hud.bestCombo && hud.combo >= 3) || undefined}
                data-warm={(hud.bestCombo > 0 && hud.combo / hud.bestCombo >= 0.6) || undefined}
                title={hud.bestCombo > 0 ? t.comboVsPeak(hud.combo, hud.bestCombo) : t.comboN(hud.combo)}
                aria-label={hud.bestCombo > 0 ? t.comboVsPeakAria(hud.combo, hud.bestCombo) : t.comboN(hud.combo)}
              >
                <i
                  style={{
                    width: `${
                      hud.bestCombo > 0
                        ? Math.min(100, Math.round((hud.combo / hud.bestCombo) * 100))
                        : Math.min(100, Math.round((hud.combo / 8) * 100))
                    }%`,
                  }}
                />
              </span>
              <span
                className="breakout-left-ratio-bar"
                data-low={(hud.brickTotal > 0 && hud.brickLeft / hud.brickTotal <= 0.2) || undefined}
                data-high={(hud.brickTotal > 0 && hud.brickLeft / hud.brickTotal >= 0.7) || undefined}
                title={hud.brickTotal > 0 ? t.bricksLeft(hud.brickLeft, hud.brickTotal) : t.bricksLeftNone}
                aria-label={
                  hud.brickTotal > 0 ? t.bricksLeftOfAria(hud.brickLeft, hud.brickTotal) : t.bricksLeftUnknown
                }
              >
                <i
                  style={{
                    width: `${
                      hud.brickTotal > 0 ? Math.min(100, Math.round((hud.brickLeft / hud.brickTotal) * 100)) : 0
                    }%`,
                  }}
                />
              </span>
              <span
                className="breakout-metal-share-bar"
                data-high={(hud.brickLeft > 0 && hud.metalLeft / hud.brickLeft >= 0.45) || undefined}
                data-clear={(hud.brickLeft > 0 && hud.metalLeft === 0) || undefined}
                title={hud.brickLeft > 0 ? t.metalShareTitle(hud.metalLeft, hud.brickLeft) : t.metalShareNone}
                aria-label={hud.brickLeft > 0 ? t.metalShareAria(hud.metalLeft) : t.metalShareUnknown}
              >
                <i
                  style={{
                    width: `${
                      hud.brickLeft > 0 ? Math.min(100, Math.round((hud.metalLeft / hud.brickLeft) * 100)) : 0
                    }%`,
                  }}
                />
              </span>
              <span
                className="breakout-multi-ball-bar"
                data-hot={hud.balls >= 3 || undefined}
                data-solo={hud.balls <= 1 || undefined}
                title={t.ballsOnFieldTitle(hud.balls)}
                aria-label={t.ballsOnFieldAria(hud.balls)}
              >
                <i
                  style={{
                    width: `${Math.min(100, Math.round((hud.balls / 3) * 100))}%`,
                  }}
                />
              </span>
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              {t.speed}
              <b className={hud.lives <= 1 || hud.slow ? "game-tip--alert" : undefined}>{hud.ballSpeed}</b>
              <span
                className="breakout-speed-bar"
                data-slow={hud.slow || undefined}
                data-fast={hud.ballSpeed >= 420 || undefined}
                title={t.speedTitle(hud.ballSpeed, hud.slow)}
                aria-label={t.speedAria(hud.ballSpeed)}
              >
                <i
                  style={{
                    width: `${Math.min(100, Math.max(8, Math.round(((hud.ballSpeed - 200) / 400) * 100)))}%`,
                  }}
                />
              </span>
            </span>
            <span
              className="breakout-progress breakout-progress-items breakout-progress-combo breakout-metal-host breakout-combo-peak-host"
              data-low={(hud.brickLeft <= 3 && hud.brickLeft > 0) || undefined}
              data-done={hud.progress >= 100 || undefined}
              data-items={hud.wide || hud.slow || hud.dropsAir > 0 || hud.metalLeft > 0 || undefined}
              data-metal={hud.metalLeft > 0 || undefined}
              data-metal-air={hud.metalLeft > 0 || hud.dropsAir > 0 || undefined}
              data-combo={hud.combo >= 5 || undefined}
              title={[
                t.progressPart(hud.progress, hud.brickLeft, hud.brickTotal),
                t.comboPart(hud.combo, hud.bestCombo),
                hud.dropsAir > 0 ? t.dropsPart(hud.dropsAir) : "",
                hud.metalLeft > 0 ? t.metalPart(hud.metalLeft) : "",
                hud.wide ? t.widePart(hud.wideLeft) : "",
                hud.slow ? t.slowPart(hud.slowLeft) : "",
                t.paddlePart(hud.paddleW),
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              {t.combo}
              <b className={hud.combo >= 5 ? "game-tip--alert" : undefined}>{hud.combo}</b>
              {hud.bestCombo > 0 ? (
                <small style={{ marginLeft: 2, opacity: 0.7 }}>{t.peak(hud.bestCombo)}</small>
              ) : null}
              {hud.bestCombo > 0 ? (
                <span
                  className="breakout-combo-peak-bar"
                  data-combo-peak={(hud.combo >= hud.bestCombo && hud.combo > 0) || undefined}
                  data-hot={hud.combo >= 5 || undefined}
                  title={t.comboPeakBarTitle(hud.combo, hud.bestCombo)}
                  aria-label={t.comboVsPeak(hud.combo, hud.bestCombo)}
                >
                  <i
                    className="breakout-combo-peak-bar__fill"
                    style={{
                      width: `${Math.min(100, Math.round((hud.combo / Math.max(1, hud.bestCombo)) * 100))}%`,
                    }}
                  />
                </span>
              ) : null}
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              {t.level}
              <b>{hud.progress}%</b>
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              {t.bricks}
              <b className={hud.brickLeft <= 3 && hud.brickLeft > 0 ? "game-tip--alert" : undefined}>
                {hud.brickLeft}/{hud.brickTotal}
              </b>
              <span
                className="breakout-brick-bar"
                data-low={(hud.brickLeft <= 3 && hud.brickLeft > 0) || undefined}
                data-done={hud.brickLeft === 0 || undefined}
                title={t.brickBarTitle(hud.brickLeft, hud.brickTotal)}
                aria-label={t.brickBarAria(Math.max(0, hud.brickTotal - hud.brickLeft), hud.brickTotal)}
              >
                <i
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(((hud.brickTotal - hud.brickLeft) / Math.max(1, hud.brickTotal)) * 100),
                    )}%`,
                  }}
                />
              </span>
              <span
                className="breakout-progress__bar"
                aria-hidden="true"
                style={{ ["--bo-pct" as string]: `${hud.progress}%` } as CSSProperties}
              />
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              {t.paddle}
              <b className={hud.wide ? "game-tip--alert" : undefined}>{hud.paddleW}</b>
              <span
                className="breakout-paddle-bar"
                data-wide={hud.wide || undefined}
                title={t.paddleBarTitle(hud.paddleW)}
                aria-label={t.paddlePart(hud.paddleW)}
              >
                <i style={{ width: `${Math.min(100, Math.round((hud.paddleW / 120) * 100))}%` }} />
              </span>
              {(hud.dropsAir > 0 || hud.metalLeft > 0) && (
                <>
                  <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
                  <span
                    className="breakout-metal-air"
                    data-air={hud.dropsAir > 0 || undefined}
                    data-metal={hud.metalLeft > 0 || undefined}
                    title={t.metalAirTitle(hud.metalLeft, hud.dropsAir)}
                  >
                    {hud.metalLeft > 0 ? (
                      <>
                        {t.metal}
                        <b>{hud.metalLeft}</b>
                      </>
                    ) : null}
                    {hud.metalLeft > 0 && hud.dropsAir > 0 ? (
                      <small style={{ margin: "0 4px", opacity: 0.45 }}>|</small>
                    ) : null}
                    {hud.dropsAir > 0 ? (
                      <>
                        {t.air}
                        <b className="game-tip--alert">{hud.dropsAir}</b>
                      </>
                    ) : null}
                    <span
                      className="breakout-metal-air-bar"
                      data-metal={hud.metalLeft > 0 || undefined}
                      data-air={hud.dropsAir > 0 || undefined}
                      title={t.metalAirBarTitle(hud.metalLeft, hud.dropsAir)}
                      aria-label={t.metalAirBarAria(hud.metalLeft, hud.dropsAir)}
                    >
                      <i
                        className="breakout-metal-air-bar__metal"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((hud.metalLeft / Math.max(1, hud.metalLeft + hud.dropsAir)) * 100),
                          )}%`,
                        }}
                      />
                      <i
                        className="breakout-metal-air-bar__air"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((hud.dropsAir / Math.max(1, hud.metalLeft + hud.dropsAir)) * 100),
                          )}%`,
                        }}
                      />
                    </span>
                  </span>
                </>
              )}
              {(hud.wide || hud.slow) && (
                <>
                  <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
                  <span className="breakout-item-timer">
                    {hud.wide && (
                      <>
                        <b style={{ color: ITEM_LOOK.W.color }}>{t.items.W}</b>
                        <small style={{ marginLeft: 2, color: ITEM_LOOK.W.color }}>{hud.wideLeft.toFixed(1)}s</small>
                        <span
                          className="breakout-item-timer-bar breakout-item-timer-bar--wide"
                          data-low={hud.wideLeft <= 3 || undefined}
                          title={t.wideLeftTitle(hud.wideLeft, WIDE_TIME)}
                          aria-label={t.wideLeftAria(hud.wideLeft)}
                        >
                          <i style={{ width: `${Math.min(100, Math.round((hud.wideLeft / WIDE_TIME) * 100))}%` }} />
                        </span>
                      </>
                    )}
                    {hud.wide && hud.slow ? <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small> : null}
                    {hud.slow && (
                      <>
                        <b style={{ color: ITEM_LOOK.S.color }}>{t.items.S}</b>
                        <small style={{ marginLeft: 2, color: ITEM_LOOK.S.color }}>{hud.slowLeft.toFixed(1)}s</small>
                        <span
                          className="breakout-item-timer-bar breakout-item-timer-bar--slow"
                          data-low={hud.slowLeft <= 3 || undefined}
                          title={t.slowLeftTitle(hud.slowLeft, WIDE_TIME)}
                          aria-label={t.slowLeftAria(hud.slowLeft)}
                        >
                          <i style={{ width: `${Math.min(100, Math.round((hud.slowLeft / WIDE_TIME) * 100))}%` }} />
                        </span>
                      </>
                    )}
                  </span>
                </>
              )}
            </span>
          </>
        )}
        <span className="spacer" />
        <button type="button" className="game-btn" aria-pressed={buzzMuted} onClick={() => setBuzzMuted(!buzzMuted)}>
          {buzzMuted ? t.buzzOff : t.buzzOn}
        </button>
        {(phase === "running" || phase === "aim" || phase === "paused") && (
          <button type="button" className="game-btn" onClick={toggle}>
            {phase === "paused" ? t.resume : t.pause}
          </button>
        )}
      </div>
      {(phase === "running" || phase === "aim" || phase === "paused") && (
        <p
          className={
            hud.lives <= 1 || hud.balls > 1 || (hud.brickLeft <= 3 && hud.brickLeft > 0)
              ? "game-tip game-tip--alert"
              : "game-tip"
          }
          aria-live="polite"
        >
          {hud.lives <= 1 && hud.balls > 1
            ? t.tipMultiLow(hud)
            : hud.lives <= 1
              ? t.tipLow(hud)
              : hud.balls > 1
                ? t.tipMulti(hud)
                : hud.brickLeft <= 3 && hud.brickLeft > 0
                  ? t.tipEndgame(hud)
                  : t.tipDefault(hud)}
        </p>
      )}
      {(phase === "running" || phase === "aim" || phase === "paused" || phase === "select") && (
        <p className="game-tip breakout-items" aria-label={t.itemsAria}>
          {t.itemsLabel}
          <b style={{ color: ITEM_LOOK.W.color }}>{t.items.W}</b>
          {t.itemWideDesc}
          <b style={{ color: ITEM_LOOK.S.color }}>{t.items.S}</b>
          {t.itemSlowDesc}
          <b style={{ color: ITEM_LOOK.L.color }}>{t.items.L}</b>
          {t.itemLifeDesc}
          <b style={{ color: ITEM_LOOK.M.color }}>{t.items.M}</b>
          {t.itemMultiDesc}
          {hud.wide || hud.slow || hud.balls > 1 ? t.itemsActive(hud) : t.itemsHint}
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
        <canvas ref={canvas} aria-label={t.canvasAria(hud.level + 1, hud.score)} />
        {phase === "aim" && (
          <p className="breakout-hint">
            <span className="when-mouse">{t.aimMouse}</span>
            <span className="when-touch">{t.aimTouch}</span>
          </p>
        )}
        {phase !== "aim" && phase !== "running" && (
          <div className="game-overlay">
            {phase === "select" && (
              <LevelSelect
                title={t.selectLevel}
                levels={BREAKOUT_LEVELS.map((l) => ({ name: l.name[lang] }))}
                unlocked={unlocked ?? 1}
                onPick={(i) => start(i)}
              >
                <p>
                  {t.selectIntro}
                  <span style={{ color: ITEM_LOOK.W.color }}>{t.items.W}</span>{" "}
                  <span style={{ color: ITEM_LOOK.S.color }}>{t.items.S}</span>{" "}
                  <span style={{ color: ITEM_LOOK.L.color }}>{t.items.L}</span>{" "}
                  <span style={{ color: ITEM_LOOK.M.color }}>{t.items.M}</span> {t.selectItems}
                  {best ? t.selectBest(best) : ""}
                </p>
              </LevelSelect>
            )}
            {phase === "paused" && (
              <>
                <strong>{t.paused}</strong>
                <span style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="game-btn game-btn--primary" onClick={toggle}>
                    {t.resume}
                  </button>
                  <button type="button" className="game-btn" onClick={() => setPhase("select")}>
                    {t.pickLevel}
                  </button>
                </span>
              </>
            )}
            {phase === "clear" && (
              <>
                <strong>{t.levelClear(hud.level + 1)}</strong>
                <p>{t.nextUp(BREAKOUT_LEVELS[hud.level + 1]?.name[lang] ?? "", hud.score)}</p>
                <button type="button" className="game-btn game-btn--primary" onClick={nextLevel}>
                  {t.nextLevel}
                </button>
              </>
            )}
            {(phase === "over" || phase === "done") && (
              <>
                <strong>{phase === "done" ? t.allClear : record ? t.newRecord : t.missed}</strong>
                <p>
                  {t.result(hud.score, hud.level + 1)}
                  {phase === "done" && record ? t.resultRecord : ""}
                </p>
                <span style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="game-btn game-btn--primary"
                    onClick={() => start(phase === "done" ? 0 : hud.level)}
                  >
                    {phase === "done" ? t.playAgain : t.retryLevel}
                  </button>
                  <button type="button" className="game-btn" onClick={() => setPhase("select")}>
                    {t.pickLevel}
                  </button>
                </span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="pad pad--breakout" aria-label={t.padAria}>
        <button
          type="button"
          aria-label={t.moveLeft}
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
          aria-label={t.serveOrPause}
          className="pad__text"
          onPointerDown={(e) => {
            e.preventDefault();
            if (phase === "aim") serve();
            else toggle();
          }}
        >
          {phase === "aim" ? t.serve : phase === "paused" ? t.resume : t.pause}
        </button>
        <button
          type="button"
          aria-label={t.moveRight}
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
