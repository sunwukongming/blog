"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { mascotSay, pick, POKER_ALLIN, POKER_BIG_WIN, POKER_BUST } from "@/lib/mascot";
import { buzz, higher, useKeys, useRecord } from "./input";
import {
  act,
  botAction,
  BLIND_EVERY,
  handName,
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
const SUIT_NAME = ["黑桃", "红心", "方块", "梅花"];

// 花色用 SVG 画，♠♥♦♣ 在一些字体里会显示成方框
function Suit({ s }: { s: number }) {
  const fill = s === 1 || s === 2 ? "#ff4d6d" : "#1b1530";
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
      {s === 0 && <path fill={fill} d="M8 1C6.5 4 2 6 2 9.4a3 3 0 0 0 5.2 2L6.3 15h3.4l-.9-3.6a3 3 0 0 0 5.2-2C14 6 9.5 4 8 1z" />}
      {s === 1 && <path fill={fill} d="M8 14.5S1.5 10 1.5 5.6A3.4 3.4 0 0 1 8 4a3.4 3.4 0 0 1 6.5 1.6C14.5 10 8 14.5 8 14.5z" />}
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
  if (!card) return <span className="pk-card pk-card--empty" />;
  if (hidden) return <span className="pk-card pk-card--back" aria-label="背面朝上的牌" />;
  return (
    <span
      className="pk-card"
      data-red={card.s === 1 || card.s === 2 || undefined}
      data-glow={glow || undefined}
      data-dim={dim || undefined}
      aria-label={`${SUIT_NAME[card.s]} ${RANK_TEXT[card.r] ?? card.r}`}
    >
      <b>{RANK_TEXT[card.r] ?? card.r}</b>
      <Suit s={card.s} />
    </span>
  );
}

const same = (a: Card, b: Card) => a.r === b.r && a.s === b.s;
const SEAT_AREA = ["me", "left", "top", "right"];

export default function Poker() {
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
  const [blindFlash, setBlindFlash] = useState<string | null>(null);
  const prevSb = useRef(table.sb);
  // next hand number where blinds double (hands 11, 21, 31…)
  const nextBlindHand =
    table.hand <= 0 ? BLIND_EVERY + 1 : Math.floor((table.hand - 1) / BLIND_EVERY) * BLIND_EVERY + BLIND_EVERY + 1;

  useEffect(() => {
    if (table.hand > 0 && table.sb > prevSb.current) {
      const from = prevSb.current;
      const msg = `⚡ 盲注闪涨 ${from} → ${table.sb}/${table.bb} · 下涨第${nextBlindHand}手`;
      setBlindFlash(msg);
      buzz([30, 40, 30, 40, 50]);
      prevSb.current = table.sb;
      const id = window.setTimeout(() => setBlindFlash(null), 6500);
      return () => clearTimeout(id);
    }
    prevSb.current = table.sb;
  }, [table.hand, table.sb, table.bb, nextBlindHand]);

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
    if (humanOut(table)) mascotSay(pick(POKER_BUST));
    else if (won >= table.bb * 15) mascotSay(pick(POKER_BIG_WIN));
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
    if (a.type === "allin") mascotSay(pick(POKER_ALLIN));
    update((t) => act(t, a));
  };

  const minTo = rules?.minTo ?? 0;
  const maxTo = rules?.maxTo ?? 0;
  // clamp raise display when last hand amount is out of this street range
  const raiseValue = rules
    ? raiseTo >= minTo && raiseTo <= maxTo
      ? raiseTo
      : minTo
    : 0;
  const presets = rules
    ? [
        { label: "½ 池", to: table.currentBet + Math.round(pot / 2) },
        { label: "1 池", to: table.currentBet + pot },
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
  const myHand = !me.folded && table.board.length >= 3 ? handName(bestHand([...me.hand, ...table.board]).score) : "";
  const result = table.result;
  const winBest = result?.showdown ? result.best : {};
  const winners = new Set(result?.pots.flatMap((p) => p.winners));
  const glowCards = result?.showdown ? [...winners].flatMap((w) => winBest[w] ?? []) : [];
  const isGlow = (c: Card) => glowCards.some((g) => same(g, c));

  const message = (() => {
    if (!started) return "点「发牌」开始。你和三个电脑对局，每人 1000 筹码；盲注每 10 手翻倍。";
    if (gameOver) return "筹码输光了。";
    if (victory) return "三个电脑都出局了，你赢下了整张桌子！";
    if (result) {
      const multi = result.pots.length > 1;
      return (
        (multi ? `本手拆 ${result.pots.length} 个池（主池+边池）：` : "") +
        result.pots
          .map((p, i) => {
            const names = p.winners.map((w) => table.players[w].name).join("、");
            const label = multi ? (i === 0 ? "主池" : `边池 ${i}`) : "底池";
            return `${names}${p.handName ? `以${p.handName}` : ""}赢得${label} ${p.amount}`;
          })
          .join("；")
      );
    }
    if (table.runout) return "全下了，发完剩下的公共牌……";
    if (myTurn) return rules!.canCheck ? "轮到你了" : `轮到你了，跟注需要 ${rules!.toCall}`;
    return `${table.players[table.toAct]?.name ?? ""}思考中……`;
  })();

  return (
    <div className="game poker">
      <div className="game-bar">
        <span>
          第<b>{table.hand}</b>手
          <span
            className="pk-hand-bar"
            data-near={started && !gameOver && !victory && Math.max(0, nextBlindHand - table.hand) <= 2 || undefined}
            title={
              started && !gameOver && !victory
                ? `手牌序号 ${table.hand} · 本段涨盲进度 ${Math.min(100, Math.round((((table.hand - 1) % BLIND_EVERY) + 1) / BLIND_EVERY * 100))}%（每 ${BLIND_EVERY} 手）`
                : `手牌序号 ${table.hand}`
            }
            aria-label={`第 ${table.hand} 手`}
          >
            <i
              style={{
                width: `${
                  started && !gameOver && !victory
                    ? Math.min(100, Math.round((((table.hand - 1) % BLIND_EVERY) + 1) / BLIND_EVERY * 100))
                    : Math.min(100, Math.round((table.hand / 40) * 100))
                }%`,
              }}
            />
          </span>
          <span
            className="pk-street-bar"
            data-river={table.street === "river" || undefined}
            data-done={table.street === "done" || undefined}
            title={`街道 ${table.street}`}
            aria-label={`街道 ${table.street}`}
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
            title={`公共牌 ${table.board.length}/5`}
            aria-label={`公共牌 ${table.board.length} 张`}
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
            title={`未弃牌 ${table.players.filter((p) => !p.folded).length}/${table.players.length}`}
            aria-label={`未弃牌 ${table.players.filter((p) => !p.folded).length} 人`}
          >
            <i
              style={{
                width: `${
                  table.players.length
                    ? Math.min(
                        100,
                        Math.round(
                          (table.players.filter((p) => !p.folded).length / table.players.length) * 100,
                        ),
                      )
                    : 0
                }%`,
              }}
            />
          </span>
          <span
            className="pk-fold-bar"
            data-heavy={table.players.filter((p) => p.folded).length >= Math.ceil(table.players.length * 0.6) || undefined}
            data-none={table.players.filter((p) => p.folded).length === 0 || undefined}
            title={`已弃牌 ${table.players.filter((p) => p.folded).length}/${table.players.length}`}
            aria-label={`已弃牌 ${table.players.filter((p) => p.folded).length} 人`}
          >
            <i
              style={{
                width: `${
                  table.players.length
                    ? Math.min(
                        100,
                        Math.round(
                          (table.players.filter((p) => p.folded).length / table.players.length) * 100,
                        ),
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
            title={`全下 ${table.players.filter((p) => p.allIn && !p.out).length}/${table.players.length}`}
            aria-label={`全下 ${table.players.filter((p) => p.allIn && !p.out).length} 人`}
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
              ? `盲注 ${table.sb}/${table.bb}${blindFlash ? " · 闪涨" : ` · 下涨第${nextBlindHand}手`} · 需胜率 ${Math.min(99, Math.round((rules.toCall / (pot + rules.toCall)) * 100))}%（跟注/(底池+跟注)）`
              : blindFlash
                ? blindFlash
                : `每 ${BLIND_EVERY} 手翻倍`
          }
        >
          盲注<b>
            {table.sb}/{table.bb}
          </b>
          {blindFlash ? (
            <small className="pk-blinds__next"> · 闪涨中</small>
          ) : started && !gameOver && !victory ? (
            <small className="pk-blinds__next"> · 下涨第{nextBlindHand}手</small>
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
                需胜率
                <b>
                  {Math.min(99, Math.round((rules.toCall / (pot + rules.toCall)) * 100))}%
                </b>
                <small style={{ marginLeft: 4, opacity: 0.75 }}>
                  跟{rules.toCall}
                </small>
                <small className="pk-odds-hud__tier" style={{ marginLeft: 6 }}>
                  {Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 25
                    ? "偏便宜"
                    : Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 40
                      ? "中性"
                      : "偏贵"}
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
                  title={`需胜率条 ${Math.min(99, Math.round((rules.toCall / (pot + rules.toCall)) * 100))}%`}
                  aria-label={`需胜率 ${Math.min(99, Math.round((rules.toCall / (pot + rules.toCall)) * 100))} 百分之`}
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
                title={`你的筹码约 ${Math.max(0, Math.round((me.chips / table.bb) * 10) / 10)} BB（筹码/大盲）`}
              >
                筹码/BB
                <b className={me.chips / table.bb < 10 ? "game-tip--alert" : undefined}>
                  {Math.max(0, Math.round((me.chips / table.bb) * 10) / 10)}
                </b>
                <span
                  className="pk-stack-bb-bar"
                  data-short={me.chips / table.bb < 20 || undefined}
                  data-critical={me.chips / table.bb < 10 || undefined}
                  title={`筹码/BB 条：${Math.max(0, Math.round((me.chips / table.bb) * 10) / 10)}（满刻度按 100BB）`}
                  aria-label={`筹码约 ${Math.max(0, Math.round((me.chips / table.bb) * 10) / 10)} 个大盲`}
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
                title={`涨盲 ETA：距翻倍 ${Math.max(0, nextBlindHand - table.hand)} 手（目标第 ${nextBlindHand} 手）· 每 ${BLIND_EVERY} 手 · 本段 ${Math.min(100, Math.round((((table.hand - 1) % BLIND_EVERY) + 1) / BLIND_EVERY * 100))}%`}
              >
                涨盲 ETA
                <b className={Math.max(0, nextBlindHand - table.hand) <= 2 ? "game-tip--alert" : undefined}>
                  {Math.max(0, nextBlindHand - table.hand)}
                </b>
                <small style={{ marginLeft: 2, opacity: 0.7 }}>手</small>
                <span
                  className="pk-blind-progress__bar"
                  aria-hidden="true"
                  style={
                    {
                      ["--pk-blind-pct" as string]: `${Math.min(100, Math.round((((table.hand - 1) % BLIND_EVERY) + 1) / BLIND_EVERY * 100))}%`,
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
                ? `主池 ${result.pots[0]?.amount ?? 0} · 边池合计 ${result.pots.slice(1).reduce((s, x) => s + x.amount, 0)}`
                : table.players.some((pl) => pl.allIn && !pl.out)
                  ? `底池 ${pot} · 有人全下，结算将拆主池/边池`
                  : `当前底池 ${pot}`
            }
          >
            底池<b>{pot}</b>
            {me && table.bb > 0 ? (
              <small className="pk-pot-bb-together" title={`底池约 ${Math.max(0, Math.round((pot / table.bb) * 10) / 10)} BB · 你约 ${Math.max(0, Math.round((me.chips / table.bb) * 10) / 10)} BB`}>
                {" "}· {Math.max(0, Math.round((pot / table.bb) * 10) / 10)}BB
                <span className="pk-pot-bb-together__you"> / 你{Math.max(0, Math.round((me.chips / table.bb) * 10) / 10)}BB</span>
                <span
                  className="pk-pot-bb-bar"
                  data-big={pot / table.bb >= 20 || undefined}
                  title={`底池 ${Math.max(0, Math.round((pot / table.bb) * 10) / 10)} BB（满刻度按 40BB）`}
                  aria-label={`底池约 ${Math.max(0, Math.round((pot / table.bb) * 10) / 10)} 个大盲`}
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
                title={`SPR 筹码/底池 ≈ ${Math.max(0, Math.round((me.chips / pot) * 10) / 10)}（低于3偏深码压力，低于1近似投入）`}
              >
                {" "}· SPR
                <b className={me.chips / pot < 1 ? "game-tip--alert" : undefined}>
                  {Math.max(0, Math.round((me.chips / pot) * 10) / 10)}
                </b>
                <span
                  className="pk-spr-bar"
                  data-commit={me.chips / pot < 1 || undefined}
                  data-low={me.chips / pot < 3 && me.chips / pot >= 1 || undefined}
                  data-deep={me.chips / pot >= 3 || undefined}
                  title={`SPR 条：${Math.max(0, Math.round((me.chips / pot) * 10) / 10)}（满刻度按 10）`}
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
                title={`跟注 ${rules.toCall} ≈ ${Math.max(0, Math.round((rules.toCall / table.bb) * 10) / 10)} BB`}
              >
                {" "}· 跟{Math.max(0, Math.round((rules.toCall / table.bb) * 10) / 10)}BB
                <span
                  className="pk-call-bb-bar"
                  data-big={rules.toCall / table.bb >= 5 || undefined}
                  data-huge={rules.toCall / table.bb >= 10 || undefined}
                  title={`跟注 ${Math.max(0, Math.round((rules.toCall / table.bb) * 10) / 10)} BB（满刻度按 10BB）`}
                  aria-label={`跟注约 ${Math.max(0, Math.round((rules.toCall / table.bb) * 10) / 10)} 个大盲`}
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
                  Math.round((rules.toCall / (pot + rules.toCall)) * 100) > 25 &&
                  Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 40 || undefined
                }
                data-rich={Math.round((rules.toCall / (pot + rules.toCall)) * 100) > 40 || undefined}
                title={`需胜率 ${Math.min(99, Math.round((rules.toCall / (pot + rules.toCall)) * 100))}%`}
                aria-label={`需胜率 ${Math.min(99, Math.round((rules.toCall / (pot + rules.toCall)) * 100))} percent`}
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
                边池
                <b className="game-tip--alert">
                  {result.pots.slice(1).reduce((s, x) => s + x.amount, 0)}
                </b>
                <small style={{ marginLeft: 4, opacity: 0.75 }}>×{result.pots.length - 1}</small>
              </>
            ) : table.players.some((pl) => pl.allIn && !pl.out) ? (
              <>
                <small style={{ margin: "0 6px", opacity: 0.45 }}>|</small>
                边池<b className="game-tip--alert">待拆</b>
              </>
            ) : null}
          </span>
        )}
        <span className="spacer" />
        <span>
          本机最多<b>{best ?? STARTING_CHIPS}</b>
        </span>
      </div>

      {blindFlash && (
        <p className="game-tip game-tip--alert pk-blind-flash-tip" data-blind-flash="" aria-live="assertive" role="status">
          {blindFlash}
          {" · "}
          每 {BLIND_EVERY} 手翻倍 · 顶栏盲注同步闪烁
        </p>
      )}
      {started && !gameOver && !victory && !blindFlash && (
        <p className="game-tip pk-blind-tip" aria-live="polite">
          盲注 {table.sb}/{table.bb}
          {" · "}
          第 {table.hand} 手
          {" · "}
          涨盲 ETA {Math.max(0, nextBlindHand - table.hand)} 手
          （目标第 {nextBlindHand} 手 · 每 {BLIND_EVERY} 手）
          {me && !me.out && table.bb > 0
            ? ` · 你约 ${Math.max(0, Math.round((me.chips / table.bb) * 10) / 10)} BB`
            : ""}
          {` · 涨盲进度 ${Math.min(100, Math.round((((table.hand - 1) % BLIND_EVERY) + 1) / BLIND_EVERY * 100))}%`}
          {table.players.some((pl) => pl.allIn && !pl.out)
            ? " · 有人全下：主池/边池分拆，摊牌按资格分结"
            : " · 全下后主池+边池分结"}
        </p>
      )}
      <div className="pk-table">
        {table.players.map((p, i) => {
          const reveal = i === 0 || (result?.showdown && !p.folded);
          return (
            <div
              key={p.name}
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
                  {p.name}
                  {table.dealer === i && started && <i className="pk-dealer">D</i>}
                </span>
                <span className="pk-seat__chips">{p.out ? "出局" : p.chips}</span>
              </div>
              <div className="pk-hand">
                {started && !p.out
                  ? p.hand.map((c, k) => <PlayingCard key={k} card={c} hidden={!reveal} glow={isGlow(c)} dim={p.folded} />)
                  : null}
              </div>
              <div className="pk-seat__status">
                {p.bet > 0 && !done && <span className="pk-bet">{p.bet}</span>}
                {p.last && <span className="pk-last">{p.last}</span>}
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
            底池 {pot}
            {result && result.pots.length > 1 ? (
              <small className="pk-pot-hint">
                {" "}
                · 主池 {result.pots[0]?.amount ?? 0}
                {" | "}
                边池 {result.pots.slice(1).reduce((s, x) => s + x.amount, 0)}（{result.pots.length - 1}）
              </small>
            ) : table.players.some((pl) => pl.allIn && !pl.out) ? (
              <small className="pk-pot-hint"> · 底池|边池：全下中，结算按资格拆池</small>
            ) : started && !gameOver && !victory && me && !me.out && me.chips > 0 ? (
              <small className="pk-pot-hint"> · 约占你筹码 {Math.min(999, Math.round((pot / me.chips) * 100))}%</small>
            ) : null}
          </p>
          {myTurn && rules && !rules.canCheck && rules.toCall > 0 && pot > 0 && (
            <p className="game-tip game-tip--alert pk-odds" aria-live="polite">
              胜率 HUD：跟 {rules.toCall} / 池 {pot}
              {" · "}
              打平需{" "}
              <b>{Math.min(99, Math.round((rules.toCall / (pot + rules.toCall)) * 100))}%</b>
              {" 胜率"}
              {Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 25
                ? " · 色阶偏低（偏便宜）"
                : Math.round((rules.toCall / (pot + rules.toCall)) * 100) <= 40
                  ? " · 色阶中性"
                  : " · 色阶偏高（偏贵）"}
              {` · 盲注|需胜率同条 ${table.sb}/${table.bb}`}
              {table.players.some((pl) => pl.allIn && !pl.out)
                ? " · 全下中：只进你可参与的主池/边池"
                : ""}
            </p>
          )}
          {started && !gameOver && !victory && !result && table.players.some((pl) => pl.allIn && !pl.out) && !(myTurn && rules && !rules.canCheck && rules.toCall > 0 && pot > 0) && (
            <p className="game-tip pk-sidepot game-tip--alert" aria-live="polite">
              边池触发：未跟满→<strong>主池</strong>，超额→<strong>边池</strong>；与盲注 tip 同屏
            </p>
          )}
          {started && !gameOver && !victory && !result && table.players.some((pl) => pl.allIn && !pl.out) && myTurn && rules && !rules.canCheck && rules.toCall > 0 && pot > 0 && (
            <p className="game-tip pk-sidepot" aria-live="polite">
              跟注胜率（上）+边池规则同屏：只能赢你有资格的那些池
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
              弃牌
            </button>
            <button
              type="button"
              className="game-btn game-btn--primary"
              onClick={() => play(rules.canCheck ? { type: "check" } : { type: "call" })}
            >
              {rules.canCheck ? "过牌" : `跟注 ${rules.toCall}`}
            </button>
            <button type="button" className="game-btn" onClick={() => play({ type: "allin" })}>
              全下 {me.chips}
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
                aria-label="加注到"
              />
              {presets.map((p) => (
                <button key={p.label} type="button" className="game-btn" onClick={() => setRaiseTo(p.to)}>
                  {p.label}
                </button>
              ))}
              <button type="button" className="game-btn" onClick={() => play({ type: "raise", to: raiseValue })}>
                加注到 {raiseValue}
              </button>
            </div>
          )}
          {myHand && <p className="game-hint">你现在是：{myHand}</p>}
        </div>
      ) : (
        <div className="pk-actions">
          {(done || !started) && (
            <button type="button" className="game-btn game-btn--primary" onClick={deal}>
              {!started ? "发牌" : gameOver || victory ? "重新开始" : "下一手"}
            </button>
          )}
          {!done && myHand && <p className="game-hint">你现在是：{myHand}</p>}
          {!done && !myHand && myTurn && (
            <p className="game-hint">F 弃牌，C / 空格过牌或跟注，R 加注，A 全下</p>
          )}
        </div>
      )}
    </div>
  );
}
