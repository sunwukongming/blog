import type { Messages } from "@/lib/i18n";

/** 拼 HUD 提示需要的局面数据（Stats 的子集） */
export type TetrisHud = {
  combo: number;
  comboPeak: number;
  b2b: boolean;
  canHold: boolean;
  hold: string | null;
  next: string[];
  ghost: number;
  linesToLevel: number;
};
/** 一次消行的结算，渲染时再拼成文字 */
export type TetrisClear = { b2b: boolean; tspin: boolean; cleared: number; combo: number };
type PadAction = "left" | "right" | "rotate" | "down" | "drop" | "hold";
type Tier = "near" | "mid" | "far";

const tierOf = (n: number): Tier => (n <= 2 ? "near" : n <= 5 ? "mid" : "far");

const zhClearNames = ["", "单消", "双消！", "三消！", "Tetris！！"];
const zh = {
  score: "分数",
  scoreTitle: (n: number) => `本局分数 ${n}（满刻度 10000）`,
  scoreAria: (n: number) => `分数 ${n}`,
  lines: "行",
  linesTitle: (n: number) => `本局消行 ${n}（满刻度按 50）`,
  linesAria: (n: number) => `消行 ${n}`,
  sprintTitle: (n: number) => `40 行短冲 ${n}/40`,
  sprintAria: (n: number) => `短冲进度 ${n} 之 40`,
  level: "等级",
  levelTitle: (n: number) => `等级 ${n}（满刻度按 15）`,
  levelAria: (n: number) => `等级 ${n}`,
  hudTitle: (s: TetrisHud) =>
    `连消|Hold：连消 ×${s.combo}${s.comboPeak > 1 ? ` · 峰 ${s.comboPeak}` : ""} · B2B ${s.b2b ? "就绪" : "—"} · Hold ${s.canHold === false ? "冷却" : "可用"}${s.hold ? `/${s.hold}` : "/空"} · 距升级 ${s.linesToLevel} · 预览 ${s.next[0] ?? "—"} · 幽灵 ${s.ghost} 格`,
  combo: "连消",
  comboNowTitle: (n: number) => `当前连消 ×${n}（满刻度按 8）`,
  comboNowAria: (n: number) => `当前连消 ${n}`,
  ghostDepthTitle: (n: number) => `幽灵落点深度 ${n} 格（满刻度按 20）`,
  ghostDepthAria: (n: number) => `幽灵深度 ${n} 格`,
  effTitle: (avg: number) => `行均分 ${avg}（满刻度按 400）`,
  effTitleNone: "行均分 —",
  effAria: (avg: number) => `每行约 ${avg} 分`,
  effAriaNone: "行均分未知",
  pressureTitle: (n: number) => `堆高压力（幽灵越浅越高）深度 ${n}（满压按深度 0）`,
  pressureAria: (n: number) => `堆高压力，幽灵深度 ${n}`,
  levelFillTitle: (done: number, left: number) => `本级进度 ${done}/10（距升级 ${left} 行）`,
  levelFillAria: (done: number) => `本级进度 ${done} 之 10`,
  scoreLevelTitle: (n: number) => `级均分 ${n}（满刻度 3000）`,
  scoreLevelAria: (n: number) => `级均分 ${n}`,
  linesDensityTitle: (n: number) => `级均行 ${n}（满刻度按 12，理想约 10）`,
  linesDensityAria: (n: number) => `级均行 ${n}`,
  levelRemainTitle: (n: number) => `距升级还剩 ${n} 行（满刻度 10）`,
  levelRemainAria: (n: number) => `距升级还剩 ${n} 行`,
  levelDoneTitle: (n: number) => `本级进度 ${n}/10 行`,
  levelDoneAria: (n: number) => `本级已消约 ${n} 行`,
  scoreLineTitle: (avg: number) => `分/行 ${avg}（满刻度按 150）`,
  scoreLineTitleNone: "分/行 —",
  scoreLineAria: (avg: number) => `平均每行 ${avg} 分`,
  scoreLineAriaNone: "分行效率未知",
  comboPeakTitle: (n: number) => `本局连消峰值 ×${n}`,
  peak: (n: number) => `峰${n}`,
  comboPeakBar: (cur: number, peak: number) => `连消相对峰值 ${cur}/${peak}`,
  ready: "就绪",
  b2bArmedTitle: "B2B 已武装：下一次困难消行享加成",
  b2bIdleTitle: "B2B 未武装",
  cooling: "冷却",
  available: "可用",
  empty: "空",
  holdBarTitle: (cool: boolean): string => (cool ? "Hold 条：冷却中" : "Hold 条：可用"),
  holdBarAria: (cool: boolean): string => (cool ? "Hold 冷却" : "Hold 可用"),
  holdCoolTitle: (cool: boolean): string => (cool ? "Hold 冷却：落地后恢复" : "Hold 可用"),
  preview: "预览",
  previewTitle: (k: string | undefined) => `预览 ${k ?? "空"}（I/T 高亮）`,
  previewAria: (k: string | undefined) => `预览 ${k ?? "空"}`,
  ghostTierTitle: (n: number) => `幽灵落距 ${n} 格（land≤2 / low≤6 / mid≤12 / high>12）`,
  ghost: "幽灵",
  levelEtaTitle: (n: number) => `距升级色阶：还差 ${n} 行（near≤2 / mid≤5 / far>5）`,
  toLevel: "距升级",
  levelUpTitle: (done: number, left: number) => `升级进度 ${done}/10（还差 ${left}）`,
  levelUpAria: (done: number) => `升级进度 ${done}/10`,
  comboB2bTitle: "连消与 B2B 同屏：连续消行累加；Tetris/T-Spin 武装 B2B",
  pause: "暂停",
  resume: "继续",
  statusTip: (s: TetrisHud) =>
    `连消|Hold：×${s.combo} · B2B ${s.b2b ? "就绪" : "未武装"} · Hold ${s.canHold === false ? "冷却条满" : "可用"}${s.hold ? `/${s.hold}` : "/空"} · 预览 ${s.next[0] ?? "—"}${s.next.length > 1 ? ` · ${s.next.join("→")}` : ""}` +
    ` · 幽灵 ${s.ghost} 格` +
    ` · 距升级色阶 ${s.linesToLevel} 行（${tierOf(s.linesToLevel)}）`,
  clearTip: (c: TetrisClear) => {
    const core = c.tspin
      ? c.cleared >= 2
        ? `T-Spin ${zhClearNames[c.cleared]}`
        : "T-Spin 单消！"
      : zhClearNames[c.cleared];
    return [c.b2b ? "Back-to-Back" : null, core, c.combo > 1 ? `连消 ×${c.combo}` : null].filter(Boolean).join(" · ");
  },
  canvasAria: (n: number) => `俄罗斯方块，${n} 分`,
  title: "俄罗斯方块",
  intro: "右侧预览下一块与队列；消一行得分，一次消得越多分越高",
  start: "开始",
  paused: "暂停中",
  newRecord: "新纪录！",
  toppedOut: "堆到顶了",
  result: (score: number, lines: number) => `${score} 分 · 消了 ${lines} 行`,
  again: "再来一局",
  holdSideTitle: (cool: boolean): string =>
    cool ? "Hold 冷却：落地后再可交换" : "C / Shift：与当前块交换；落地前每块限一次",
  hold: "暂存",
  holdSlotAria: (k: string | null) => (k ? `暂存 ${k} 形` : "暂存为空"),
  queueTitle: (q: string[]) => `预览队列：${q.join(" → ")}（7-bag）`,
  next: "下一个",
  firstNext: (k: string) => `首${k}`,
  nextAria: (q: string[]) => `下一个：${q.join("、")}`,
  best: "最高",
  /** 触屏按键：icon 是按钮上显示的字，label 是读屏读的 */
  pad: {
    left: { icon: "←", label: "左移" },
    rotate: { icon: "旋转", label: "旋转" },
    down: { icon: "↓", label: "下移" },
    drop: { icon: "落底", label: "直接落下" },
    right: { icon: "→", label: "右移" },
    hold: { icon: "Hold", label: "暂存 / 交换" },
  } as Record<PadAction, { icon: string; label: string }>,
  hintMouse:
    "右侧看下一个与暂存；连续消行有连消加成；Tetris / T-Spin 可累积 Back-to-Back。旋转卡住 T 形再消行可 T-Spin。",
  hintTouch: "棋盘滑动：左右移动，上滑旋转，下滑落底；下方 Hold 暂存，↓ 加速，可点暂停。消行与 T-Spin 有顶部提示。",
};

const enClearNames = ["", "Single", "Double!", "Triple!", "Tetris!!"];
const en: typeof zh = {
  score: "Score",
  scoreTitle: (n) => `Score ${n} (bar max 10000)`,
  scoreAria: (n) => `Score ${n}`,
  lines: "Lines",
  linesTitle: (n) => `Lines cleared ${n} (bar max 50)`,
  linesAria: (n) => `Lines ${n}`,
  sprintTitle: (n) => `40-line sprint ${n}/40`,
  sprintAria: (n) => `Sprint progress ${n} of 40`,
  level: "Level",
  levelTitle: (n) => `Level ${n} (bar max 15)`,
  levelAria: (n) => `Level ${n}`,
  hudTitle: (s) =>
    `Combo | Hold: combo ×${s.combo}${s.comboPeak > 1 ? ` · peak ${s.comboPeak}` : ""} · B2B ${s.b2b ? "ready" : "—"} · Hold ${s.canHold === false ? "used" : "ready"}${s.hold ? `/${s.hold}` : "/empty"} · ${s.linesToLevel} to next level · next ${s.next[0] ?? "—"} · ghost ${s.ghost}`,
  combo: "Combo",
  comboNowTitle: (n) => `Current combo ×${n} (bar max 8)`,
  comboNowAria: (n) => `Current combo ${n}`,
  ghostDepthTitle: (n) => `Ghost drop depth ${n} (bar max 20)`,
  ghostDepthAria: (n) => `Ghost depth ${n}`,
  effTitle: (avg) => `Points per line ${avg} (bar max 400)`,
  effTitleNone: "Points per line —",
  effAria: (avg) => `About ${avg} points per line`,
  effAriaNone: "Points per line unknown",
  pressureTitle: (n) => `Stack pressure (shallower ghost = higher), depth ${n} (max at depth 0)`,
  pressureAria: (n) => `Stack pressure, ghost depth ${n}`,
  levelFillTitle: (done, left) => `Level progress ${done}/10 (${left} lines to level up)`,
  levelFillAria: (done) => `Level progress ${done} of 10`,
  scoreLevelTitle: (n) => `Points per level ${n} (bar max 3000)`,
  scoreLevelAria: (n) => `Points per level ${n}`,
  linesDensityTitle: (n) => `Lines per level ${n} (bar max 12, ideal ~10)`,
  linesDensityAria: (n) => `Lines per level ${n}`,
  levelRemainTitle: (n) => `${n} lines to level up (bar max 10)`,
  levelRemainAria: (n) => `${n} lines to level up`,
  levelDoneTitle: (n) => `Level progress ${n}/10 lines`,
  levelDoneAria: (n) => `About ${n} lines cleared this level`,
  scoreLineTitle: (avg) => `Pts/line ${avg} (bar max 150)`,
  scoreLineTitleNone: "Pts/line —",
  scoreLineAria: (avg) => `Average ${avg} points per line`,
  scoreLineAriaNone: "Line efficiency unknown",
  comboPeakTitle: (n) => `Peak combo this run ×${n}`,
  peak: (n) => `Peak ${n}`,
  comboPeakBar: (cur, peak) => `Combo vs. peak ${cur}/${peak}`,
  ready: "Ready",
  b2bArmedTitle: "B2B armed: next difficult clear gets a bonus",
  b2bIdleTitle: "B2B not armed",
  cooling: "Used",
  available: "Ready",
  empty: "Empty",
  holdBarTitle: (cool) => (cool ? "Hold: used" : "Hold: ready"),
  holdBarAria: (cool) => (cool ? "Hold used" : "Hold ready"),
  holdCoolTitle: (cool) => (cool ? "Hold used: available after the piece locks" : "Hold ready"),
  preview: "Next",
  previewTitle: (k) => `Next ${k ?? "empty"} (I/T highlighted)`,
  previewAria: (k) => `Next ${k ?? "empty"}`,
  ghostTierTitle: (n) => `Ghost distance ${n} (land≤2 / low≤6 / mid≤12 / high>12)`,
  ghost: "Ghost",
  levelEtaTitle: (n) => `To next level: ${n} lines (near≤2 / mid≤5 / far>5)`,
  toLevel: "To Lv",
  levelUpTitle: (done, left) => `Level-up progress ${done}/10 (${left} to go)`,
  levelUpAria: (done) => `Level-up progress ${done}/10`,
  comboB2bTitle: "Combo and B2B: consecutive clears build combo; Tetris/T-Spin arms B2B",
  pause: "Pause",
  resume: "Resume",
  statusTip: (s) =>
    `Combo | Hold: ×${s.combo} · B2B ${s.b2b ? "ready" : "not armed"} · Hold ${s.canHold === false ? "used" : "ready"}${s.hold ? `/${s.hold}` : "/empty"} · next ${s.next[0] ?? "—"}${s.next.length > 1 ? ` · ${s.next.join("→")}` : ""}` +
    ` · ghost ${s.ghost}` +
    ` · ${s.linesToLevel} lines to next level (${tierOf(s.linesToLevel)})`,
  clearTip: (c) => {
    const core = c.tspin
      ? c.cleared >= 2
        ? `T-Spin ${enClearNames[c.cleared]}`
        : "T-Spin Single!"
      : enClearNames[c.cleared];
    return [c.b2b ? "Back-to-Back" : null, core, c.combo > 1 ? `Combo ×${c.combo}` : null].filter(Boolean).join(" · ");
  },
  canvasAria: (n) => `Tetris, ${n} points`,
  title: "Tetris",
  intro: "Upcoming pieces show on the right. Clear lines to score — more at once scores more.",
  start: "Start",
  paused: "Paused",
  newRecord: "New record!",
  toppedOut: "Topped out",
  result: (score, lines) => `${score} pts · ${lines} lines`,
  again: "Play again",
  holdSideTitle: (cool) =>
    cool ? "Hold used: swap again after the piece locks" : "C / Shift: swap with current piece; once per piece",
  hold: "Hold",
  holdSlotAria: (k) => (k ? `Holding ${k} piece` : "Hold empty"),
  queueTitle: (q) => `Next queue: ${q.join(" → ")} (7-bag)`,
  next: "Next",
  firstNext: (k) => k,
  nextAria: (q) => `Next: ${q.join(", ")}`,
  best: "Best",
  pad: {
    left: { icon: "←", label: "Move left" },
    rotate: { icon: "Rotate", label: "Rotate" },
    down: { icon: "↓", label: "Move down" },
    drop: { icon: "Drop", label: "Hard drop" },
    right: { icon: "→", label: "Move right" },
    hold: { icon: "Hold", label: "Hold / swap" },
  },
  hintMouse:
    "Next and Hold are on the right. Consecutive clears build combo; Tetris / T-Spin chains Back-to-Back. Rotate a T into a tight slot and clear for a T-Spin.",
  hintTouch:
    "Swipe the board: left/right to move, up to rotate, down to drop. Hold below, ↓ to speed up, tap to pause. Clears and T-Spins show on top.",
};

const jaClearNames = ["", "シングル", "ダブル！", "トリプル！", "テトリス！！"];
const ja: typeof zh = {
  score: "スコア",
  scoreTitle: (n) => `スコア ${n}（最大目盛 10000）`,
  scoreAria: (n) => `スコア ${n}`,
  lines: "ライン",
  linesTitle: (n) => `消したライン ${n}（最大目盛 50）`,
  linesAria: (n) => `ライン ${n}`,
  sprintTitle: (n) => `40 ラインスプリント ${n}/40`,
  sprintAria: (n) => `スプリント進捗 ${n}/40`,
  level: "レベル",
  levelTitle: (n) => `レベル ${n}（最大目盛 15）`,
  levelAria: (n) => `レベル ${n}`,
  hudTitle: (s) =>
    `REN | ホールド：REN ×${s.combo}${s.comboPeak > 1 ? ` · 最大 ${s.comboPeak}` : ""} · B2B ${s.b2b ? "準備OK" : "—"} · ホールド ${s.canHold === false ? "使用済" : "可"}${s.hold ? `/${s.hold}` : "/空"} · 昇級まで ${s.linesToLevel} · ネクスト ${s.next[0] ?? "—"} · ゴースト ${s.ghost} マス`,
  combo: "REN",
  comboNowTitle: (n) => `現在の REN ×${n}（最大目盛 8）`,
  comboNowAria: (n) => `現在の REN ${n}`,
  ghostDepthTitle: (n) => `ゴーストの深さ ${n} マス（最大目盛 20）`,
  ghostDepthAria: (n) => `ゴーストの深さ ${n} マス`,
  effTitle: (avg) => `1 ライン平均 ${avg} 点（最大目盛 400）`,
  effTitleNone: "1 ライン平均 —",
  effAria: (avg) => `1 ラインあたり約 ${avg} 点`,
  effAriaNone: "1 ライン平均 不明",
  pressureTitle: (n) => `積み上がり度（ゴーストが浅いほど高い）深さ ${n}（深さ 0 で最大）`,
  pressureAria: (n) => `積み上がり度、ゴーストの深さ ${n}`,
  levelFillTitle: (done, left) => `レベル進捗 ${done}/10（昇級まで ${left} ライン）`,
  levelFillAria: (done) => `レベル進捗 ${done}/10`,
  scoreLevelTitle: (n) => `レベル平均スコア ${n}（最大目盛 3000）`,
  scoreLevelAria: (n) => `レベル平均スコア ${n}`,
  linesDensityTitle: (n) => `レベル平均ライン ${n}（最大目盛 12、理想は約 10）`,
  linesDensityAria: (n) => `レベル平均ライン ${n}`,
  levelRemainTitle: (n) => `昇級まであと ${n} ライン（最大目盛 10）`,
  levelRemainAria: (n) => `昇級まであと ${n} ライン`,
  levelDoneTitle: (n) => `レベル進捗 ${n}/10 ライン`,
  levelDoneAria: (n) => `このレベルで約 ${n} ライン消去`,
  scoreLineTitle: (avg) => `点/ライン ${avg}（最大目盛 150）`,
  scoreLineTitleNone: "点/ライン —",
  scoreLineAria: (avg) => `1 ライン平均 ${avg} 点`,
  scoreLineAriaNone: "ライン効率 不明",
  comboPeakTitle: (n) => `このゲームの最大 REN ×${n}`,
  peak: (n) => `最大${n}`,
  comboPeakBar: (cur, peak) => `最大 REN 比 ${cur}/${peak}`,
  ready: "OK",
  b2bArmedTitle: "B2B 準備OK：次の難しい消去にボーナス",
  b2bIdleTitle: "B2B 未準備",
  cooling: "使用済",
  available: "可",
  empty: "空",
  holdBarTitle: (cool) => (cool ? "ホールド：使用済" : "ホールド：使用可"),
  holdBarAria: (cool) => (cool ? "ホールド使用済" : "ホールド使用可"),
  holdCoolTitle: (cool) => (cool ? "ホールド使用済：着地後に回復" : "ホールド使用可"),
  preview: "ネクスト",
  previewTitle: (k) => `ネクスト ${k ?? "なし"}（I/T を強調）`,
  previewAria: (k) => `ネクスト ${k ?? "なし"}`,
  ghostTierTitle: (n) => `ゴースト落下距離 ${n} マス（land≤2 / low≤6 / mid≤12 / high>12）`,
  ghost: "ゴースト",
  levelEtaTitle: (n) => `昇級まで：あと ${n} ライン（near≤2 / mid≤5 / far>5）`,
  toLevel: "昇級まで",
  levelUpTitle: (done, left) => `昇級進捗 ${done}/10（あと ${left}）`,
  levelUpAria: (done) => `昇級進捗 ${done}/10`,
  comboB2bTitle: "REN と B2B：連続で消すと REN が加算、テトリス/T-Spin で B2B 準備",
  pause: "ポーズ",
  resume: "再開",
  statusTip: (s) =>
    `REN | ホールド：×${s.combo} · B2B ${s.b2b ? "準備OK" : "未準備"} · ホールド ${s.canHold === false ? "使用済" : "可"}${s.hold ? `/${s.hold}` : "/空"} · ネクスト ${s.next[0] ?? "—"}${s.next.length > 1 ? ` · ${s.next.join("→")}` : ""}` +
    ` · ゴースト ${s.ghost} マス` +
    ` · 昇級まで ${s.linesToLevel} ライン（${tierOf(s.linesToLevel)}）`,
  clearTip: (c) => {
    const core = c.tspin
      ? c.cleared >= 2
        ? `T-Spin ${jaClearNames[c.cleared]}`
        : "T-Spin シングル！"
      : jaClearNames[c.cleared];
    return [c.b2b ? "Back-to-Back" : null, core, c.combo > 1 ? `${c.combo} REN` : null].filter(Boolean).join(" · ");
  },
  canvasAria: (n) => `テトリス、${n} 点`,
  title: "テトリス",
  intro: "右側にネクストを表示。ラインを消すと得点、一度に多く消すほど高得点",
  start: "スタート",
  paused: "ポーズ中",
  newRecord: "新記録！",
  toppedOut: "ゲームオーバー",
  result: (score, lines) => `${score} 点 · ${lines} ライン`,
  again: "もう一度",
  holdSideTitle: (cool) =>
    cool ? "ホールド使用済：着地後に再び交換可" : "C / Shift：現在のミノと交換（1 ミノにつき 1 回）",
  hold: "ホールド",
  holdSlotAria: (k) => (k ? `ホールド中 ${k} ミノ` : "ホールドなし"),
  queueTitle: (q) => `ネクスト：${q.join(" → ")}（7-bag）`,
  next: "ネクスト",
  firstNext: (k) => k,
  nextAria: (q) => `ネクスト：${q.join("、")}`,
  best: "ベスト",
  pad: {
    left: { icon: "←", label: "左へ移動" },
    rotate: { icon: "回転", label: "回転" },
    down: { icon: "↓", label: "下へ移動" },
    drop: { icon: "落下", label: "ハードドロップ" },
    right: { icon: "→", label: "右へ移動" },
    hold: { icon: "Hold", label: "ホールド / 交換" },
  },
  hintMouse:
    "右側にネクストとホールド。連続で消すと REN ボーナス、テトリス / T-Spin で Back-to-Back。T ミノを回転で隙間に入れて消すと T-Spin。",
  hintTouch:
    "盤面をスワイプ：左右で移動、上で回転、下で落下。下の Hold でホールド、↓ で加速、タップでポーズ。消去と T-Spin は上部に表示。",
};

export const TETRIS_MESSAGES: Messages<typeof zh> = { zh, en, ja };
