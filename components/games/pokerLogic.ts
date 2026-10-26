// 德州扑克的纯逻辑：牌型判断、下注流程、边池结算、电脑玩家决策。不依赖 React，方便单独测试。

export type Card = { r: number; s: number }; // r: 2~14（14 是 A），s: 0♠ 1♥ 2♦ 3♣
export type Style = "human" | "tight" | "loose" | "aggro";
/** 座位上显示的最近动作；只存类型，文字由组件按当前语言翻译 */
export type LastAction = { type: "sb" | "bb" | "fold" | "check" | "call" | "allin" } | { type: "raise"; to: number };
/** 牌型等级：0 高牌 … 8 同花顺，9 皇家同花顺；名字由组件按当前语言翻译 */
export type HandRank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Player = {
  /** 性格同时作为座位的身份（每种性格一人），名字由组件按语言显示 */
  style: Style;
  chips: number;
  hand: Card[];
  /** 这一轮下注圈里已经下的 */
  bet: number;
  /** 这一手牌总共投进底池的 */
  total: number;
  folded: boolean;
  allIn: boolean;
  /** 这一圈是否已经表过态（有人加注后其他人要重新表态） */
  acted: boolean;
  /** 这一圈加注过几次，电脑最多加两次，避免互相无限加注 */
  raises: number;
  /** 筹码输光，出局 */
  out: boolean;
  /** 最近一次动作，显示在座位上 */
  last: LastAction | null;
};
export type Street = "preflop" | "flop" | "turn" | "river" | "done";
export type Pot = { amount: number; winners: number[]; rank: HandRank | null };
export type Result = { pots: Pot[]; showdown: boolean; best: Record<number, Card[]> };
export type Table = {
  players: Player[];
  deck: Card[];
  board: Card[];
  dealer: number;
  street: Street;
  /** 轮到谁；-1 表示没人需要表态（发牌中或这一手结束） */
  toAct: number;
  currentBet: number;
  minRaise: number;
  sb: number;
  bb: number;
  hand: number;
  /** 只剩不到两个人能下注时，剩下的公共牌一张张自动发完 */
  runout: boolean;
  result: Result | null;
};
export type Action = { type: "fold" | "check" | "call" | "raise" | "allin"; to?: number };

export const STARTING_CHIPS = 1000;
const BASE_SB = 10;
export const BLIND_EVERY = 10;

// ---------- 牌和牌型 ----------

const BASE = 15;
const CAT = BASE ** 5;

export function shuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** 5 张牌的分数：牌型 × 15^5 + 依次比较的点数，分数大的牌大 */
export function score5(cs: Card[]): number {
  const rs = cs.map((c) => c.r).sort((a, b) => b - a);
  const flush = cs.every((c) => c.s === cs[0].s);
  let straight = 0;
  if (new Set(rs).size === 5) {
    if (rs[0] - rs[4] === 4) straight = rs[0];
    else if (rs[0] === 14 && rs[1] === 5) straight = 5; // A2345
  }
  const counts = new Map<number, number>();
  for (const r of rs) counts.set(r, (counts.get(r) ?? 0) + 1);
  // 先按张数、再按点数排：葫芦里三条在前，两对里大对在前
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const byGroup = groups.map((g) => g[0]);
  let cat: number;
  let kick: number[];
  if (straight && flush) [cat, kick] = [8, [straight]];
  else if (groups[0][1] === 4) [cat, kick] = [7, byGroup];
  else if (groups[0][1] === 3 && groups[1][1] === 2) [cat, kick] = [6, byGroup];
  else if (flush) [cat, kick] = [5, rs];
  else if (straight) [cat, kick] = [4, [straight]];
  else if (groups[0][1] === 3) [cat, kick] = [3, byGroup];
  else if (groups[0][1] === 2 && groups[1][1] === 2) [cat, kick] = [2, byGroup];
  else if (groups[0][1] === 2) [cat, kick] = [1, byGroup];
  else [cat, kick] = [0, rs];
  let v = cat;
  for (let i = 0; i < 5; i++) v = v * BASE + (kick[i] ?? 0);
  return v;
}

const COMBOS = new Map<number, number[][]>();
function combos(n: number): number[][] {
  let out = COMBOS.get(n);
  if (out) return out;
  out = [];
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) out.push([a, b, c, d, e]);
  COMBOS.set(n, out);
  return out;
}

/** 5~7 张牌里挑出最大的 5 张 */
export function bestHand(cards: Card[]): { score: number; cards: Card[] } {
  let best = { score: -1, cards: [] as Card[] };
  for (const idx of combos(cards.length)) {
    const five = idx.map((i) => cards[i]);
    const score = score5(five);
    if (score > best.score) best = { score, cards: five };
  }
  return best;
}

export function handRank(score: number): HandRank {
  const cat = Math.floor(score / CAT) as HandRank;
  // 同花顺里最大的是 A 开头：皇家同花顺
  if (cat === 8 && Math.floor(score / BASE ** 4) % BASE === 14) return 9;
  return cat;
}

/** 蒙特卡洛估算胜率：随机补齐对手手牌和公共牌，数自己赢了多少次（平分按比例算） */
export function equity(hole: Card[], board: Card[], opponents: number, sims = 160): number {
  const known = new Set([...hole, ...board].map((c) => c.r * 4 + c.s));
  const rest: Card[] = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) if (!known.has(r * 4 + s)) rest.push({ r, s });
  const need = 5 - board.length + opponents * 2;
  let won = 0;
  for (let k = 0; k < sims; k++) {
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(Math.random() * (rest.length - i));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const full = [...board, ...rest.slice(0, 5 - board.length)];
    const mine = bestHand([...hole, ...full]).score;
    let better = false;
    let ties = 0;
    for (let o = 0; o < opponents; o++) {
      const theirs = bestHand([rest[5 - board.length + o * 2], rest[6 - board.length + o * 2], ...full]).score;
      if (theirs > mine) {
        better = true;
        break;
      }
      if (theirs === mine) ties++;
    }
    if (!better) won += 1 / (ties + 1);
  }
  return won / sims;
}

// ---------- 牌桌流程 ----------

const live = (p: Player) => !p.out && !p.folded;
const canBet = (p: Player) => live(p) && !p.allIn;
export const potSize = (t: Table) => t.players.reduce((sum, p) => sum + p.total, 0);

function nextIndex(t: Table, from: number, ok: (p: Player) => boolean) {
  const n = t.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (ok(t.players[i])) return i;
  }
  return -1;
}

export function newTable(): Table {
  const mk = (style: Style): Player => ({
    style,
    chips: STARTING_CHIPS,
    hand: [],
    bet: 0,
    total: 0,
    folded: false,
    allIn: false,
    acted: false,
    raises: 0,
    out: false,
    last: null,
  });
  return {
    players: [mk("human"), mk("tight"), mk("loose"), mk("aggro")],
    deck: [],
    board: [],
    dealer: Math.floor(Math.random() * 4),
    street: "done",
    toAct: -1,
    currentBet: 0,
    minRaise: 0,
    sb: BASE_SB,
    bb: BASE_SB * 2,
    hand: 0,
    runout: false,
    result: null,
  };
}

function pay(p: Player, amount: number) {
  const x = Math.min(amount, p.chips);
  p.chips -= x;
  p.bet += x;
  p.total += x;
  if (p.chips === 0) p.allIn = true;
  return x;
}

/** 开始新的一手：移庄、下盲注、发手牌 */
export function startHand(t: Table) {
  t.hand++;
  const level = Math.floor((t.hand - 1) / BLIND_EVERY);
  t.sb = BASE_SB * 2 ** level;
  t.bb = t.sb * 2;
  for (const p of t.players) {
    if (p.chips <= 0) p.out = true;
    Object.assign(p, { hand: [], bet: 0, total: 0, folded: p.out, allIn: false, acted: false, raises: 0, last: null });
  }
  t.dealer = nextIndex(t, t.dealer, (p) => !p.out);
  t.deck = shuffledDeck();
  t.board = [];
  t.result = null;
  t.runout = false;
  t.street = "preflop";
  const alive = t.players.filter((p) => !p.out).length;
  // 只剩两个人时庄家下小盲
  const sbi = alive === 2 ? t.dealer : nextIndex(t, t.dealer, (p) => !p.out);
  const bbi = nextIndex(t, sbi, (p) => !p.out);
  pay(t.players[sbi], t.sb);
  t.players[sbi].last = { type: "sb" };
  pay(t.players[bbi], t.bb);
  t.players[bbi].last = { type: "bb" };
  for (let round = 0; round < 2; round++)
    for (let k = 1; k <= t.players.length; k++) {
      const p = t.players[(t.dealer + k) % t.players.length];
      if (!p.out) p.hand.push(t.deck.pop()!);
    }
  t.currentBet = t.bb;
  t.minRaise = t.bb;
  t.toAct = bbi;
  settle(t, bbi);
}

/** 当前玩家能做什么 */
export function legal(t: Table) {
  const p = t.players[t.toAct];
  const toCall = Math.min(t.currentBet - p.bet, p.chips);
  const maxTo = p.bet + p.chips;
  return {
    toCall,
    canCheck: t.currentBet === p.bet,
    // 筹码不够最小加注时只能全下
    canRaise: maxTo > t.currentBet,
    minTo: Math.min(t.currentBet + t.minRaise, maxTo),
    maxTo,
  };
}

export function act(t: Table, a: Action) {
  const i = t.toAct;
  const p = t.players[i];
  if (i < 0 || !canBet(p)) return;
  const toCall = t.currentBet - p.bet;
  if (a.type === "fold") {
    p.folded = true;
    p.last = { type: "fold" };
  } else if (a.type === "check" && toCall === 0) {
    p.last = { type: "check" };
  } else if (a.type === "call" || (a.type === "check" && toCall > 0)) {
    pay(p, toCall);
    p.last = { type: p.allIn ? "allin" : "call" };
  } else {
    const maxTo = p.bet + p.chips;
    const to = a.type === "allin" ? maxTo : Math.min(Math.max(a.to ?? 0, t.currentBet + t.minRaise), maxTo);
    if (to <= t.currentBet) {
      // 全下的钱还不够跟注，等同于跟注全部
      pay(p, to - p.bet);
      p.last = { type: p.allIn ? "allin" : "call" };
    } else {
      const size = to - t.currentBet;
      if (size >= t.minRaise) t.minRaise = size;
      t.currentBet = to;
      pay(p, to - p.bet);
      p.raises++;
      p.last = p.allIn ? { type: "allin" } : { type: "raise", to };
      // 有人加注，其他人要重新表态
      for (const q of t.players) if (q !== p) q.acted = false;
    }
  }
  p.acted = true;
  settle(t, i);
}

/** 每次动作之后：判断这一圈是否结束、要不要发下一条街、是否摊牌 */
function settle(t: Table, from: number) {
  const players = t.players.filter(live);
  if (players.length === 1) return awardFold(t);
  const pending = (p: Player) => canBet(p) && (!p.acted || p.bet < t.currentBet);
  const nextUp = nextIndex(t, from, pending);
  if (nextUp >= 0) {
    // 只剩一个人能下注、而且他已经跟平了，就不用再等他
    const bettors = players.filter((p) => !p.allIn);
    if (!(bettors.length === 1 && bettors[0].bet >= t.currentBet)) {
      t.toAct = nextUp;
      return;
    }
  }
  if (t.street === "river") return showdown(t);
  const bettors = players.filter((p) => !p.allIn).length;
  nextStreet(t);
  if (bettors <= 1) {
    t.runout = true;
    t.toAct = -1;
  }
}

function nextStreet(t: Table) {
  for (const p of t.players) Object.assign(p, { bet: 0, acted: false, raises: 0 });
  t.currentBet = 0;
  t.minRaise = t.bb;
  if (t.street === "preflop") {
    t.board.push(t.deck.pop()!, t.deck.pop()!, t.deck.pop()!);
    t.street = "flop";
  } else if (t.street === "flop") {
    t.board.push(t.deck.pop()!);
    t.street = "turn";
  } else {
    t.board.push(t.deck.pop()!);
    t.street = "river";
  }
  t.toAct = nextIndex(t, t.dealer, canBet);
  for (const p of t.players) if (live(p) && !p.allIn) p.last = null;
}

/** 自动发牌阶段每次调用发一条街，发完河牌就摊牌 */
export function runoutStep(t: Table) {
  if (!t.runout || t.street === "done") return;
  if (t.street === "river") showdown(t);
  else nextStreet(t);
  t.toAct = -1;
}

function awardFold(t: Table) {
  const winner = t.players.findIndex(live);
  const amount = potSize(t);
  t.players[winner].chips += amount;
  t.result = { pots: [{ amount, winners: [winner], rank: null }], showdown: false, best: {} };
  finish(t);
}

/** 摊牌：按每个人投入的多少分出主池和边池，每个池分给有资格的人里牌最大的 */
function showdown(t: Table) {
  const best: Record<number, Card[]> = {};
  const scores = new Map<number, number>();
  t.players.forEach((p, i) => {
    if (!live(p)) return;
    const b = bestHand([...p.hand, ...t.board]);
    best[i] = b.cards;
    scores.set(i, b.score);
  });
  const caps = [...new Set(t.players.filter(live).map((p) => p.total))].sort((a, b) => a - b);
  const pots: Pot[] = [];
  let prev = 0;
  for (const cap of caps) {
    let amount = 0;
    for (const p of t.players) amount += Math.max(0, Math.min(p.total, cap) - prev);
    const eligible = [...scores.keys()].filter((i) => t.players[i].total >= cap);
    const top = Math.max(...eligible.map((i) => scores.get(i)!));
    // 平分时从庄家左手边开始排，零头给第一个
    const winners = eligible
      .filter((i) => scores.get(i) === top)
      .sort((a, b) => ((a - t.dealer + 4) % 4 || 4) - ((b - t.dealer + 4) % 4 || 4));
    if (amount > 0) pots.push({ amount, winners, rank: handRank(top) });
    prev = cap;
  }
  // 弃牌的人投得比所有摊牌的人都多时，多出来的部分并进最后一个池
  const extra = potSize(t) - pots.reduce((s, p) => s + p.amount, 0);
  if (extra > 0) pots[pots.length - 1].amount += extra;
  for (const pot of pots) {
    const share = Math.floor(pot.amount / pot.winners.length);
    pot.winners.forEach(
      (w, k) => (t.players[w].chips += share + (k === 0 ? pot.amount - share * pot.winners.length : 0)),
    );
  }
  t.result = { pots, showdown: true, best };
  finish(t);
}

function finish(t: Table) {
  t.street = "done";
  t.toAct = -1;
  t.runout = false;
}

export const humanOut = (t: Table) => t.players[0].chips <= 0 && t.street === "done";
export const humanWonTable = (t: Table) => t.street === "done" && t.players.slice(1).every((p) => p.chips <= 0);

// ---------- 电脑玩家 ----------

const STYLE = {
  tight: { loose: -0.05, aggr: 0.7, bluff: 0.02 },
  loose: { loose: 0.1, aggr: 0.6, bluff: 0.05 },
  aggro: { loose: 0.03, aggr: 1.3, bluff: 0.12 },
  human: { loose: 0, aggr: 1, bluff: 0 },
};

/**
 * 电脑的决策：估算胜率，和“平均水平”（1 / 在局人数）比，再看底池赔率。
 * 牌很好就加注，够赔率就跟，不够就弃；不同性格的松紧、凶不凶、诈唬频率不同
 */
export function botAction(t: Table): Action {
  const p = t.players[t.toAct];
  const { toCall, canCheck, canRaise, minTo, maxTo } = legal(t);
  const style = STYLE[p.style];
  const opponents = t.players.filter(live).length - 1;
  const eq = equity(p.hand, t.board, opponents, 160);
  const strength = eq * (opponents + 1);
  const pot = potSize(t);
  const r = Math.random();
  const raise = (frac: number): Action => {
    if (!canRaise || p.raises >= 2) return canCheck ? { type: "check" } : { type: "call" };
    const to = Math.round((t.currentBet + Math.max(t.minRaise, pot * frac)) / t.bb) * t.bb;
    return to >= maxTo * 0.85 ? { type: "allin" } : { type: "raise", to: Math.max(minTo, to) };
  };
  if (strength > 2.4 - style.loose * 4) {
    if (strength > 3 && r < 0.12 * style.aggr) return { type: "allin" };
    if (r < 0.7 * style.aggr) return raise(0.6 + r * 0.6);
  }
  if (strength > 1.5 && r < 0.3 * style.aggr) return raise(0.5);
  if (canCheck) return r < style.bluff ? raise(0.5) : { type: "check" };
  const odds = toCall / (pot + toCall);
  if (eq + style.loose > odds + 0.04) return { type: "call" };
  if (r < style.bluff / 2) return { type: "call" };
  return { type: "fold" };
}
