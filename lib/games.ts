import type { Locale, Messages } from "./i18n";

export type GameItem = {
  slug: string;
  title: string;
  status: "shipped" | "lab" | "archive";
  summary: string;
  stack: string[];
  /** 站内路径，不带语言前缀 */
  href?: string;
  /** 可以在 /games/[slug] 里直接玩 */
  playable?: boolean;
  /** 玩法说明，显示在棋盘下面；touchControls 是触屏设备上的版本 */
  controls?: string;
  touchControls?: string;
};

type Text = Messages<string>;
type GameDef = Omit<GameItem, "title" | "summary" | "stack" | "controls" | "touchControls"> & {
  title: Text;
  summary: Text;
  stack: string[] | Messages<string[]>;
  controls?: Text;
  touchControls?: Text;
};

/** Sitemap lastmod for /games/* playable routes (enrich date, Asia/Shanghai calendar day). */
export const GAMES_UPDATED = "2026-10-25";

/** 游戏页条目：做过的项目与实验室小品 */
const DEFS: GameDef[] = [
  {
    slug: "snake",
    title: { zh: "贪吃蛇", en: "Snake", ja: "スネーク" },
    status: "shipped",
    summary: {
      zh: "10 张地图闯关：柱子、回廊、边缘穿墙（对面出）、迷宫……还有限时的金色食物，另有无尽模式。",
      en: "10 stages: pillars, corridors, wrap-around edges, mazes… plus timed golden food and an endless mode.",
      ja: "全 10 ステージ：柱、回廊、端から反対側へ抜けるワープ、迷路……時間限定の金色のエサやエンドレスモードも。",
    },
    stack: ["Canvas", "React"],
    href: "/games/snake",
    playable: true,
    controls: {
      zh: "方向键或 WASD 控制方向，空格暂停。吃够数量过关，金色食物一个顶三个。",
      en: "Arrow keys or WASD to steer, Space to pause. Eat enough to clear the stage; golden food counts as three.",
      ja: "矢印キーまたは WASD で方向転換、Space でポーズ。規定数を食べるとクリア。金色のエサは 3 個分。",
    },
    touchControls: {
      zh: "用加大版方向键（含暂停），或在棋盘上滑动转向。",
      en: "Use the large on-screen arrows (with pause), or swipe on the board to turn.",
      ja: "大きな方向ボタン（ポーズ付き）を使うか、盤面をスワイプして方向転換。",
    },
  },
  {
    slug: "tetris",
    title: { zh: "俄罗斯方块", en: "Tetris", ja: "テトリス" },
    status: "shipped",
    summary: {
      zh: "经典消行：落点预览、Hold、下三块、锁定延迟微调、7 袋随机。",
      en: "Classic line clearing: ghost piece, Hold, next three pieces, tuned lock delay and 7-bag randomizer.",
      ja: "定番のライン消し：ゴースト表示、ホールド、ネクスト 3 個、調整済みのロック遅延、7 種一巡ランダム。",
    },
    stack: ["Canvas", "React"],
    href: "/games/tetris",
    playable: true,
    controls: {
      zh: "← → 移动，↑/X 旋转，↓ 加速，空格落底，C 或 Shift 暂存，P 暂停。",
      en: "← → move, ↑/X rotate, ↓ soft drop, Space hard drop, C or Shift hold, P pause.",
      ja: "← → 移動、↑/X 回転、↓ ソフトドロップ、Space ハードドロップ、C か Shift でホールド、P でポーズ。",
    },
    touchControls: {
      zh: "棋盘滑动：左右移动，上滑旋转，下滑落底；下方 Hold 暂存，↓ 加速，可点暂停。",
      en: "Swipe on the board: left/right to move, up to rotate, down to hard drop. Buttons below for Hold, ↓ soft drop and pause.",
      ja: "盤面をスワイプ：左右で移動、上で回転、下でハードドロップ。下のボタンでホールド、↓ で加速、ポーズも可能。",
    },
  },
  {
    slug: "2048",
    title: { zh: "2048", en: "2048", ja: "2048" },
    status: "shipped",
    summary: {
      zh: "滑动合并相同数字，凑出 2048；支持撤销一步。",
      en: "Slide to merge matching numbers and reach 2048. One-step undo included.",
      ja: "スライドして同じ数字を合体させ、2048 を目指そう。1 手だけ元に戻せます。",
    },
    stack: ["React", "CSS"],
    href: "/games/2048",
    playable: true,
    controls: {
      zh: "方向键或 WASD 移动；U / Backspace 撤销一步。相同数字相撞会合并。",
      en: "Arrow keys or WASD to slide; U / Backspace to undo one move. Matching numbers merge when they collide.",
      ja: "矢印キーまたは WASD で移動、U / Backspace で 1 手戻す。同じ数字がぶつかると合体します。",
    },
    touchControls: {
      zh: "主轴明显地滑动（斜滑不会触发）；可点「撤销」回退一步。",
      en: "Swipe clearly along one axis (diagonal swipes are ignored). Tap “Undo” to go back one move.",
      ja: "縦か横にはっきりスワイプ（斜めは無効）。「元に戻す」で 1 手戻せます。",
    },
  },
  {
    slug: "breakout",
    title: { zh: "打砖块", en: "Breakout", ja: "ブロック崩し" },
    status: "shipped",
    summary: {
      zh: "打砖块：关卡加速与缩拍、金属砖、宽/慢/命/多球道具。",
      en: "Breakout with stages that speed up and shrink the paddle, metal bricks, and wide / slow / extra-life / multi-ball power-ups.",
      ja: "ステージごとに加速しパドルが縮むブロック崩し。メタルブロック、ワイド・スロー・残機・マルチボールのアイテムあり。",
    },
    stack: ["Canvas", "React"],
    href: "/games/breakout",
    playable: true,
    controls: {
      zh: "移动鼠标或按 ← → 控制球拍，空格发球，P 暂停。金属块打不碎，打掉其余砖块就过关。",
      en: "Move the mouse or press ← → to control the paddle, Space to launch, P to pause. Metal bricks can't be broken; clear the rest to win the stage.",
      ja: "マウスか ← → でパドルを操作、Space で発射、P でポーズ。メタルブロックは壊せません。それ以外を全部壊せばクリア。",
    },
    touchControls: {
      zh: "拖动手指直接移球拍（不拖尾），点一下发球；也可用下方左右键。",
      en: "Drag your finger to move the paddle directly, tap to launch, or use the left/right buttons below.",
      ja: "指をドラッグしてパドルを直接動かし、タップで発射。下の左右ボタンも使えます。",
    },
  },
  {
    slug: "minesweeper",
    title: { zh: "扫雷", en: "Minesweeper", ja: "マインスイーパ" },
    status: "shipped",
    summary: {
      zh: "初级 9×9、中级 16×16；第一下安全；中键/双击/点数字可 chord，剩余雷数带进度。",
      en: "Beginner 9×9 and Intermediate 16×16. The first click is always safe; chord with middle-click, double-click or by tapping a number; a progress bar shows mines left.",
      ja: "初級 9×9、中級 16×16。最初の 1 手は必ず安全。中クリック・ダブルクリック・数字タップで一括オープン、残り地雷数は進捗バー付き。",
    },
    stack: ["React", "CSS Grid"],
    href: "/games/minesweeper",
    playable: true,
    controls: {
      zh: "方向键移动，回车翻开，空格/F 插旗；中键或双击已翻数字 chord；R 重开。",
      en: "Arrow keys to move, Enter to reveal, Space/F to flag; middle-click or double-click a revealed number to chord; R to restart.",
      ja: "矢印キーで移動、Enter で開く、Space/F で旗。開いた数字を中クリックかダブルクリックで一括オープン、R でやり直し。",
    },
    touchControls: {
      zh: "轻点翻开，长按插旗；点已翻数字（旗数对齐）可 chord。也可开插旗模式。",
      en: "Tap to reveal, long-press to flag; tap a revealed number with matching flags to chord. A flag mode is also available.",
      ja: "タップで開く、長押しで旗。旗の数が合った数字をタップで一括オープン。旗モードも使えます。",
    },
  },
  {
    slug: "poker",
    title: { zh: "德州扑克", en: "Texas Hold'em", ja: "テキサスホールデム" },
    status: "shipped",
    summary: {
      zh: "和三个性格不同的电脑打无限注德州：一个保守，一个爱跟，一个爱诈唬；盲注每 10 手翻倍并有上涨提示。",
      en: "No-limit Hold'em against three bots with distinct styles: one tight, one calling station, one bluffer. Blinds double every 10 hands, with a warning before they rise.",
      ja: "性格の違う 3 人の CPU とノーリミット・ホールデム。堅実派、コール好き、ブラフ好き。ブラインドは 10 ハンドごとに倍になり、上がる前に通知されます。",
    },
    stack: { zh: ["React", "蒙特卡洛"], en: ["React", "Monte Carlo"], ja: ["React", "モンテカルロ法"] },
    href: "/games/poker",
    playable: true,
    controls: {
      zh: "F 弃牌，C 或空格过牌 / 跟注，R 按滑块金额加注，A 全下；一手结束后按回车发下一手。",
      en: "F fold, C or Space check / call, R raise by the slider amount, A all-in; press Enter to deal the next hand.",
      ja: "F でフォールド、C か Space でチェック／コール、R でスライダーの額だけレイズ、A でオールイン。ハンド終了後は Enter で次へ。",
    },
    touchControls: {
      zh: "用下面的按钮操作，拖动滑块选加注金额。",
      en: "Use the buttons below and drag the slider to choose your raise.",
      ja: "下のボタンで操作し、スライダーでレイズ額を選びます。",
    },
  },
  {
    slug: "memory",
    title: { zh: "记忆翻牌", en: "Memory", ja: "神経衰弱" },
    status: "shipped",
    summary: {
      zh: "简单 / 普通 / 困难三档翻牌配对；连续配对显示连击，本机按难度记最少步数。",
      en: "Match pairs on Easy, Normal or Hard. Consecutive matches build a combo, and your fewest moves are saved per difficulty on this device.",
      ja: "かんたん／ふつう／むずかしいの 3 段階でペアを揃えよう。連続で揃えるとコンボ、最少手数は難易度ごとにこの端末に記録されます。",
    },
    stack: ["React", "CSS"],
    href: "/games/memory",
    playable: true,
    controls: {
      zh: "方向键移动，回车或空格翻牌；连续配对累加连击，翻错清零。",
      en: "Arrow keys to move, Enter or Space to flip. Consecutive matches add to your combo; a miss resets it.",
      ja: "矢印キーで移動、Enter か Space でめくる。連続で揃えるとコンボが増え、外すとリセット。",
    },
    touchControls: {
      zh: "点两张牌配对；键盘可移动焦点并用回车翻开。顶部可切难度。",
      en: "Tap two cards to match them; with a keyboard, move focus and press Enter. Switch difficulty at the top.",
      ja: "2 枚タップしてペアに。キーボードならフォーカスを移動して Enter でめくれます。難易度は上部で切り替え。",
    },
  },
  {
    slug: "idle-card-backends",
    title: {
      zh: "挂机卡牌：区服与性能",
      en: "Idle card game: servers and performance",
      ja: "放置カードゲーム：サーバー構成と性能",
    },
    status: "archive",
    summary: {
      zh: "多区服进程模型、写时复制共享内存、端口与 TIME_WAIT 调优；把建库开服收敛成后台一键操作。",
      en: "Multi-server process model, copy-on-write shared memory, port and TIME_WAIT tuning; turned database setup and server launches into a one-click admin action.",
      ja: "複数サーバーのプロセスモデル、コピーオンライトの共有メモリ、ポートと TIME_WAIT の調整。DB 構築とサーバー開設を管理画面のワンクリックに集約。",
    },
    stack: {
      zh: ["Python", "Linux", "多进程", "cProfile"],
      en: ["Python", "Linux", "Multiprocessing", "cProfile"],
      ja: ["Python", "Linux", "マルチプロセス", "cProfile"],
    },
  },
  {
    slug: "online-judge-sandbox",
    title: { zh: "在线判题沙箱", en: "Online judge sandbox", ja: "オンラインジャッジのサンドボックス" },
    status: "archive",
    summary: {
      zh: "seccomp 白名单 + RLIMIT + 容器配额三层加固，挡住恶意代码逃逸和资源耗尽。",
      en: "Three layers of hardening (seccomp allowlist, RLIMIT and container quotas) to stop malicious code from escaping or exhausting resources.",
      ja: "seccomp の許可リスト、RLIMIT、コンテナのクォータによる 3 層の防御で、悪意あるコードの脱出とリソース枯渇を防ぐ。",
    },
    stack: ["Go", "libseccomp", "Docker"],
    href: "/blog/oj-sandbox-with-seccomp",
  },
  {
    slug: "collab-editor-ot",
    title: { zh: "协同编辑与视频面试", en: "Collaborative editing and video interviews", ja: "共同編集とビデオ面接" },
    status: "archive",
    summary: {
      zh: "OT 算法后端、WebSocket 多端同步，以及 RTC 音视频与 IM 心跳断线重连。",
      en: "OT algorithm backend, multi-client sync over WebSocket, plus RTC audio/video and IM heartbeat reconnection.",
      ja: "OT アルゴリズムのバックエンド、WebSocket による多端末同期、RTC の音声・映像と IM のハートビート再接続。",
    },
    stack: ["Go", "WebSocket", "OT", "RTC"],
  },
];

const localize = (d: GameDef, lang: Locale): GameItem => ({
  ...d,
  title: d.title[lang],
  summary: d.summary[lang],
  stack: Array.isArray(d.stack) ? d.stack : d.stack[lang],
  controls: d.controls?.[lang],
  touchControls: d.touchControls?.[lang],
});

export const getGames = (lang: Locale) => DEFS.map((d) => localize(d, lang));

export const PLAYABLE_SLUGS = DEFS.filter((d) => d.playable).map((d) => d.slug);

export function gamesByStatus(lang: Locale) {
  const games = getGames(lang);
  const order: GameItem["status"][] = ["shipped", "lab", "archive"];
  return order
    .map((status) => ({ status, items: games.filter((g) => g.status === status) }))
    .filter((g) => g.items.length > 0);
}

export function getPlayable(slug: string, lang: Locale) {
  return getGames(lang).find((g) => g.playable && g.slug === slug);
}
