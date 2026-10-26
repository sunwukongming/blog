"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useT } from "@/components/i18n/LangProvider";
import { buzz, lower, useKeys, useRecord, useRecordList } from "./input";
import { MEMORY_MESSAGES } from "./Memory.messages";

type Diff = { key: "easy" | "normal" | "hard"; cols: number; rows: number };
type Card = { id: number; pair: number; flipped: boolean; matched: boolean };

const DIFFS: Diff[] = [
  { key: "easy", cols: 3, rows: 4 },
  { key: "normal", cols: 4, rows: 4 },
  { key: "hard", cols: 5, rows: 4 },
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
  const t = useT(MEMORY_MESSAGES);
  const [diff, setDiff] = useState<Diff>(DIFFS[1]);
  const diffLabel = t.diff[diff.key];
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
  /** 难度切换时保留各档最高连击（步数纪录仍走 useRecord） */
  const bestStreakByDiff = useRef<Record<string, number>>({});
  const [best, submitBest] = useRecord(recordKey(diff), lower);
  // 兼容第一批只写过 memory 键的普通难度纪录
  const [legacy] = useRecord("memory", lower);
  const shownBest = best ?? (diff.key === "normal" ? legacy : null);
  const allDiffKeys = DIFFS.map((d) => recordKey(d));
  const allDiffRaw = useRecordList(allDiffKeys);
  const allDiffBests = DIFFS.map((d, i) => {
    const v = allDiffRaw[i];
    const n = d.key === "normal" ? (v ?? legacy) : v;
    return { label: t.diff[d.key], best: n };
  });
  const reported = useRef(false);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const matchedCount = useMemo(() => cards.filter((c) => c.matched).length / 2, [cards]);
  const leftPairs = pairs - matchedCount;
  const won = matchedCount === pairs;
  const endgame = running && !won && leftPairs > 0 && leftPairs <= 3;
  const focusRow = Math.floor(focus / diff.cols) + 1;
  const focusCol = (focus % diff.cols) + 1;

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
      setBestStreak((b) => {
        const n = Math.max(b, nextStreak);
        bestStreakByDiff.current[diff.key] = Math.max(bestStreakByDiff.current[diff.key] ?? 0, n);
        return n;
      });
      buzz(nextStreak >= 3 ? [18, 40, 18] : 18);
      setAnnounce(nextStreak >= 2 ? t.announceCombo(SYMBOLS[pairA], nextStreak) : t.announceMatch(SYMBOLS[pairA]));
      setCards((prev) => prev.map((x) => (x.id === a || x.id === i ? { ...x, flipped: true, matched: true } : x)));
      return;
    }

    setStreak(0);
    setAnnounce(t.announceMiss);
    setLock(true);
    window.setTimeout(() => {
      setCards((prev) => prev.map((x) => (x.id === a || x.id === i ? { ...x, flipped: false } : x)));
      setLock(false);
    }, FLIP_BACK_MS);
  };

  const restart = (next = diff) => {
    bestStreakByDiff.current[diff.key] = Math.max(bestStreakByDiff.current[diff.key] ?? 0, bestStreak);
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
    setBestStreak(bestStreakByDiff.current[next.key] ?? 0);
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
            {t.diff[d.key]}
          </button>
        ))}
        <span
          className="memory-diff-bar"
          data-hard={diff.key === "hard" || undefined}
          data-easy={diff.key === "easy" || undefined}
          title={t.diffTitle(diffLabel, DIFFS.findIndex((d) => d.key === diff.key) + 1, DIFFS.length)}
          aria-label={t.diffAria(diffLabel)}
        >
          <i
            className="memory-diff-bar__fill"
            style={{
              width: `${Math.min(
                100,
                Math.round(((DIFFS.findIndex((d) => d.key === diff.key) + 1) / Math.max(1, DIFFS.length)) * 100),
              )}%`,
            }}
          />
        </span>
        <span className="spacer" />
        <span
          className={
            endgame || streak >= 2
              ? "memory-end-combo memory-endgame memory-combo memory-moves-delta-host memory-streak-peak-host memory-eff-host game-tip--alert"
              : "memory-end-combo memory-endgame memory-combo memory-moves-delta-host memory-streak-peak-host memory-eff-host"
          }
          data-endgame={endgame || undefined}
          data-combo={streak >= 2 || undefined}
          data-both={(endgame && streak >= 2) || undefined}
          data-best={shownBest != null || undefined}
          data-level={streak >= 5 ? "hot" : streak >= 3 ? "warm" : streak >= 2 ? "on" : undefined}
          title={
            endgame && streak >= 2
              ? t.hudBothTitle(leftPairs, streak, bestStreak, shownBest ?? "—")
              : endgame
                ? t.hudEndTitle(leftPairs, streak, shownBest ?? "—")
                : bestStreak > 1
                  ? t.hudPeakTitle(streak, bestStreak, shownBest ?? "—", matchedCount, pairs)
                  : t.hudPlainTitle(matchedCount, pairs, streak, shownBest ?? "—")
          }
        >
          {t.pairs}
          <b>
            {matchedCount}/{pairs}
          </b>
          <span
            className="memory-matched-bar"
            data-done={(matchedCount >= pairs && pairs > 0) || undefined}
            data-high={(pairs > 0 && matchedCount / pairs >= 0.7) || undefined}
            title={t.matchedTitle(matchedCount, pairs)}
            aria-label={t.matchedAria(matchedCount)}
          >
            <i
              className="memory-matched-bar__fill"
              style={{
                width: `${pairs ? Math.min(100, Math.round((matchedCount / pairs) * 100)) : 0}%`,
              }}
            />
          </span>
          {endgame ? <small style={{ marginLeft: 4, opacity: 0.85 }}>{t.endgameShort(leftPairs)}</small> : null}
          <span
            className="memory-left-bar"
            data-end={endgame || undefined}
            data-urgent={(leftPairs > 0 && leftPairs <= 2) || undefined}
            title={t.leftTitle(leftPairs, pairs)}
            aria-label={t.leftAria(leftPairs)}
          >
            <i
              className="memory-left-bar__fill"
              style={{
                width: `${Math.min(100, Math.round((leftPairs / Math.max(1, pairs)) * 100))}%`,
              }}
            />
          </span>
          <span
            className="memory-endgame__bar"
            aria-hidden="true"
            style={
              { ["--end-pct" as string]: `${pairs ? Math.round((matchedCount / pairs) * 100) : 0}%` } as CSSProperties
            }
          />
          {moves > 0 ? (
            <span
              className="memory-eff-bar"
              data-good={matchedCount / moves >= 0.7 || undefined}
              data-ok={(matchedCount / moves >= 0.45 && matchedCount / moves < 0.7) || undefined}
              data-low={matchedCount / moves < 0.45 || undefined}
              title={t.effTitle(Math.min(100, Math.round((matchedCount / moves) * 100)), matchedCount, moves)}
              aria-label={t.effAria(Math.min(100, Math.round((matchedCount / moves) * 100)))}
            >
              <small style={{ marginLeft: 4, opacity: 0.75 }}>
                {t.eff}
                <b>{Math.min(100, Math.round((matchedCount / moves) * 100))}%</b>
              </small>
              <i
                className="memory-eff-bar__fill"
                style={{ width: `${Math.min(100, Math.round((matchedCount / moves) * 100))}%` }}
              />
            </span>
          ) : null}
          <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
          {t.combo}
          <b>{streak}</b>
          {bestStreak > 1 ? <small style={{ marginLeft: 4, opacity: 0.7 }}>{t.peakShort(bestStreak)}</small> : null}
          {bestStreak > 1 ? (
            <span
              className="memory-streak-peak-bar"
              data-peak={(streak >= bestStreak && streak > 0) || undefined}
              data-hot={streak >= 5 || undefined}
              title={t.streakPeak(streak, bestStreak)}
              aria-label={t.streakPeak(streak, bestStreak)}
            >
              <i
                className="memory-streak-peak-bar__fill"
                style={{ width: `${Math.min(100, Math.round((streak / Math.max(1, bestStreak)) * 100))}%` }}
              />
            </span>
          ) : null}
          {endgame && streak >= 2 ? (
            <small className="memory-end-combo__both" style={{ marginLeft: 6 }}>
              {t.both}
            </small>
          ) : null}
          <span
            className="memory-combo__bar"
            aria-hidden="true"
            style={{ ["--combo-pct" as string]: `${Math.min(100, streak * 20)}%` } as CSSProperties}
          />
          <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
          {t.fewest}
          <b className={shownBest != null && moves > 0 && moves <= shownBest ? "game-tip--alert" : undefined}>
            {shownBest ?? "—"}
          </b>
          <span
            className="memory-pb-bar"
            data-lead={(shownBest != null && moves > 0 && moves <= shownBest) || undefined}
            data-over={(shownBest != null && moves > shownBest) || undefined}
            title={shownBest != null && moves > 0 ? t.pbTitle(moves, shownBest) : t.pbNone}
            aria-label={
              shownBest != null && moves > 0
                ? t.pbAria(Math.min(100, Math.round((shownBest / Math.max(moves, shownBest)) * 100)))
                : t.pbAriaNone
            }
          >
            <i
              className="memory-pb-bar__fill"
              style={{
                width: `${
                  shownBest != null && moves > 0
                    ? Math.min(100, Math.round((shownBest / Math.max(moves, shownBest)) * 100))
                    : 0
                }%`,
              }}
            />
          </span>
          <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
          <span
            className="memory-moves-delta memory-moves-delta--tier"
            data-over={shownBest != null && moves > shownBest ? true : undefined}
            data-under={shownBest != null && moves > 0 && moves <= shownBest ? true : undefined}
            data-tier={
              shownBest == null || moves <= 0
                ? undefined
                : moves <= shownBest
                  ? "good"
                  : moves - shownBest <= 2
                    ? "ok"
                    : moves - shownBest <= 5
                      ? "warn"
                      : "bad"
            }
            title={shownBest != null && moves > 0 ? t.deltaTitle(moves, shownBest) : t.movesThisRound(moves)}
          >
            {t.moves}
            <b>{moves}</b>
            <span
              className="memory-moves-budget-bar"
              data-over={(pairs > 0 && moves > pairs * 3) || undefined}
              data-tight={(pairs > 0 && moves > pairs * 2 && moves <= pairs * 3) || undefined}
              title={t.budgetTitle(moves, Math.max(1, pairs * 3))}
              aria-label={t.budgetAria(moves, Math.max(1, pairs * 3))}
            >
              <i
                className="memory-moves-budget-bar__fill"
                style={{
                  width: `${Math.min(100, Math.round((moves / Math.max(1, pairs * 3)) * 100))}%`,
                }}
              />
            </span>
            {shownBest != null && moves > 0 ? (
              <small className="memory-moves-delta__diff" style={{ marginLeft: 4 }}>
                {t.deltaLabel}
                {moves - shownBest >= 0 ? "+" : ""}
                <b className={moves > shownBest ? "game-tip--alert" : undefined}>{moves - shownBest}</b>
              </small>
            ) : null}
            {shownBest != null && moves > 0 && moves <= shownBest ? (
              <span
                className="memory-record-headroom"
                data-lead={shownBest - moves >= 3 || undefined}
                title={t.headroomTitle(shownBest - moves, moves, shownBest)}
                aria-label={t.headroomAria(shownBest - moves)}
              >
                <small style={{ marginLeft: 4, opacity: 0.75 }}>{t.headroomShort(shownBest - moves)}</small>
                <i
                  className="memory-record-headroom__fill"
                  style={{
                    width: `${Math.min(100, Math.round(((shownBest - moves) / Math.max(1, shownBest)) * 100))}%`,
                  }}
                />
              </span>
            ) : null}
            <span
              className={
                shownBest != null && moves > 0 && moves - shownBest > 2
                  ? "memory-moves-delta__bar memory-moves-delta__bar--pulse"
                  : "memory-moves-delta__bar"
              }
              data-pulse={shownBest != null && moves > 0 && moves - shownBest > 2 ? true : undefined}
              data-tier={
                shownBest == null || moves <= 0
                  ? undefined
                  : moves <= shownBest
                    ? "good"
                    : moves - shownBest <= 2
                      ? "ok"
                      : moves - shownBest <= 5
                        ? "warn"
                        : "bad"
              }
              aria-hidden="true"
              style={
                {
                  ["--delta-pct" as string]: `${
                    shownBest != null && moves > 0
                      ? Math.min(100, Math.max(0, moves <= shownBest ? 8 : ((moves - shownBest) / 8) * 100))
                      : 0
                  }%`,
                } as CSSProperties
              }
            />
          </span>
        </span>
        <span>
          {t.time}
          <b>{seconds}</b>
          <span
            className="memory-time-bar"
            data-long={seconds >= 60 || undefined}
            data-over={seconds >= 90 || undefined}
            title={t.timeTitle(seconds)}
            aria-label={t.timeAria(seconds)}
          >
            <i
              className="memory-time-bar__fill"
              style={{ width: `${Math.min(100, Math.round((seconds / 90) * 100))}%` }}
            />
          </span>
          <span
            className="memory-pace-bar"
            data-slow={(matchedCount > 0 && seconds / matchedCount >= 8) || undefined}
            data-fast={(matchedCount > 0 && seconds / matchedCount <= 3) || undefined}
            title={matchedCount > 0 ? t.paceTitle(Math.round((seconds / matchedCount) * 10) / 10) : t.paceNone}
            aria-label={matchedCount > 0 ? t.paceAria(Math.round((seconds / matchedCount) * 10) / 10) : t.paceAriaNone}
          >
            <i
              className="memory-pace-bar__fill"
              style={{
                width: `${matchedCount > 0 ? Math.min(100, Math.round((seconds / matchedCount / 12) * 100)) : 0}%`,
              }}
            />
          </span>
          <span
            className="memory-streak-now-bar"
            data-hot={streak >= 5 || undefined}
            data-warm={(streak >= 2 && streak < 5) || undefined}
            title={t.streakNowTitle(streak)}
            aria-label={t.streakNowAria(streak)}
          >
            <i
              className="memory-streak-now-bar__fill"
              style={{ width: `${Math.min(100, Math.round((streak / 5) * 100))}%` }}
            />
          </span>
          <span
            className="memory-waste-bar"
            data-hot={Math.max(0, moves - matchedCount * 2) >= 8 || undefined}
            data-warm={
              (Math.max(0, moves - matchedCount * 2) >= 4 && Math.max(0, moves - matchedCount * 2) < 8) || undefined
            }
            title={t.wasteTitle(Math.max(0, moves - matchedCount * 2))}
            aria-label={t.wasteAria(Math.max(0, moves - matchedCount * 2))}
          >
            <i
              className="memory-waste-bar__fill"
              style={{
                width: `${Math.min(100, Math.round((Math.max(0, moves - matchedCount * 2) / 12) * 100))}%`,
              }}
            />
          </span>
          <span
            className="memory-flip-rate-bar"
            data-hot={(seconds > 0 && moves / seconds >= 0.7) || undefined}
            data-slow={(seconds >= 20 && moves / Math.max(1, seconds) < 0.25) || undefined}
            title={seconds > 0 ? t.flipRateTitle(Math.round((moves / seconds) * 60)) : t.flipRateNone}
            aria-label={seconds > 0 ? t.flipRateAria(Math.round((moves / seconds) * 60)) : t.flipRateAriaNone}
          >
            <i
              className="memory-flip-rate-bar__fill"
              style={{
                width: `${seconds > 0 ? Math.min(100, Math.round((((moves / seconds) * 60) / 40) * 100)) : 0}%`,
              }}
            />
          </span>
          <span
            className="memory-match-rate-bar"
            data-hot={(seconds > 0 && matchedCount / seconds >= 0.25) || undefined}
            data-slow={(seconds >= 30 && matchedCount / Math.max(1, seconds) < 0.06) || undefined}
            title={
              seconds > 0 ? t.matchRateTitle(Math.round((matchedCount / seconds) * 60 * 10) / 10) : t.matchRateNone
            }
            aria-label={
              seconds > 0 ? t.matchRateAria(Math.round((matchedCount / seconds) * 60 * 10) / 10) : t.matchRateAriaNone
            }
          >
            <i
              className="memory-match-rate-bar__fill"
              style={{
                width: `${seconds > 0 ? Math.min(100, Math.round((((matchedCount / seconds) * 60) / 15) * 100)) : 0}%`,
              }}
            />
          </span>
          <span
            className="memory-streak-ratio-bar"
            data-hot={(streak >= 3 && bestStreak > 0 && streak >= bestStreak) || undefined}
            data-warm={(streak >= 2 && bestStreak > 0 && streak / bestStreak >= 0.6) || undefined}
            title={bestStreak > 0 ? t.streakRatioTitle(streak, bestStreak) : t.streakOnly(streak)}
            aria-label={bestStreak > 0 ? t.streakRatioAria(streak, bestStreak) : t.streakOnly(streak)}
          >
            <i
              className="memory-streak-ratio-bar__fill"
              style={{
                width: `${
                  bestStreak > 0
                    ? Math.min(100, Math.round((streak / bestStreak) * 100))
                    : Math.min(100, Math.round((streak / 5) * 100))
                }%`,
              }}
            />
          </span>
          <span
            className="memory-accuracy-bar"
            data-hot={(moves > 0 && (matchedCount * 2) / moves >= 0.85) || undefined}
            data-cold={(moves >= 8 && (matchedCount * 2) / Math.max(1, moves) < 0.45) || undefined}
            title={moves > 0 ? t.accuracyTitle(Math.round(((matchedCount * 2) / moves) * 100)) : t.accuracyNone}
            aria-label={moves > 0 ? t.accuracyAria(Math.round(((matchedCount * 2) / moves) * 100)) : t.accuracyAriaNone}
          >
            <i
              className="memory-accuracy-bar__fill"
              style={{
                width: `${moves > 0 ? Math.min(100, Math.round(((matchedCount * 2) / moves) * 100)) : 0}%`,
              }}
            />
          </span>
          <span
            className="memory-remain-ratio-bar"
            data-hot={(pairs - matchedCount <= 2 && pairs - matchedCount > 0) || undefined}
            data-cold={(pairs > 0 && (pairs - matchedCount) / pairs >= 0.75 && seconds >= 25) || undefined}
            title={pairs > 0 ? t.remainTitle(pairs - matchedCount, pairs) : t.remainNone}
            aria-label={t.remainAria(pairs - matchedCount)}
          >
            <i
              className="memory-remain-ratio-bar__fill"
              style={{
                width: `${pairs > 0 ? Math.min(100, Math.round(((pairs - matchedCount) / pairs) * 100)) : 0}%`,
              }}
            />
          </span>
          <span
            className="memory-done-ratio-bar"
            data-hot={(pairs > 0 && matchedCount / pairs >= 0.85) || undefined}
            data-low={(pairs > 0 && matchedCount / pairs <= 0.2 && seconds >= 20) || undefined}
            title={pairs > 0 ? t.doneTitle(matchedCount, pairs) : t.doneNone}
            aria-label={t.doneAria(matchedCount, pairs)}
          >
            <i
              className="memory-done-ratio-bar__fill"
              style={{
                width: `${pairs > 0 ? Math.min(100, Math.round((matchedCount / pairs) * 100)) : 0}%`,
              }}
            />
          </span>
          <span
            className="memory-match-pace-bar"
            data-hot={(seconds > 0 && matchedCount / seconds >= 0.25) || undefined}
            data-slow={(seconds >= 25 && matchedCount / Math.max(1, seconds) < 0.06) || undefined}
            title={seconds > 0 ? t.matchPaceTitle(Math.round((matchedCount / seconds) * 100) / 100) : t.matchPaceNone}
            aria-label={
              seconds > 0 ? t.matchPaceAria(Math.round((matchedCount / seconds) * 100) / 100) : t.matchPaceAriaNone
            }
          >
            <i
              className="memory-match-pace-bar__fill"
              style={{
                width: `${seconds > 0 ? Math.min(100, Math.round((matchedCount / seconds / 0.3) * 100)) : 0}%`,
              }}
            />
          </span>
          <span
            className="memory-moves-eff-bar"
            data-hot={(moves > 0 && matchedCount / moves >= 0.45) || undefined}
            data-low={(moves >= 8 && matchedCount / Math.max(1, moves) < 0.2) || undefined}
            title={moves > 0 ? t.movesEffTitle(Math.round((matchedCount / moves) * 100) / 100) : t.movesEffNone}
            aria-label={moves > 0 ? t.movesEffAria(Math.round((matchedCount / moves) * 100) / 100) : t.movesEffAriaNone}
          >
            <i
              className="memory-moves-eff-bar__fill"
              style={{
                width: `${moves > 0 ? Math.min(100, Math.round((matchedCount / moves / 0.5) * 100)) : 0}%`,
              }}
            />
          </span>
        </span>
      </div>
      <p className={endgame || streak >= 2 ? "game-tip game-tip--alert" : "game-tip"} aria-live="polite">
        {endgame && streak >= 2
          ? t.tipBoth(
              matchedCount,
              pairs,
              pairs ? Math.round((matchedCount / pairs) * 100) : 0,
              leftPairs,
              streak,
              bestStreak,
              shownBest ?? "—",
              t.focusPos(focusRow, focusCol),
            )
          : endgame
            ? t.tipEnd(
                matchedCount,
                pairs,
                pairs ? Math.round((matchedCount / pairs) * 100) : 0,
                leftPairs,
                t.focusPos(focusRow, focusCol),
                streak,
                bestStreak,
              )
            : streak >= 5
              ? t.tipHot(streak, Math.min(100, streak * 20), bestStreak > 1 ? bestStreak : streak)
              : streak >= 2
                ? t.tipCombo(streak, Math.min(100, streak * 20), bestStreak)
                : t.tipPlain(streak, bestStreak)}
        {" · "}
        {t.tipFewestBefore}
        <b>{shownBest ?? "—"}</b>
        {t.tipFewestAfter}
        {shownBest != null && moves > 0
          ? t.tipDelta(
              moves - shownBest,
              moves <= shownBest ? "good" : moves - shownBest <= 2 ? "ok" : moves - shownBest <= 5 ? "warn" : "bad",
              moves - shownBest > 2,
            )
          : t.tipMoves(moves)}
        {" · "}
        {t.perDiff}
        {allDiffBests.map((x, i) => (
          <span key={DIFFS[i].key}>
            {i > 0 ? " · " : ""}
            {x.label} <b className={DIFFS[i].key === diff.key ? "game-tip--alert" : undefined}>{x.best ?? "—"}</b>
          </span>
        ))}
        {endgame ? t.tipEndHint : t.tipSwitchHint}
      </p>
      <div
        className="memory"
        role="grid"
        aria-label={t.gridAria(diffLabel)}
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
              aria-label={show ? t.cardFace(SYMBOLS[c.pair]) : t.cardBack(i + 1)}
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
          {t.restart}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <p className="game-hint" aria-live="polite">
        {won
          ? t.hintWon(moves, seconds, bestStreak, shownBest !== null && moves <= shownBest)
          : endgame
            ? t.hintEnd(t.focusPos(focusRow, focusCol), focus + 1, leftPairs)
            : streak >= 2
              ? t.hintCombo(streak)
              : shownBest !== null
                ? t.hintBest(diffLabel, shownBest)
                : t.hintDefault}
      </p>
    </div>
  );
}
