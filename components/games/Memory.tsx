"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buzz, lower, useRecord } from "./input";

type Card = { id: number; pair: number; flipped: boolean; matched: boolean };

const PAIRS = 8;
const SYMBOLS = ["♠", "♥", "♦", "♣", "★", "●", "▲", "■"];
const FLIP_BACK_MS = 650;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(): Card[] {
  const base = Array.from({ length: PAIRS }, (_, pair) => pair);
  return shuffle([...base, ...base]).map((pair, id) => ({
    id,
    pair,
    flipped: false,
    matched: false,
  }));
}

export default function Memory() {
  const [cards, setCards] = useState<Card[]>(() => deal());
  const [open, setOpen] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [lock, setLock] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [best, submitBest] = useRecord("memory", lower);
  const reported = useRef(false);

  const matchedCount = useMemo(() => cards.filter((c) => c.matched).length / 2, [cards]);
  const won = matchedCount === PAIRS;

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

  const flip = (i: number) => {
    if (lock || won) return;
    const c = cards[i];
    if (!c || c.flipped || c.matched) return;
    if (!running) setRunning(true);

    const nextOpen = [...open, i];
    setCards((prev) => prev.map((x) => (x.id === i ? { ...x, flipped: true } : x)));

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
      buzz(18);
      setCards((prev) =>
        prev.map((x) => (x.id === a || x.id === i ? { ...x, flipped: true, matched: true } : x)),
      );
      return;
    }

    setLock(true);
    window.setTimeout(() => {
      setCards((prev) =>
        prev.map((x) => (x.id === a || x.id === i ? { ...x, flipped: false } : x)),
      );
      setLock(false);
    }, FLIP_BACK_MS);
  };

  const restart = () => {
    reported.current = false;
    setCards(deal());
    setOpen([]);
    setMoves(0);
    setLock(false);
    setSeconds(0);
    setRunning(false);
  };

  return (
    <div className="game">
      <div className="game-bar">
        <span>
          步数<b>{moves}</b>
        </span>
        <span>
          配对<b>
            {matchedCount}/{PAIRS}
          </b>
        </span>
        <span>
          时间<b>{seconds}</b>
        </span>
        <span className="spacer" />
        <button type="button" className="game-btn" onClick={restart}>
          重新开始
        </button>
      </div>
      <div className="memory" role="grid" aria-label="记忆翻牌">
        {cards.map((c, i) => {
          const show = c.flipped || c.matched;
          return (
            <button
              key={c.id}
              type="button"
              className="memory-card"
              role="gridcell"
              data-open={show || undefined}
              data-matched={c.matched || undefined}
              aria-label={show ? `牌面 ${SYMBOLS[c.pair]}` : `第 ${i + 1} 张，背面`}
              disabled={lock || c.matched}
              onClick={() => flip(i)}
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
      <p className="game-hint" aria-live="polite">
        {won
          ? `全部配对，用了 ${moves} 步、${seconds} 秒${best !== null && moves <= best ? "，新纪录！" : "。"}`
          : best !== null
            ? `本机最少 ${best} 步。点两张牌，相同就留下。`
            : "点两张牌，图案相同就留下。步数越少越好。"}
      </p>
    </div>
  );
}
