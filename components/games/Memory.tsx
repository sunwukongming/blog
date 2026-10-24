"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { buzz, lower, useKeys, useRecord, useRecordList } from "./input";

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
    return { label: d.label, best: n };
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
            {d.label}
          </button>
        ))}
        <span
          className="memory-diff-bar"
          data-hard={diff.key === "hard" || undefined}
          data-easy={diff.key === "easy" || undefined}
          title={`难度 ${diff.label}（${DIFFS.findIndex((d) => d.key === diff.key) + 1}/${DIFFS.length}）`}
          aria-label={`难度 ${diff.label}`}
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
              ? `双高+最少步：剩 ${leftPairs} 对 · ×${streak}${bestStreak > 1 ? ` · 峰 ${bestStreak}` : ""} · 最少 ${shownBest ?? "—"} 步`
              : endgame
                ? `残局：还剩 ${leftPairs} 对 · 连击 ${streak} · 最少 ${shownBest ?? "—"}`
                : bestStreak > 1
                  ? `连击 ${streak} · 峰 ${bestStreak} · 最少 ${shownBest ?? "—"} · 已配 ${matchedCount}/${pairs}`
                  : `已配 ${matchedCount}/${pairs} · 连击 ${streak} · 最少 ${shownBest ?? "—"}（翻错清零）`
          }
        >
          配对<b>
            {matchedCount}/{pairs}
          </b>
          <span
            className="memory-matched-bar"
            data-done={matchedCount >= pairs && pairs > 0 || undefined}
            data-high={pairs > 0 && matchedCount / pairs >= 0.7 || undefined}
            title={`已配 ${matchedCount} / ${pairs}`}
            aria-label={`已配 ${matchedCount} 对`}
          >
            <i
              className="memory-matched-bar__fill"
              style={{
                width: `${pairs ? Math.min(100, Math.round((matchedCount / pairs) * 100)) : 0}%`,
              }}
            />
          </span>
          {endgame ? <small style={{ marginLeft: 4, opacity: 0.85 }}>残局{leftPairs}</small> : null}
          <span
            className="memory-left-bar"
            data-end={endgame || undefined}
            data-urgent={leftPairs > 0 && leftPairs <= 2 || undefined}
            title={`剩余 ${leftPairs} 对 / ${pairs}`}
            aria-label={`剩余 ${leftPairs} 对`}
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
            style={{ ["--end-pct" as string]: `${pairs ? Math.round((matchedCount / pairs) * 100) : 0}%` } as CSSProperties}
          />
          {moves > 0 ? (
            <span
              className="memory-eff-bar"
              data-good={matchedCount / moves >= 0.7 || undefined}
              data-ok={matchedCount / moves >= 0.45 && matchedCount / moves < 0.7 || undefined}
              data-low={matchedCount / moves < 0.45 || undefined}
              title={`配对效率 ${Math.min(100, Math.round((matchedCount / moves) * 100))}%（已配 ${matchedCount} / 步 ${moves}）`}
              aria-label={`配对效率 ${Math.min(100, Math.round((matchedCount / moves) * 100))} percent`}
            >
              <small style={{ marginLeft: 4, opacity: 0.75 }}>
                效率<b>{Math.min(100, Math.round((matchedCount / moves) * 100))}%</b>
              </small>
              <i
                className="memory-eff-bar__fill"
                style={{ width: `${Math.min(100, Math.round((matchedCount / moves) * 100))}%` }}
              />
            </span>
          ) : null}
          <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
          连击<b>{streak}</b>
          {bestStreak > 1 ? <small style={{ marginLeft: 4, opacity: 0.7 }}>峰{bestStreak}</small> : null}
          {bestStreak > 1 ? (
            <span
              className="memory-streak-peak-bar"
              data-peak={streak >= bestStreak && streak > 0 || undefined}
              data-hot={streak >= 5 || undefined}
              title={`连击相对峰值 ${streak}/${bestStreak}`}
              aria-label={`连击相对峰值 ${streak}/${bestStreak}`}
            >
              <i
                className="memory-streak-peak-bar__fill"
                style={{ width: `${Math.min(100, Math.round((streak / Math.max(1, bestStreak)) * 100))}%` }}
              />
            </span>
          ) : null}
          {endgame && streak >= 2 ? <small className="memory-end-combo__both" style={{ marginLeft: 6 }}>双高</small> : null}
          <span
            className="memory-combo__bar"
            aria-hidden="true"
            style={{ ["--combo-pct" as string]: `${Math.min(100, streak * 20)}%` } as CSSProperties}
          />
          <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
          最少<b className={shownBest != null && moves > 0 && moves <= shownBest ? "game-tip--alert" : undefined}>{shownBest ?? "—"}</b>
          <span
            className="memory-pb-bar"
            data-lead={shownBest != null && moves > 0 && moves <= shownBest || undefined}
            data-over={shownBest != null && moves > shownBest || undefined}
            title={
              shownBest != null && moves > 0
                ? `相对最少 ${moves}/${shownBest}（满格=追平或更好）`
                : "尚无本档最少纪录"
            }
            aria-label={
              shownBest != null && moves > 0
                ? `相对最少 ${Math.min(100, Math.round((shownBest / Math.max(moves, shownBest)) * 100))} percent`
                : "无最少纪录"
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
            title={
              shownBest != null && moves > 0
                ? `本局 ${moves} 步 · 最少 ${shownBest} · 步差 ${moves - shownBest >= 0 ? "+" : ""}${moves - shownBest}（色阶 good≤0 / ok≤+2 / warn≤+5 / bad>+5）`
                : `本局 ${moves} 步`
            }
          >
            步数<b>{moves}</b>
            <span
              className="memory-moves-budget-bar"
              data-over={pairs > 0 && moves > pairs * 3 || undefined}
              data-tight={pairs > 0 && moves > pairs * 2 && moves <= pairs * 3 || undefined}
              title={`步数预算 ${moves}/${Math.max(1, pairs * 3)}（软上限 3×对数）`}
              aria-label={`步数预算 ${moves} / ${Math.max(1, pairs * 3)}`}
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
                步差{moves - shownBest >= 0 ? "+" : ""}
                <b className={moves > shownBest ? "game-tip--alert" : undefined}>{moves - shownBest}</b>
              </small>
            ) : null}
            {shownBest != null && moves > 0 && moves <= shownBest ? (
              <span
                className="memory-record-headroom"
                data-lead={shownBest - moves >= 3 || undefined}
                title={`破纪录余量 ${shownBest - moves} 步（当前 ${moves} / 最少 ${shownBest}）`}
                aria-label={`破纪录余量 ${shownBest - moves} 步`}
              >
                <small style={{ marginLeft: 4, opacity: 0.75 }}>余{shownBest - moves}</small>
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
          时间<b>{seconds}</b>
          <span
            className="memory-time-bar"
            data-long={seconds >= 60 || undefined}
            data-over={seconds >= 90 || undefined}
            title={`用时 ${seconds}s（满刻度 90s）`}
            aria-label={`用时 ${seconds} 秒`}
          >
            <i
              className="memory-time-bar__fill"
              style={{ width: `${Math.min(100, Math.round((seconds / 90) * 100))}%` }}
            />
          </span>
          <span
            className="memory-pace-bar"
            data-slow={matchedCount > 0 && seconds / matchedCount >= 8 || undefined}
            data-fast={matchedCount > 0 && seconds / matchedCount <= 3 || undefined}
            title={
              matchedCount > 0
                ? `配速 ${Math.round((seconds / matchedCount) * 10) / 10}s/对（满刻度按 12s/对）`
                : "配速 —（尚未配对）"
            }
            aria-label={
              matchedCount > 0
                ? `配速每对 ${Math.round((seconds / matchedCount) * 10) / 10} 秒`
                : "配速未知"
            }
          >
            <i
              className="memory-pace-bar__fill"
              style={{
                width: `${
                  matchedCount > 0
                    ? Math.min(100, Math.round((seconds / matchedCount / 12) * 100))
                    : 0
                }%`,
              }}
            />
          </span>
          <span
            className="memory-streak-now-bar"
            data-hot={streak >= 5 || undefined}
            data-warm={streak >= 2 && streak < 5 || undefined}
            title={`当前连击 ×${streak}（满刻度按 5）`}
            aria-label={`当前连击 ${streak}`}
          >
            <i
              className="memory-streak-now-bar__fill"
              style={{ width: `${Math.min(100, Math.round((streak / 5) * 100))}%` }}
            />
          </span>
          <span
            className="memory-waste-bar"
            data-hot={Math.max(0, moves - matchedCount * 2) >= 8 || undefined}
            data-warm={Math.max(0, moves - matchedCount * 2) >= 4 && Math.max(0, moves - matchedCount * 2) < 8 || undefined}
            title={`多余翻步 ${Math.max(0, moves - matchedCount * 2)}（满刻度按 12；理想每对 2 步）`}
            aria-label={`多余翻步 ${Math.max(0, moves - matchedCount * 2)}`}
          >
            <i
              className="memory-waste-bar__fill"
              style={{
                width: `${Math.min(100, Math.round((Math.max(0, moves - matchedCount * 2) / 12) * 100))}%`,
              }}
            />
          </span>
        </span>
      </div>
      <p className={endgame || streak >= 2 ? "game-tip game-tip--alert" : "game-tip"} aria-live="polite">
        {endgame && streak >= 2
          ? `双高+最少步：${matchedCount}/${pairs}（${pairs ? Math.round((matchedCount / pairs) * 100) : 0}%）· 剩 ${leftPairs} · ×${streak}${bestStreak > 1 ? `（峰 ${bestStreak}）` : ""} · 最少 ${shownBest ?? "—"} · 焦点 第${focusRow}行${focusCol}列`
          : endgame
          ? `残局进度：${matchedCount}/${pairs}（${pairs ? Math.round((matchedCount / pairs) * 100) : 0}%）· 剩 ${leftPairs} 对 · 焦点 第${focusRow}行${focusCol}列 · 连击 ${streak}${bestStreak > 1 ? `（峰 ${bestStreak}）` : ""}`
          : streak >= 5
            ? `连击热：×${streak} · 条格 ${Math.min(100, streak * 20)}%（×5 满格）· 峰 ${bestStreak > 1 ? bestStreak : streak}`
            : streak >= 2
              ? `连击条：×${streak} · 条格 ${Math.min(100, streak * 20)}%${bestStreak > 1 ? ` · 峰 ${bestStreak}` : ""} · 翻错清零`
              : `本局连击 ${streak}${bestStreak > 1 ? `（本档峰 ${bestStreak}）` : ""}`}
        {" · "}
        最少 <b>{shownBest ?? "—"}</b> 步
        {shownBest != null && moves > 0
          ? ` · 步差色 ${moves - shownBest >= 0 ? "+" : ""}${moves - shownBest}（${
              moves <= shownBest ? "good" : moves - shownBest <= 2 ? "ok" : moves - shownBest <= 5 ? "warn" : "bad"
            }）${moves - shownBest > 2 ? " · 条脉冲" : ""}`
          : ` · 本局 ${moves} 步`}
        {" · "}
        各档：
        {allDiffBests.map((x, i) => (
          <span key={DIFFS[i].key}>
            {i > 0 ? " · " : ""}
            {x.label}{" "}
            <b className={DIFFS[i].key === diff.key ? "game-tip--alert" : undefined}>{x.best ?? "—"}</b>
          </span>
        ))}
        {endgame ? " · 方向键移焦后回车翻，少翻错" : " · 切换难度保留连击峰"}
      </p>
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
          : endgame
            ? `残局焦点：第${focusRow}行${focusCol}列（牌 ${focus + 1}），还剩 ${leftPairs} 对；方向键移焦，回车/空格翻牌。`
            : streak >= 2
              ? `连击 ×${streak}！连续配对会累加；翻错就清零。`
              : shownBest !== null
                ? `${diff.label}本机最少 ${shownBest} 步。连续配对可连击；方向键移动，Home/End 跳首尾，回车或空格翻牌。`
                : "连续配对会显示连击。方向键移动焦点，Home/End 跳首尾，回车或空格翻牌；也可点选。步数越少越好。"}
      </p>
    </div>
  );
}
