export type GameItem = {
  slug: string;
  title: string;
  status: "shipped" | "lab" | "archive";
  summary: string;
  stack: string[];
  href?: string;
  /** 可以在 /games/[slug] 里直接玩 */
  playable?: boolean;
  /** 玩法说明，显示在棋盘下面；touchControls 是触屏设备上的版本 */
  controls?: string;
  touchControls?: string;
};

/** 游戏页条目：做过的项目与实验室小品 */
export const GAMES: GameItem[] = [
  {
    slug: "snake",
    title: "贪吃蛇",
    status: "shipped",
    summary: "经典贪吃蛇，吃得越多跑得越快。",
    stack: ["Canvas", "React"],
    href: "/games/snake",
    playable: true,
    controls: "方向键或 WASD 控制方向，空格暂停。",
    touchControls: "用下面的方向键，或者在棋盘上滑动来转向。",
  },
  {
    slug: "tetris",
    title: "俄罗斯方块",
    status: "shipped",
    summary: "经典消行，带落点预览和 7 个一袋的随机，越往后落得越快。",
    stack: ["Canvas", "React"],
    href: "/games/tetris",
    playable: true,
    controls: "← → 移动，↑ 或 X 旋转，↓ 加速下落，空格直接落到底，P 暂停。",
    touchControls: "用下面的按钮操作：按住 ← → ↓ 会连续移动，「旋转」转动方块，「落底」直接落到底。",
  },
  {
    slug: "2048",
    title: "2048",
    status: "shipped",
    summary: "滑动合并相同的数字，凑出 2048。",
    stack: ["React", "CSS"],
    href: "/games/2048",
    playable: true,
    controls: "方向键或 WASD 移动所有方块，相同数字相撞会合并。",
    touchControls: "在棋盘上滑动，所有方块一起移动，相同数字相撞会合并。",
  },
  {
    slug: "breakout",
    title: "打砖块",
    status: "shipped",
    summary: "移动球拍接住球，打掉所有砖块进入下一关，一关比一关快。",
    stack: ["Canvas", "React"],
    href: "/games/breakout",
    playable: true,
    controls: "移动鼠标或按 ← → 控制球拍，空格发球，P 暂停。",
    touchControls: "手指在棋盘上左右移动控制球拍，点一下发球。",
  },
  {
    slug: "minesweeper",
    title: "扫雷",
    status: "shipped",
    summary: "初级 9×9、中级 16×16，第一下永远不会踩雷。",
    stack: ["React", "CSS Grid"],
    href: "/games/minesweeper",
    playable: true,
    controls: "左键翻开，右键插旗。点已翻开的数字可以一次翻开周围的格子。",
    touchControls: "点一下翻开，长按插旗（或者打开插旗模式）。点已翻开的数字可以一次翻开周围的格子。",
  },
  {
    slug: "idle-card-backends",
    title: "挂机卡牌：区服与性能",
    status: "archive",
    summary:
      "多区服进程模型、写时复制共享内存、端口与 TIME_WAIT 调优；把建库开服收敛成后台一键操作。",
    stack: ["Python", "Linux", "多进程", "cProfile"],
  },
  {
    slug: "online-judge-sandbox",
    title: "在线判题沙箱",
    status: "archive",
    summary:
      "seccomp 白名单 + RLIMIT + 容器配额三层加固，挡住恶意代码逃逸和资源耗尽。",
    stack: ["Go", "libseccomp", "Docker"],
    href: "/blog/oj-sandbox-with-seccomp",
  },
  {
    slug: "collab-editor-ot",
    title: "协同编辑与视频面试",
    status: "archive",
    summary:
      "OT 算法后端、WebSocket 多端同步，以及 RTC 音视频与 IM 心跳断线重连。",
    stack: ["Go", "WebSocket", "OT", "RTC"],
  },
];

export function gamesByStatus() {
  const order: GameItem["status"][] = ["shipped", "lab", "archive"];
  return order
    .map((status) => ({ status, items: GAMES.filter((g) => g.status === status) }))
    .filter((g) => g.items.length > 0);
}

export function getPlayable(slug: string) {
  return GAMES.find((g) => g.playable && g.slug === slug);
}
