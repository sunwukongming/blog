import type { Locale, Messages } from "./i18n";

// 看板娘的台词。形象和性格参考《狂赌之渊》的蛇喰梦子（同人，非官方）：
// 平时温柔有礼、说话客气，一碰到赌局就两眼放光，进入“赌狂”状态
export type Mood = "normal" | "smile" | "pout" | "surprised" | "smug" | "sleepy" | "crazy";
export type Line = { text: string; mood: Mood };

export const MASCOT_NAME: Messages<string> = { zh: "梦子", en: "Yumeko", ja: "夢子" };

const L = (mood: Mood, ...texts: string[]): Line[] => texts.map((text) => ({ text, mood }));

/** 进入页面时说的话：先找完全匹配的路径，再找前缀（带 * 的）。路径不带语言前缀 */
const PAGES: Messages<Record<string, Line[]>> = {
  zh: {
    "/": [
      ...L("smile", "欢迎光临～要不要和我赌一把呢？", "书房里的东西都能点哦。猜猜看，哪一样通往游戏呢？"),
      ...L("smug", "桌上那个手柄……您也察觉到了吧？那里有赌局的气味呢。"),
    ],
    "/blog": L("smile", "文章也是一种赌注呢。我赌您能读完一整篇哦。", "卡片会自己转起来，像轮盘一样……真让人心动呢。"),
    "/blog/*": [...L("smile", "请慢慢读吧，我会在这里安静地陪着您。"), ...L("smug", "读到最后的话……算您赢哦。")],
    "/categories": L("smile", "每一颗行星都是一个分类呢。要押哪一颗呢？"),
    "/categories/*": L("normal", "就是这颗星球吗？您的直觉，我很欣赏哦。"),
    "/archive": L("smile", "回顾过去的牌局也很重要呢。输过的，才会记得最清楚。"),
    "/games": [
      ...L("crazy", "游戏！这里……这里全都是赌局吗？！心跳得好快呢！"),
      ...L("smile", "贪吃蛇和打砖块都有关卡哦。闯关，也是和自己的一场赌局呢。"),
    ],
    "/games/snake": L("smile", "每吃一个就更快一点……这份越来越危险的感觉，真棒呢。"),
    "/games/tetris": L("smug", "要不要赌一把，等那根长条出现呢？"),
    "/games/2048": L("smile", "下一块出现在哪里全凭运气……我最喜欢这种游戏了。"),
    "/games/breakout": L("normal", "金属块是打不碎的哦。看清楚规则，才是赢的第一步。"),
    "/games/minesweeper": L("smug", "每一下都可能是雷……呵呵，好刺激呢。"),
    "/games/poker": L("crazy", "德州扑克……！终于等到了。来吧，让我们赌个痛快！"),
    "/games/memory": L("smug", "翻牌也是赌运气呢。下一张……您猜得中吗？"),
  },
  en: {
    "/": [
      ...L(
        "smile",
        "Welcome! Care to place a little bet with me?",
        "Everything in this study is clickable. Can you guess which one leads to the games?",
      ),
      ...L("smug", "That controller on the desk... you noticed it too, didn't you? I can smell a wager over there."),
    ],
    "/blog": L(
      "smile",
      "Every article is a wager, you know. I bet you'll read one all the way through.",
      "The cards turn on their own, like a roulette wheel... how thrilling.",
    ),
    "/blog/*": [
      ...L("smile", "Take your time reading. I'll keep you quiet company right here."),
      ...L("smug", "Make it to the end... and the win is yours."),
    ],
    "/categories": L("smile", "Each planet is a category. Which one will you bet on?"),
    "/categories/*": L("normal", "This planet, then? I do admire your instincts."),
    "/archive": L("smile", "Looking back on old hands matters too. The ones you lost, you remember best."),
    "/games": [
      ...L("crazy", "Games! Is this... is this all one big gamble?! My heart is racing!"),
      ...L("smile", "Snake and Breakout both have stages. Clearing them is a bet against yourself."),
    ],
    "/games/snake": L("smile", "A little faster with every bite... I love that creeping sense of danger."),
    "/games/tetris": L("smug", "Shall we bet on when that long piece finally shows up?"),
    "/games/2048": L("smile", "Where the next tile lands is pure luck... my favorite kind of game."),
    "/games/breakout": L("normal", "The metal bricks can't be broken. Knowing the rules is the first step to winning."),
    "/games/minesweeper": L("smug", "Any click could be a mine... hehe, how exciting."),
    "/games/poker": L(
      "crazy",
      "Texas Hold'em...! I've been waiting for this. Come, let's gamble to our hearts' content!",
    ),
    "/games/memory": L("smug", "Flipping cards is a game of luck too. The next one... can you guess it?"),
  },
  ja: {
    "/": [
      ...L(
        "smile",
        "いらっしゃいませ～。わたくしと一勝負いかがですか？",
        "書斎のものは全部クリックできますよ。どれがゲームに通じているか、当ててみます？",
      ),
      ...L("smug", "机の上のあのコントローラー……お気づきでしょう？賭けの匂いがしますわ。"),
    ],
    "/blog": L(
      "smile",
      "記事もひとつの賭けですわ。最後まで読み切れる方に賭けますね。",
      "カードがひとりでに回って、まるでルーレットのよう……胸が高鳴りますわ。",
    ),
    "/blog/*": [
      ...L("smile", "どうぞごゆっくり。わたくしはここで静かにお付き合いしますわ。"),
      ...L("smug", "最後まで読めたら……あなたの勝ちですわ。"),
    ],
    "/categories": L("smile", "惑星ひとつひとつがカテゴリーですわ。どれに賭けます？"),
    "/categories/*": L("normal", "この星ですか？その直感、素敵ですわ。"),
    "/archive": L("smile", "過去の勝負を振り返るのも大事ですわ。負けた勝負ほど、よく覚えているものです。"),
    "/games": [
      ...L("crazy", "ゲーム！ここは……ここは全部、賭けの場なのですか？！胸がどきどきしますわ！"),
      ...L("smile", "スネークとブロック崩しにはステージがありますの。攻略も自分との賭けですわ。"),
    ],
    "/games/snake": L("smile", "食べるたびに少しずつ速くなる……この危うさ、たまりませんわ。"),
    "/games/tetris": L("smug", "あの長い棒が来るまで、賭けてみません？"),
    "/games/2048": L("smile", "次のタイルがどこに出るかは運次第……こういうゲーム、大好きですわ。"),
    "/games/breakout": L("normal", "メタルブロックは壊せませんわ。ルールを見極めるのが勝利への第一歩です。"),
    "/games/minesweeper": L("smug", "どのマスも地雷かもしれない……ふふ、ぞくぞくしますわ。"),
    "/games/poker": L("crazy", "テキサスホールデム……！待っていましたわ。さあ、心ゆくまで賭けましょう！"),
    "/games/memory": L("smug", "神経衰弱も運試しですわ。次の一枚……当てられます？"),
  },
};

const UNKNOWN: Messages<Line[]> = {
  zh: L("normal", "这里是哪里呢？未知的地方，也别有一番乐趣哦。"),
  en: L("normal", "Where are we? Unknown places have their own charm."),
  ja: L("normal", "ここはどこでしょう？知らない場所にも、それなりの楽しみがありますわ。"),
};

export function pageLines(pathname: string, lang: Locale): Line[] {
  const pages = PAGES[lang];
  if (pages[pathname]) return pages[pathname];
  const prefix = Object.keys(pages)
    .filter((k) => k.endsWith("/*") && pathname.startsWith(k.slice(0, -1)))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? pages[prefix] : UNKNOWN[lang];
}

const GREETINGS: Messages<[string, string, string, string, string]> = {
  zh: [
    "这么晚了还没睡吗？……深夜的赌局，可是最危险的哦。",
    "早上好呀。新的一天，从一场小小的赌局开始怎么样？",
    "午安～吃饱了才有力气下注哦。",
    "下午好。犯困的时候，来一局游戏提提神吧？",
    "晚上好。夜晚才是赌局真正开始的时候呢。",
  ],
  en: [
    "Still up at this hour? ...Late-night wagers are the most dangerous kind.",
    "Good morning. How about starting the day with a small bet?",
    "Good afternoon~ You'll need a full stomach to place your bets.",
    "Afternoon. Feeling drowsy? A quick game might wake you up.",
    "Good evening. Night is when the real gambling begins.",
  ],
  ja: [
    "こんな時間まで起きていらっしゃるの？……深夜の賭けは一番危ないのですよ。",
    "おはようございます。新しい一日、小さな賭けから始めてみません？",
    "こんにちは～。お腹を満たしてこそ、賭ける元気が出ますわ。",
    "こんにちは。眠くなったら、ゲームで目を覚ましましょう？",
    "こんばんは。夜こそ、賭けが本当に始まる時間ですわ。",
  ],
};

/** 第一次出现时按时间打招呼 */
export function greeting(hour: number, lang: Locale): Line[] {
  const g = GREETINGS[lang];
  if (hour < 6) return L("sleepy", g[0]);
  if (hour < 11) return L("smile", g[1]);
  if (hour < 14) return L("smile", g[2]);
  if (hour < 18) return L("smug", g[3]);
  return L("smile", g[4]);
}

/** 被点的时候按顺序说 */
export const POKES: Messages<Line[]> = {
  zh: [
    { text: "哎呀，您在做什么呢？", mood: "surprised" },
    { text: "再戳一下的话……要不要赌我会不会生气？", mood: "smug" },
    { text: "呵呵，您真是个有趣的人呢。", mood: "smile" },
    { text: "这样戳来戳去……一点风险都没有，不好玩哦。", mood: "pout" },
    { text: "这份刺激……再来！再来一次吧！", mood: "crazy" },
    { text: "好啦，我一直在这里哦。", mood: "smile" },
  ],
  en: [
    { text: "Oh my, what are you doing?", mood: "surprised" },
    { text: "Poke me again... want to bet on whether I'll get angry?", mood: "smug" },
    { text: "Hehe, you really are an interesting one.", mood: "smile" },
    { text: "All this poking... there's no risk in it at all. How dull.", mood: "pout" },
    { text: "This thrill... again! One more time!", mood: "crazy" },
    { text: "There, there. I'm right here.", mood: "smile" },
  ],
  ja: [
    { text: "あら、何をなさっているの？", mood: "surprised" },
    { text: "もう一度つついたら……わたくしが怒るかどうか、賭けます？", mood: "smug" },
    { text: "ふふ、面白い方ですわね。", mood: "smile" },
    { text: "つついてばかり……リスクがまるでなくて、つまりませんわ。", mood: "pout" },
    { text: "この刺激……もっと！もう一度！", mood: "crazy" },
    { text: "はいはい、わたくしはずっとここにいますわ。", mood: "smile" },
  ],
};

export const IDLE: Messages<Line[]> = {
  zh: L("smile", "不下注的话，什么都不会发生哦。", "您在犹豫吗？犹豫的时间，也是赌局的一部分呢。"),
  en: L("smile", "Nothing happens unless you place a bet.", "Hesitating? The hesitation is part of the game, too."),
  ja: L("smile", "賭けなければ、何も起こりませんわ。", "迷っていらっしゃるの？迷う時間も、賭けのうちですわ。"),
};
export const COPY: Messages<Line[]> = {
  zh: L("smug", "复制下来了吗？那就是您的筹码了呢。记得注明出处哦。"),
  en: L("smug", "Copied it? Then those are your chips now. Do remember to credit the source."),
  ja: L("smug", "コピーしました？それがあなたのチップですわ。出典は忘れずに。"),
};
export const COMEBACK: Messages<Line[]> = {
  zh: L("smile", "您回来了！我还以为您逃离牌桌了呢～"),
  en: L("smile", "You're back! I thought you'd fled the table~"),
  ja: L("smile", "おかえりなさい！テーブルから逃げたのかと思いましたわ～"),
};
export const HIDE: Messages<Line[]> = {
  zh: L("smile", "要走了吗？下次再一起赌吧。"),
  en: L("smile", "Leaving already? Let's gamble again next time."),
  ja: L("smile", "もう行ってしまうの？また一緒に賭けましょうね。"),
};
export const SHOW: Messages<Line[]> = {
  zh: L("smile", "我回来了～今天要赌点什么呢？"),
  en: L("smile", "I'm back~ What shall we bet on today?"),
  ja: L("smile", "ただいま～。今日は何を賭けましょう？"),
};

export const pick = (lines: Line[]) => lines[Math.floor(Math.random() * lines.length)];

/** 其他组件（比如德州扑克）让看板娘说一句话 */
export const MASCOT_EVENT = "gm:mascot-say";
export function mascotSay(line: Line) {
  window.dispatchEvent(new CustomEvent<Line>(MASCOT_EVENT, { detail: line }));
}
export const POKER_ALLIN: Messages<Line[]> = {
  zh: L("crazy", "全下了……！就是这样，把一切都押上吧！", "啊啊，这份紧张感……太美妙了！"),
  en: L("crazy", "All in...! That's it, stake everything!", "Ahh, this tension... it's exquisite!"),
  ja: L("crazy", "オールイン……！そう、すべてを賭けてしまいましょう！", "ああ、この緊張感……たまりませんわ！"),
};
export const POKER_BIG_WIN: Messages<Line[]> = {
  zh: L("crazy", "赢了！好厉害……再来一局，再来一局吧！"),
  en: L("crazy", "You won! Incredible... one more hand, one more!"),
  ja: L("crazy", "勝ちましたわ！すごい……もう一勝負、もう一勝負しましょう！"),
};
export const POKER_BUST: Messages<Line[]> = {
  zh: L("smile", "输光了呢……不过，能输得这么彻底，也是一种美哦。"),
  en: L("smile", "Lost it all... but losing so completely has a beauty of its own."),
  ja: L("smile", "すってんてんですわね……でも、ここまで潔く負けるのも、ひとつの美しさですわ。"),
};
