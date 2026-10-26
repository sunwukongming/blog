"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { mascotSay, pick, POKER_ALLIN, POKER_BIG_WIN, POKER_BUST } from "@/lib/mascot";
import { useLang, useT } from "@/components/i18n/LangProvider";
import { POKER_MESSAGES } from "./Poker.messages";
import { buzz, higher, useKeys, useRecord } from "./input";
import {
  act,
  botAction,
  BLIND_EVERY,
  handRank,
  bestHand,
  humanOut,
  humanWonTable,
  legal,
  newTable,
  potSize,
  runoutStep,
  startHand,
  type Action,
  type Card,
  STARTING_CHIPS,
  type Table,
} from "./pokerLogic";

const BOT_DELAY = 750;
const RUNOUT_DELAY = 900;
const RANK_TEXT: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };

// 花色用 SVG 画，♠♥♦♣ 在一些字体里会显示成方框
function Suit({ s }: { s: number }) {
  const fill = s === 1 || s === 2 ? "#ff4d6d" : "#1b1530";
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
      {s === 0 && (
        <path fill={fill} d="M8 1C6.5 4 2 6 2 9.4a3 3 0 0 0 5.2 2L6.3 15h3.4l-.9-3.6a3 3 0 0 0 5.2-2C14 6 9.5 4 8 1z" />
      )}
      {s === 1 && (
        <path fill={fill} d="M8 14.5S1.5 10 1.5 5.6A3.4 3.4 0 0 1 8 4a3.4 3.4 0 0 1 6.5 1.6C14.5 10 8 14.5 8 14.5z" />
      )}
      {s === 2 && <path fill={fill} d="M8 1l5.2 7L8 15 2.8 8z" />}
      {s === 3 && (
        <g fill={fill}>
          <circle cx="8" cy="4.6" r="3" />
          <circle cx="4.6" cy="9.2" r="3" />
          <circle cx="11.4" cy="9.2" r="3" />
          <path d="M7 9.5h2l1.1 5.5H5.9z" />
        </g>
      )}
    </svg>
  );
}

function PlayingCard({ card, hidden, glow, dim }: { card?: Card; hidden?: boolean; glow?: boolean; dim?: boolean }) {
  const t = useT(POKER_MESSAGES);
  if (!card) return <span className="pk-card pk-card--empty" />;
  if (hidden) return <span className="pk-card pk-card--back" aria-label={t.cardBack} />;
  return (
    <span
      className="pk-card"
      data-red={card.s === 1 || card.s === 2 || undefined}
      data-glow={glow || undefined}
      data-dim={dim || undefined}
      aria-label={t.cardAria(t.suits[card.s], RANK_TEXT[card.r] ?? card.r)}
    >
      <b>{RANK_TEXT[card.r] ?? card.r}</b>
      <Suit s={card.s} />
    </span>
  );
}

const same = (a: Card, b: Card) => a.r === b.r && a.s === b.s;
const SEAT_AREA = ["me", "left", "top", "right"];

export default function Poker() {
  const lang = useLang();
  const t = useT(POKER_MESSAGES);
  const [table, setTable] = useState<Table>(() => newTable());
  const [raiseTo, setRaiseTo] = useState(0);
  const [best, submitBest] = useRecord("poker", higher);
  const me = table.players[0];
  const myTurn = table.toAct === 0 && table.street !== "done";
  const rules = myTurn ? legal(table) : null;
  const done = table.street === "done";
  const started = table.hand > 0;
  const gameOver = started && humanOut(table);
  const victory = started && !gameOver && humanWonTable(table);
  const pot = potSize(table);
  // 只存数字，文字在渲染时按当前语言拼，切换语言时提示也跟着变
  const [blindFlash, setBlindFlash] = useState<{ from: number; sb: number; bb: number; next: number } | null>(null);
  const prevSb = useRef(table.sb);
  // next hand number where blinds double (hands 11, 21, 31…)
  const nextBlindHand =
    table.hand <= 0 ? BLIND_EVERY + 1 : Math.floor((table.hand - 1) / BLIND_EVERY) * BLIND_EVERY + BLIND_EVERY + 1;

  useEffect(() => {
    if (table.hand > 0 && table.sb > prevSb.current) {
      const from = prevSb.current;
      setBlindFlash({ from, sb: table.sb, bb: table.bb, next: nextBlindHand });
      buzz([30, 40, 30, 40, 50]);
      prevSb.current = table.sb;
      const id = window.setTimeout(() => setBlindFlash(null), 6500);
      return () => clearTimeout(id);
    }
    prevSb.current = table.sb;
  }, [table.hand, table.sb, table.bb, nextBlindHand]);
  const blindFlashText = blindFlash
    ? t.blindFlash(blindFlash.from, blindFlash.sb, blindFlash.bb, blindFlash.next)
    : null;

  const update = (fn: (t: Table) => void) => {
    const next = structuredClone(table);
    fn(next);
    setTable(next);
  };

  // 电脑行动、自动发牌都用定时器推进，节奏像真人在打
  useEffect(() => {
    if (table.street === "done") return;
    const step = table.runout ? runoutStep : table.toAct > 0 ? (t: Table) => act(t, botAction(t)) : null;
    if (!step) return;
    const id = setTimeout(
      () =>
        setTable((cur) => {
          const next = structuredClone(cur);
          step(next);
          return next;
        }),
      table.runout ? RUNOUT_DELAY : BOT_DELAY,
    );
    return () => clearTimeout(id);
  }, [table]);

  // 每手牌结束时：记录最高筹码，赢了轻震一下
  const onHandOver = useEffectEvent(() => {
    submitBest(table.players[0].chips);
    const won = table.result?.pots.filter((p) => p.winners.includes(0)).reduce((s, p) => s + p.amount, 0) ?? 0;
    if (won > 0) buzz([20, 40, 20]);
    // 看板娘的反应：赢下大底池会兴奋，输光了会安慰
    if (humanOut(table)) mascotSay(pick(POKER_BUST[lang]));
    else if (won >= table.bb * 15) mascotSay(pick(POKER_BIG_WIN[lang]));
  });
  useEffect(() => {
    if (done && started) onHandOver();
  }, [done, started, table.hand]);

  const deal = () => {
    setRaiseTo(0);
    // 纪录从起始筹码算起，第一手输一点也不会出现低于 1000 的“最高”
    submitBest(STARTING_CHIPS);
    update((t) => {
      if (humanOut(t) || humanWonTable(t)) {
        Object.assign(t, newTable());
        prevSb.current = t.sb;
        setBlindFlash(null);
      }
      startHand(t);
    });
  };

  const play = (a: Action) => {
    if (!myTurn) return;
    if (a.type === "allin") mascotSay(pick(POKER_ALLIN[lang]));
    update((t) => act(t, a));
  };

  const minTo = rules?.minTo ?? 0;
  const maxTo = rules?.maxTo ?? 0;
  // clamp raise display when last hand amount is out of this street range
  const raiseValue = rules ? (raiseTo >= minTo && raiseTo <= maxTo ? raiseTo : minTo) : 0;
  const presets = rules
    ? [
        { label: t.halfPot, to: table.currentBet + Math.round(pot / 2) },
        { label: t.fullPot, to: table.currentBet + pot },
      ].filter((p) => p.to > minTo && p.to < maxTo)
    : [];

  useKeys((key, repeat) => {
    if (repeat) return false;
    const k = key.toLowerCase();
    if (myTurn && rules) {
      if (k === "f") play({ type: "fold" });
      else if (k === "c" || key === " ") play(rules.canCheck ? { type: "check" } : { type: "call" });
      else if (k === "r" && rules.canRaise) play({ type: "raise", to: raiseValue });
      else if (k === "a") play({ type: "allin" });
      else return false;
      return true;
    }
    if (done && (key === "Enter" || key === " ")) {
      deal();
      return true;
    }
    return false;
  });

  // 我的当前牌型（翻牌后才有）
  const myHand =
    !me.folded && table.board.length >= 3 ? t.hands[handRank(bestHand([...me.hand, ...table.board]).score)] : "";
  const result = table.result;
  const winBest = result?.showdown ? result.best : {};
  const winners = new Set(result?.pots.flatMap((p) => p.winners));
  const glowCards = result?.showdown ? [...winners].flatMap((w) => winBest[w] ?? []) : [];
  const isGlow = (c: Card) => glowCards.some((g) => same(g, c));

  const message = (() => {
    if (!started) return t.msgIntro(STARTING_CHIPS, BLIND_EVERY);
    if (gameOver) return t.msgBust;
    if (victory) return t.msgVictory;
    if (result) {
      const multi = result.pots.length > 1;
      return (
        (multi ? t.msgSplit(result.pots.length) : "") +
        result.pots
          .map((p, i) => {
            const names = p.winners.map((w) => t.names[table.players[w].style]).join(t.nameSep);
            const label = multi ? (i === 0 ? t.potMain : t.potSide(i)) : t.potOnly;
            return t.msgWin(names, p.rank === null ? "" : t.hands[p.rank], label, p.amount);
          })
          .join(t.potSep)
      );
    }
    if (table.runout) return t.msgRunout;
    if (myTurn) return rules!.canCheck ? t.msgYourTurn : t.msgYourTurnCall(rules!.toCall);
    const thinker = table.players[table.toAct];
    return t.msgThinking(thinker ? t.names[thinker.style] : "");
  })();

  return (
    <div className="game poker">
      <div className="game-bar">
        <span>
          {t.handBefore}
          <b>{table.hand}</b>
          {t.handAfter}
          <span
            className="pk-hand-bar"
            data-near={(started && !gameOver && !victory && Math.max(0, nextBlindHand - table.hand) <= 2) || undefined}
            title={
              started && !gameOver && !victory
                ? t.handBarTitleProg(
                    table.hand,
                    Math.min(100, Math.round(((((table.hand - 1) % BLIND_EVERY) + 1) / BLIND_EVERY) * 100)),
                    BLIND_EVERY,
                  )
                : t.handBarTitle(table.hand)
            }
            aria-label={t.handAria(table.hand)}
          >
            <i
              style={{
                width: `${
                  started && !gameOver && !victory
                    ? Math.min(100, Math.round(((((table.hand - 1) % BLIND_EVERY) + 1) / BLIND_EVERY) * 100))
                    : Math.min(100, Math.round((table.hand / 40) * 100))
                }%`,
              }}
            />
          </span>
          <span
            className="pk-street-bar"
            data-river={table.street === "river" || undefined}
            data-done={table.street === "done" || undefined}
            title={t.streetTitle(table.street)}
            aria-label={t.streetTitle(table.street)}
          >
            <i
              style={{
                width: `${
                  table.street === "done"
                    ? 100
                    : table.street === "river"
                      ? 80
                      : table.street === "turn"
                        ? 60
                        : table.street === "flop"
                          ? 40
                          : started
                            ? 20
                            : 0
                }%`,
              }}
            />
          </span>
          <span
            className="pk-board-bar"
            data-river={table.board.length >= 5 || undefined}
            data-turn={table.board.length === 4 || undefined}
            title={t.boardTitle(table.board.length)}
            aria-label={t.boardAria(table.board.length)}
          >
            <i
              style={{
                width: `${Math.min(100, Math.round((table.board.length / 5) * 100))}%`,
              }}
            />
          </span>
          <span
            className="pk-active-bar"
            data-heads={table.players.filter((p) => !p.folded).length <= 2 || undefined}
            data-multi={table.players.filter((p) => !p.folded).length >= 4 || undefined}
            title={t.activeTitle(table.players.filter((p) => !p.folded).length, table.players.length)}
            aria-label={t.activeAria(table.players.filter((p) => !p.folded).length)}
          >
            <i
              style={{
                width: `${
                  table.players.length
                    ? Math.min(
                        100,
                        Math.round((table.players.filter((p) => !p.folded).length / table.players.length) * 100),
                      )
                    : 0
                }%`,
              }}
            />
          </span>
          <span
            className="pk-fold-bar"
            data-heavy={
              table.players.filter((p) => p.folded).length >= Math.ceil(table.players.length * 0.6) || undefined
            }
            data-none={table.players.filter((p) => p.folded).length === 0 || undefined}
            title={t.foldedTitle(table.players.filter((p) => p.folded).length, table.players.length)}
            aria-label={t.foldedAria(table.players.filter((p) => p.folded).length)}
          >
            <i
              style={{
                width: `${
                  table.players.length
                    ? Math.min(
                        100,
                        Math.round((table.players.filter((p) => p.folded).length / table.players.length) * 100),
                      )
                    : 0
                }%`,
              }}
            />
          </span>
          <span
            className="pk-allin-bar"
            data-any={table.players.some((p) => p.allIn && !p.out) || undefined}
            data-many={table.players.filter((p) => p.allIn && !p.out).length >= 2 || undefined}
            title={t.allinTitle(table.players.filter((p) => p.allIn && !p.out).length, table.players.length)}
            aria-label={t.allinAria(table.players.filter((p) => p.allIn && !p.out).length)}
          >
            <i
              style={{
                width: `${
                  table.players.length
                    ? Math.min(
                        100,
                        Math.round(
                          (table.players.filter((p) => p.allIn && !p.out).length / table.players.length) * 100,
                        ),
                      )
                    : 0
                }%`,
              }}
            />
          </span>
          <span
            className="pk-out-bar"
            data-any={table.players.some((p) => p.out) || undefined}
            data-many={table.players.filter((p) => p.out).length >= 2 || undefined}
            title={t.outTitle(table.players.filter((p) => p.out).length, table.players.length)}
            aria-label={t.outAria(table.players.filter((p) => p.out).length)}
          >
            <i
              style={{
                width: `${
                  table.players.length
                    ? Math.min(
                        100,
                        Math.round((table.players.filter((p) => p.out).length / table.players.length) * 100),
                      )
                    : 0
                }%`,
              }}
            />
          </span>
          <span
            className="pk-alive-bar"
            data-few={table.players.filter((p) => !p.out).length <= 2 || undefined}
            data-heads={table.players.filter((p) => !p.out).length === 2 || undefined}
            title={t.aliveTitle(table.players.filter((p) => !p.out).length, table.players.length)}
            aria-label={t.aliveAria(table.players.filter((p) => !p.out).length)}
          >
            <i
              style={{
                width: `${
                  table.players.length
                    ? Math.min(
                        100,
                        Math.round((table.players.filter((p) => !p.out).length / table.players.length) * 100),
                      )
                    : 0
                }%`,
              }}
            />
          </span>
          <span
            className="pk-board-fill-bar"
            data-turn={table.board.length === 4 || undefined}
            data-river={table.board.length >= 5 || undefined}
            title={t.boardTitle(table.board.length)}
            aria-label={t.boardFillAria(table.board.length)}
          >
            <i
              style={{
                width: `${Math.min(100, Math.round((table.board.length / 5) * 100))}%`,
              }}
            />
          </span>
          <span
            className="pk-invested-bar"
            data-hot={
              table.players.filter((p) => !p.out && p.bet > 0).length >=
                Math.max(2, Math.ceil(table.players.filter((p) => !p.out).length * 0.7)) || undefined
            }
            data-cold={
              (table.players.filter((p) => !p.out).length > 0 &&
                table.players.filter((p) => !p.out && p.bet > 0).length === 0) ||
              undefined
            }
            title={t.investedTitle(
              table.players.filter((p) => !p.out && p.bet > 0).length,
              table.players.filter((p) => !p.out).length || 0,
            )}
            aria-label={t.investedAria(table.players.filter((p) => !p.out && p.bet > 0).length)}
          >
            <i
              style={{
                width: `${
                  table.players.filter((p) => !p.out).length
                    ? Math.min(
                        100,
                        Math.round(
                          (table.players.filter((p) => !p.out && p.bet > 0).length /
                            table.players.filter((p) => !p.out).length) *
                            100,
                        ),
                      )
                    : 0
                }%`,
              }}
            />
          </span>
          <span
            className="pk-matched-bar"
            data-hot={
              (table.players.filter((p) => !p.out).length > 0 &&
                table.players.filter((p) => !p.out && p.bet >= table.currentBet).length >=
                  Math.max(2, Math.ceil(table.players.filter((p) => !p.out).length * 0.75))) ||
              undefined
            }
            data-cold={
              (table.players.filter((p) => !p.out).length > 0 &&
                table.currentBet > 0 &&
                table.players.filter((p) => !p.out && p.bet >= table.currentBet).length <= 1) ||
              undefined
            }
            title={t.matchedTitle(
              table.players.filter((p) => !p.out && p.bet >= table.currentBet).length,
              table.players.filter((p) => !p.out).length || 0,
              table.currentBet,
            )}
            aria-label={t.matchedAria(table.players.filter((p) => !p.out && p.bet >= table.currentBet).length)}
          >
            <i
              style={{
                width: `${
                  table.players.filter((p) => !p.out).length
                    ? Math.min(
                        100,
                        Math.round(
                          (table.players.filter((p) => !p.out && p.bet >= table.currentBet).length /
                            table.players.filter((p) => !p.out).length) *
                            100,
                        ),
                      )
                    : 0
                }%`,
              }}
            />
          </span>
          <span
            className="pk-folded-ratio-bar"
            data-hot={
              (table.players.length > 0 &&
                table.players.filter((p) => p.folded).length / table.players.length >= 0.6) ||
              undefined
            }
            data-cold={(table.players.length > 0 && table.players.filter((p) => p.folded).length === 0) || undefined}
            title={t.foldedTitle(table.players.filter((p) => p.folded).length, table.players.length || 0)}
            aria-label={t.foldedAria(table.players.filter((p) => p.folded).length)}
          >
            <i
              style={{
                width: `${
                  table.players.length
                    ? Math.min(
                        100,
                        Math.round((table.players.filter((p) => p.folded).length / table.players.length) * 100),
                      )
                    : 0
                }%`,
              }}
            />
          </span>
        </span>
        <span
          className={
            blindFlash
              ? "pk-blinds pk-blinds--flash pk-blinds-odds pk-blinds-stack pk-blind-progress-host"
              : "pk-blinds pk-blinds-odds pk-blinds-stack pk-blind-progress-host"
          }
          data-flash={blindFlash ? "" : undefined}
          data-odds={myTurn && rules && !rules.canCheck && rules.toCall > 0 && pot > 0 ? "" : undefined}
          data-short={started && me && !me.out && table.bb > 0 && me.chips / table.bb < 20 ? "" : undefined}
          title={
            myTurn && rules && !rules.canCheck && rules.toCall > 0 && pot > 0
              ? t.blindsOddsTitle(
                  table.sb,
                  table.bb,
                  !!blindFlash,
                  nextBlindHand,
                  Math.min(99, Math.round((rules.toCall / (pot + rules.toCall)) * 100)),
                )
              : blindFlashText
                ? blindFlashText
                : t.blindsEvery(BLIND_EVERY)
          }
        >
          {t.blinds}
          <b>
            {table.sb}/{table.bb}
          </b>
          {blindFlash ? (
            <small className="pk-blinds__next">{t.blindsFlashing}</small>
          ) : started && !gameOver && !victory ? (
            <small className="pk-blinds__next">{t.blindsNext(nextBlindHand)}</small>
          ) : null}
          {myTurn && rules && !rules.canCheck && rules.toCall > 0 && pot > 0 && (
            <>
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              <span
                className="pk-odds-hud"
                data-tier={
                  Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 25
                    ? "low"
                    : Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 40
                      ? "mid"
                      : "high"
                }
              >
                {t.needEquity}
                <b>{Math.min(99, Math.round((rules.toCall / (pot + rules.toCall)) * 100))}%</b>
                <small style={{ marginLeft: 4, opacity: 0.75 }}>{t.callShort(rules.toCall)}</small>
                <small className="pk-odds-hud__tier" style={{ marginLeft: 6 }}>
                  {Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 25
                    ? t.tier.low
                    : Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 40
                      ? t.tier.mid
                      : t.tier.high}
                </small>
                <span
                  className="pk-odds-bar"
                  data-tier={
                    Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 25
                      ? "low"
                      : Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 40
                        ? "mid"
                        : "high"
                  }
                  title={t.oddsBarTitle(Math.min(99, Math.round((rules.toCall / (pot + rules.toCall)) * 100)))}
                  aria-label={t.needEquityAria(Math.min(99, Math.round((rules.toCall / (pot + rules.toCall)) * 100)))}
                >
                  <i
                    style={{
                      width: `${Math.min(100, Math.round((rules.toCall / (pot + rules.toCall)) * 100))}%`,
                    }}
                  />
                </span>
              </span>
            </>
          )}
          {started && !gameOver && !victory && me && !me.out && table.bb > 0 && (
            <>
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              <span
                className="pk-stack-bb"
                data-short={me.chips / table.bb < 20 || undefined}
                data-critical={me.chips / table.bb < 10 || undefined}
                title={t.stackBbTitle(Math.max(0, Math.round((me.chips / table.bb) * 10) / 10))}
              >
                {t.stackBb}
                <b className={me.chips / table.bb < 10 ? "game-tip--alert" : undefined}>
                  {Math.max(0, Math.round((me.chips / table.bb) * 10) / 10)}
                </b>
                <span
                  className="pk-stack-bb-bar"
                  data-short={me.chips / table.bb < 20 || undefined}
                  data-critical={me.chips / table.bb < 10 || undefined}
                  title={t.stackBbBarTitle(Math.max(0, Math.round((me.chips / table.bb) * 10) / 10))}
                  aria-label={t.stackBbAria(Math.max(0, Math.round((me.chips / table.bb) * 10) / 10))}
                >
                  <i
                    style={{
                      width: `${Math.min(100, Math.round((me.chips / table.bb / 100) * 100))}%`,
                    }}
                  />
                </span>
              </span>
            </>
          )}
          {started && !gameOver && !victory && (
            <>
              <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
              <span
                className="pk-blind-progress pk-blind-eta"
                data-near={Math.max(0, nextBlindHand - table.hand) <= 2 || undefined}
                data-eta={Math.max(0, nextBlindHand - table.hand)}
                title={t.etaTitle(
                  Math.max(0, nextBlindHand - table.hand),
                  nextBlindHand,
                  BLIND_EVERY,
                  Math.min(100, Math.round(((((table.hand - 1) % BLIND_EVERY) + 1) / BLIND_EVERY) * 100)),
                )}
              >
                {t.eta}
                <b className={Math.max(0, nextBlindHand - table.hand) <= 2 ? "game-tip--alert" : undefined}>
                  {Math.max(0, nextBlindHand - table.hand)}
                </b>
                <small style={{ marginLeft: 2, opacity: 0.7 }}>{t.handsUnit}</small>
                <span
                  className="pk-blind-progress__bar"
                  aria-hidden="true"
                  style={
                    {
                      ["--pk-blind-pct" as string]: `${Math.min(100, Math.round(((((table.hand - 1) % BLIND_EVERY) + 1) / BLIND_EVERY) * 100))}%`,
                    } as { [key: string]: string }
                  }
                />
              </span>
            </>
          )}
        </span>
        {started && !gameOver && !victory && (
          <span
            className="pk-pot-hud pk-pot-bb-screen pk-pot-spr-host"
            title={
              result && result.pots.length > 1
                ? t.potSplitTitle(
                    result.pots[0]?.amount ?? 0,
                    result.pots.slice(1).reduce((s, x) => s + x.amount, 0),
                  )
                : table.players.some((pl) => pl.allIn && !pl.out)
                  ? t.potAllinTitle(pot)
                  : t.potTitle(pot)
            }
          >
            {t.pot}
            <b>{pot}</b>
            {me && table.bb > 0 ? (
              <small
                className="pk-pot-bb-together"
                title={t.potBbTitle(
                  Math.max(0, Math.round((pot / table.bb) * 10) / 10),
                  Math.max(0, Math.round((me.chips / table.bb) * 10) / 10),
                )}
              >
                {" "}
                · {Math.max(0, Math.round((pot / table.bb) * 10) / 10)}BB
                <span className="pk-pot-bb-together__you">
                  {t.youBb(Math.max(0, Math.round((me.chips / table.bb) * 10) / 10))}
                </span>
                <span
                  className="pk-pot-bb-bar"
                  data-big={pot / table.bb >= 20 || undefined}
                  title={t.potBbBarTitle(Math.max(0, Math.round((pot / table.bb) * 10) / 10))}
                  aria-label={t.potBbAria(Math.max(0, Math.round((pot / table.bb) * 10) / 10))}
                >
                  <i
                    style={{
                      width: `${Math.min(100, Math.round((pot / table.bb / 40) * 100))}%`,
                    }}
                  />
                </span>
              </small>
            ) : null}
            {me && pot > 0 ? (
              <small
                className="pk-pot-spr"
                data-low={me.chips / pot < 3 || undefined}
                data-commit={me.chips / pot < 1 || undefined}
                title={t.sprTitle(Math.max(0, Math.round((me.chips / pot) * 10) / 10))}
              >
                {" "}
                · SPR
                <b className={me.chips / pot < 1 ? "game-tip--alert" : undefined}>
                  {Math.max(0, Math.round((me.chips / pot) * 10) / 10)}
                </b>
                <span
                  className="pk-spr-bar"
                  data-commit={me.chips / pot < 1 || undefined}
                  data-low={(me.chips / pot < 3 && me.chips / pot >= 1) || undefined}
                  data-deep={me.chips / pot >= 3 || undefined}
                  title={t.sprBarTitle(Math.max(0, Math.round((me.chips / pot) * 10) / 10))}
                  aria-label={`SPR ${Math.max(0, Math.round((me.chips / pot) * 10) / 10)}`}
                >
                  <i
                    style={{
                      width: `${Math.min(100, Math.round((me.chips / pot / 10) * 100))}%`,
                    }}
                  />
                </span>
              </small>
            ) : null}
            {myTurn && rules && !rules.canCheck && rules.toCall > 0 && table.bb > 0 ? (
              <small
                className="pk-pot-tocall-bb"
                title={t.callBbTitle(rules.toCall, Math.max(0, Math.round((rules.toCall / table.bb) * 10) / 10))}
              >
                {" "}
                · {t.callBbShort(Math.max(0, Math.round((rules.toCall / table.bb) * 10) / 10))}
                <span
                  className="pk-call-bb-bar"
                  data-big={rules.toCall / table.bb >= 5 || undefined}
                  data-huge={rules.toCall / table.bb >= 10 || undefined}
                  title={t.callBbBarTitle(Math.max(0, Math.round((rules.toCall / table.bb) * 10) / 10))}
                  aria-label={t.callBbAria(Math.max(0, Math.round((rules.toCall / table.bb) * 10) / 10))}
                >
                  <i
                    style={{
                      width: `${Math.min(100, Math.round((rules.toCall / table.bb / 10) * 100))}%`,
                    }}
                  />
                </span>
              </small>
            ) : null}
            {myTurn && rules && !rules.canCheck && rules.toCall > 0 && pot > 0 ? (
              <span
                className="pk-pot-odds-bar"
                data-cheap={Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 25 || undefined}
                data-mid={
                  (Math.round((rules.toCall / (pot + rules.toCall)) * 100) > 25 &&
                    Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 40) ||
                  undefined
                }
                data-rich={Math.round((rules.toCall / (pot + rules.toCall)) * 100) > 40 || undefined}
                title={t.needEquityAria(Math.min(99, Math.round((rules.toCall / (pot + rules.toCall)) * 100)))}
                aria-label={t.needEquityAria(Math.min(99, Math.round((rules.toCall / (pot + rules.toCall)) * 100)))}
              >
                <i
                  style={{
                    width: `${Math.min(100, Math.round((rules.toCall / (pot + rules.toCall)) * 100))}%`,
                  }}
                />
              </span>
            ) : null}
            {result && result.pots.length > 1 ? (
              <>
                <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
                {t.sidePot}
                <b className="game-tip--alert">{result.pots.slice(1).reduce((s, x) => s + x.amount, 0)}</b>
                <small style={{ marginLeft: 4, opacity: 0.75 }}>×{result.pots.length - 1}</small>
              </>
            ) : table.players.some((pl) => pl.allIn && !pl.out) ? (
              <>
                <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
                {t.sidePot}
                <b className="game-tip--alert">{t.sidePotPending}</b>
              </>
            ) : null}
          </span>
        )}
        <span className="spacer" />
        <span>
          {t.best}
          <b>{best ?? STARTING_CHIPS}</b>
        </span>
      </div>

      {blindFlash && (
        <p
          className="game-tip game-tip--alert pk-blind-flash-tip"
          data-blind-flash=""
          aria-live="assertive"
          role="status"
        >
          {blindFlashText}
          {" · "}
          {t.flashTipTail(BLIND_EVERY)}
        </p>
      )}
      {started && !gameOver && !victory && !blindFlash && (
        <p className="game-tip pk-blind-tip" aria-live="polite">
          {t.blindTip(
            table.sb,
            table.bb,
            table.hand,
            Math.max(0, nextBlindHand - table.hand),
            nextBlindHand,
            BLIND_EVERY,
          )}
          {me && !me.out && table.bb > 0 ? t.blindTipYou(Math.max(0, Math.round((me.chips / table.bb) * 10) / 10)) : ""}
          {t.blindTipProgress(Math.min(100, Math.round(((((table.hand - 1) % BLIND_EVERY) + 1) / BLIND_EVERY) * 100)))}
          {table.players.some((pl) => pl.allIn && !pl.out) ? t.blindTipAllin : t.blindTipNormal}
        </p>
      )}
      <div className="pk-table">
        {table.players.map((p, i) => {
          const reveal = i === 0 || (result?.showdown && !p.folded);
          return (
            <div
              key={p.style}
              className="pk-seat"
              style={{ gridArea: SEAT_AREA[i] }}
              data-seat={SEAT_AREA[i]}
              data-turn={table.toAct === i || undefined}
              data-out={p.out || undefined}
              data-folded={p.folded || undefined}
              data-win={(done && winners.has(i)) || undefined}
            >
              <div className="pk-seat__head">
                <span className="pk-seat__name">
                  {t.names[p.style]}
                  {table.dealer === i && started && <i className="pk-dealer">D</i>}
                </span>
                <span className="pk-seat__chips">{p.out ? t.out : p.chips}</span>
              </div>
              <div className="pk-hand">
                {started && !p.out
                  ? p.hand.map((c, k) => (
                      <PlayingCard key={k} card={c} hidden={!reveal} glow={isGlow(c)} dim={p.folded} />
                    ))
                  : null}
              </div>
              <div className="pk-seat__status">
                {p.bet > 0 && !done && <span className="pk-bet">{p.bet}</span>}
                {p.last && (
                  <span className="pk-last">
                    {p.last.type === "raise" ? t.raiseTo(p.last.to) : t.last[p.last.type]}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <div className="pk-center" style={{ gridArea: "center" }}>
          <div className="pk-board">
            {Array.from({ length: 5 }, (_, i) => (
              <PlayingCard key={i} card={table.board[i]} glow={table.board[i] && isGlow(table.board[i])} />
            ))}
          </div>
          <p className="pk-pot">
            {t.potCenter(pot)}
            {result && result.pots.length > 1 ? (
              <small className="pk-pot-hint">
                {t.potHintSplit(
                  result.pots[0]?.amount ?? 0,
                  result.pots.slice(1).reduce((s, x) => s + x.amount, 0),
                  result.pots.length - 1,
                )}
              </small>
            ) : table.players.some((pl) => pl.allIn && !pl.out) ? (
              <small className="pk-pot-hint">{t.potHintAllin}</small>
            ) : started && !gameOver && !victory && me && !me.out && me.chips > 0 ? (
              <small className="pk-pot-hint">{t.potHintShare(Math.min(999, Math.round((pot / me.chips) * 100)))}</small>
            ) : null}
          </p>
          {myTurn && rules && !rules.canCheck && rules.toCall > 0 && pot > 0 && (
            <p className="game-tip game-tip--alert pk-odds" aria-live="polite">
              {t.oddsTipBefore(rules.toCall, pot)}
              <b>{Math.min(99, Math.round((rules.toCall / (pot + rules.toCall)) * 100))}%</b>
              {t.oddsTipAfter}
              {Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 25
                ? t.oddsTier.low
                : Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 40
                  ? t.oddsTier.mid
                  : t.oddsTier.high}
              {t.oddsTipBlinds(table.sb, table.bb)}
              {table.players.some((pl) => pl.allIn && !pl.out) ? t.oddsTipAllin : ""}
            </p>
          )}
          {started &&
            !gameOver &&
            !victory &&
            !result &&
            table.players.some((pl) => pl.allIn && !pl.out) &&
            !(myTurn && rules && !rules.canCheck && rules.toCall > 0 && pot > 0) && (
              <p className="game-tip pk-sidepot game-tip--alert" aria-live="polite">
                {t.sideTipA}
                <strong>{t.sideTipMain}</strong>
                {t.sideTipB}
                <strong>{t.sideTipSide}</strong>
                {t.sideTipC}
              </p>
            )}
          {started &&
            !gameOver &&
            !victory &&
            !result &&
            table.players.some((pl) => pl.allIn && !pl.out) &&
            myTurn &&
            rules &&
            !rules.canCheck &&
            rules.toCall > 0 &&
            pot > 0 && (
              <p className="game-tip pk-sidepot" aria-live="polite">
                {t.sideTipOdds}
              </p>
            )}
          <p className="pk-msg" aria-live="polite">
            {message}
          </p>
        </div>
      </div>

      {myTurn && rules ? (
        <div className="pk-actions">
          <div className="pk-actions__row">
            <button type="button" className="game-btn" onClick={() => play({ type: "fold" })}>
              {t.fold}
            </button>
            <button
              type="button"
              className="game-btn game-btn--primary"
              onClick={() => play(rules.canCheck ? { type: "check" } : { type: "call" })}
            >
              {rules.canCheck ? t.check : t.callN(rules.toCall)}
            </button>
            <button type="button" className="game-btn" onClick={() => play({ type: "allin" })}>
              {t.allinN(me.chips)}
            </button>
          </div>
          {rules.canRaise && rules.minTo < rules.maxTo && (
            <div className="pk-actions__row">
              <input
                type="range"
                min={minTo}
                max={maxTo}
                step={table.bb}
                value={raiseValue}
                onChange={(e) => setRaiseTo(Number(e.target.value))}
                aria-label={t.raiseToAria}
              />
              {presets.map((p) => (
                <button key={p.label} type="button" className="game-btn" onClick={() => setRaiseTo(p.to)}>
                  {p.label}
                </button>
              ))}
              <button type="button" className="game-btn" onClick={() => play({ type: "raise", to: raiseValue })}>
                {t.raiseTo(raiseValue)}
              </button>
            </div>
          )}
          {myHand && <p className="game-hint">{t.myHand(myHand)}</p>}
        </div>
      ) : (
        <div className="pk-actions">
          {(done || !started) && (
            <button type="button" className="game-btn game-btn--primary" onClick={deal}>
              {!started ? t.deal : gameOver || victory ? t.restart : t.nextHand}
            </button>
          )}
          {!done && myHand && <p className="game-hint">{t.myHand(myHand)}</p>}
          {!done && !myHand && myTurn && <p className="game-hint">{t.keysHint}</p>}
        </div>
      )}
    </div>
  );
}
