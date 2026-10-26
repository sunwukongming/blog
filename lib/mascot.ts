// 看板娘的台词。形象和性格参考《狂赌之渊》的蛇喰梦子（同人，非官方）：
// 平时温柔有礼、说话客气，一碰到赌局就两眼放光，进入“赌狂”状态
export type Mood = "normal" | "smile" | "pout" | "surprised" | "smug" | "sleepy" | "crazy";
export type Line = { text: string; mood: Mood };

export const MASCOT_NAME = "梦子";

const L = (mood: Mood, ...texts: string[]): Line[] => texts.map((text) => ({ text, mood }));

/** 进入页面时说的话：先找完全匹配的路径，再找前缀（带 * 的） */
const PAGES: Record<string, Line[]> = {
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
  "/about": L("smile", "想支持一下吗？这份心意，我会好好收下的哦。"),
};

export function pageLines(pathname: string): Line[] {
  if (PAGES[pathname]) return PAGES[pathname];
  const prefix = Object.keys(PAGES)
    .filter((k) => k.endsWith("/*") && pathname.startsWith(k.slice(0, -1)))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? PAGES[prefix] : L("normal", "这里是哪里呢？未知的地方，也别有一番乐趣哦。");
}

/** 第一次出现时按时间打招呼 */
export function greeting(hour: number): Line[] {
  if (hour < 6) return L("sleepy", "这么晚了还没睡吗？……深夜的赌局，可是最危险的哦。");
  if (hour < 11) return L("smile", "早上好呀。新的一天，从一场小小的赌局开始怎么样？");
  if (hour < 14) return L("smile", "午安～吃饱了才有力气下注哦。");
  if (hour < 18) return L("smug", "下午好。犯困的时候，来一局游戏提提神吧？");
  return L("smile", "晚上好。夜晚才是赌局真正开始的时候呢。");
}

/** 被点的时候按顺序说 */
export const POKES: Line[] = [
  { text: "哎呀，您在做什么呢？", mood: "surprised" },
  { text: "再戳一下的话……要不要赌我会不会生气？", mood: "smug" },
  { text: "呵呵，您真是个有趣的人呢。", mood: "smile" },
  { text: "这样戳来戳去……一点风险都没有，不好玩哦。", mood: "pout" },
  { text: "这份刺激……再来！再来一次吧！", mood: "crazy" },
  { text: "好啦，我一直在这里哦。", mood: "smile" },
];

export const IDLE = L("smile", "不下注的话，什么都不会发生哦。", "您在犹豫吗？犹豫的时间，也是赌局的一部分呢。");
export const COPY = L("smug", "复制下来了吗？那就是您的筹码了呢。记得注明出处哦。");
export const COMEBACK = L("smile", "您回来了！我还以为您逃离牌桌了呢～");
export const HIDE = L("smile", "要走了吗？下次再一起赌吧。");
export const SHOW = L("smile", "我回来了～今天要赌点什么呢？");

export const pick = (lines: Line[]) => lines[Math.floor(Math.random() * lines.length)];

/** 其他组件（比如德州扑克）让看板娘说一句话 */
export const MASCOT_EVENT = "gm:mascot-say";
export function mascotSay(line: Line) {
  window.dispatchEvent(new CustomEvent<Line>(MASCOT_EVENT, { detail: line }));
}
export const POKER_ALLIN = L("crazy", "全下了……！就是这样，把一切都押上吧！", "啊啊，这份紧张感……太美妙了！");
export const POKER_BIG_WIN = L("crazy", "赢了！好厉害……再来一局，再来一局吧！");
export const POKER_BUST = L("smile", "输光了呢……不过，能输得这么彻底，也是一种美哦。");
