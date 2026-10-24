"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buzz, lower, useKeys, useRecord } from "./input";

type Diff = { key: string; label: string; cols: number; rows: number };
type Card = { id: number; pair: number; flipped: boolean; matched: boolean };

const DIFFS: Diff[] = [
  { key: "easy", label: "简单", cols: 3, rows: 4 },
  { key: "normal", label: "普通", cols: 4, rows: 4 },
  { key: "hard", label: "困难", cols: 5, rows: 4 },
];
const SYMBOLS = ["♠", "♥", "♦", "♣", "★", "●", "▲", "■", "◆", "☀"];
const FLIP_BACK_MS = 650;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(pairs: number): Card[] {
  const base = Array.from({ length: pairs }, (_, pair) => pair);
  return shuffle([...base, ...base]).map((pair, id) => ({
    id,
    pair,
    flipped: false,
    matched: false,
  }));
}

function recordKey(diff: Diff) {
  return `memory-${diff.key}`;
}

export default function Memory() {
  const [diff, setDiff] = useState<Diff>(DIFFS[1]);
  const pairs = (diff.cols * diff.rows) / 2;
  const [cards, setCards] = useState<Card[]>(() => deal(8));
  const [open, setOpen] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [lock, setLock] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [focus, setFocus] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [best, submitBest] = useRecord(recordKey(diff), lower);
  // 兼容第一批只写过 memory 键的普通难度纪录
  const [legacy] = useRecord("memory", lower);
  const shownBest = best ?? (diff.key === "normal" ? legacy : null);
  const reported = useRef(false);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const matchedCount = useMemo(() => cards.filter((c) => c.matched).length / 2, [cards]);
  const won = matchedCount === pairs;

  useEffect(() => {
    if (!running || won) return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running, won]);

  useEffect(() => {
    if (!won || moves <= 0 || reported.current) return;
    reported.current = true;
    const isBest = submitBest(moves);
    buzz(isBest ? 30 : [12, 40, 12]);
  }, [won, moves, submitBest]);

  useEffect(() => {
    cardRefs.current[focus]?.focus();
  }, [focus, diff.key, cards.length]);

  const flip = (i: number) => {
    if (lock || won) return;
    const c = cards[i];
    if (!c || c.flipped || c.matched) return;
    if (!running) setRunning(true);

    const nextOpen = [...open, i];
    setCards((prev) => prev.map((x) => (x.id === i ? { ...x, flipped: true } : x)));
    setFocus(i);

    if (nextOpen.length < 2) {
      setOpen(nextOpen);
      return;
    }

    const [a] = nextOpen;
    setOpen([]);
    setMoves((m) => m + 1);
    const pairA = cards[a].pair;
    const pairB = cards[i].pair;

    if (pairA === pairB) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setBestStreak((b) => Math.max(b, nextStreak));
      buzz(nextStreak >= 3 ? [18, 40, 18] : 18);
      setAnnounce(
        nextStreak >= 2
          ? `配对成功，${SYMBOLS[pairA]}，连击 ×${nextStreak}`
          : "配对成功，" + SYMBOLS[pairA],
      );
      setCards((prev) =>
        prev.map((x) => (x.id === a || x.id === i ? { ...x, flipped: true, matched: true } : x)),
      );
      return;
    }

    setStreak(0);
    setAnnounce("不同，已翻回");
    setLock(true);
    window.setTimeout(() => {
      setCards((prev) =>
        prev.map((x) => (x.id === a || x.id === i ? { ...x, flipped: false } : x)),
      );
      setLock(false);
    }, FLIP_BACK_MS);
  };

  const restart = (next = diff) => {
    reported.current = false;
    setDiff(next);
    setCards(deal((next.cols * next.rows) / 2));
    setOpen([]);
    setMoves(0);
    setLock(false);
    setSeconds(0);
    setRunning(false);
    setFocus(0);
    setStreak(0);
    setBestStreak(0);
    setAnnounce("");
  };

  useKeys((key) => {
    const cols = diff.cols;
    const n = cards.length;
    if (key === "ArrowRight") {
      setFocus((f) => (f + 1) % n);
      return true;
    }
    if (key === "ArrowLeft") {
      setFocus((f) => (f - 1 + n) % n);
      return true;
    }
    if (key === "ArrowDown") {
      setFocus((f) => (f + cols) % n);
      return true;
    }
    if (key === "ArrowUp") {
      setFocus((f) => (f - cols + n) % n);
      return true;
    }
    if (key === "Home") {
      setFocus(0);
      return true;
    }
    if (key === "End") {
      setFocus(n - 1);
      return true;
    }
    if (key === "Enter" || key === " ") {
      flip(focus);
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
        {DIFFS.map((d) => (
          <button
            key={d.key}
            type="button"
            className="game-btn"
            aria-pressed={d.key === diff.key}
            onClick={() => restart(d)}
          >
            {d.label}
          </button>
        ))}
        <span className="spacer" />
        <span>
          步数<b>{moves}</b>
        </span>
        <span>
          配对<b>
            {matchedCount}/{pairs}
          </b>
        </span>
        <span className={streak >= 2 ? "game-tip--alert" : undefined} data-combo={streak >= 2 || undefined}>
          连击<b>{streak}</b>
          {bestStreak > 1 ? <small style={{ marginLeft: 4, opacity: 0.7 }}>最高{bestStreak}</small> : null}
        </span>
        <span>
          时间<b>{seconds}</b>
        </span>
        <span>
          最少<b>{shownBest ?? "—"}</b>
        </span>
      </div>
      <div
        className="memory"
        role="grid"
        aria-label={`记忆翻牌 ${diff.label}`}
        style={{ gridTemplateColumns: `repeat(${diff.cols}, 1fr)` }}
      >
        {cards.map((c, i) => {
          const show = c.flipped || c.matched;
          return (
            <button
              key={c.id}
              type="button"
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="memory-card"
              role="gridcell"
              tabIndex={focus === i ? 0 : -1}
              data-open={show || undefined}
              data-matched={c.matched || undefined}
              data-focus={focus === i || undefined}
              aria-label={show ? `牌面 ${SYMBOLS[c.pair]}` : `第 ${i + 1} 张，背面`}
              disabled={lock || c.matched}
              onClick={() => flip(i)}
              onFocus={() => setFocus(i)}
            >
              <span className="memory-card__face memory-card__face--front" aria-hidden="true">
                ?
              </span>
              <span className="memory-card__face memory-card__face--back" aria-hidden="true">
                {SYMBOLS[c.pair]}
              </span>
            </button>
          );
        })}
      </div>
      <div className="game-bar">
        <span className="spacer" />
        <button type="button" className="game-btn" onClick={() => restart()}>
          重新开始
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <p className="game-hint" aria-live="polite">
        {won
          ? `全部配对，用了 ${moves} 步、${seconds} 秒${bestStreak > 1 ? `，最高连击 ×${bestStreak}` : ""}${shownBest !== null && moves <= shownBest ? "，新纪录！" : "。"}`
          : streak >= 2
            ? `连击 ×${streak}！连续配对会累加；翻错就清零。`
            : shownBest !== null
              ? `${diff.label}本机最少 ${shownBest} 步。连续配对可连击；方向键移动，Home/End 跳首尾，回车或空格翻牌。`
              : "连续配对会显示连击。方向键移动焦点，Home/End 跳首尾，回车或空格翻牌；也可点选。步数越少越好。"}
      </p>
    </div>
  );
}
