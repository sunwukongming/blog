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
    summary: "10 张地图闯关：柱子、回廊、穿墙、迷宫……还有限时的金色食物，另有无尽模式。",
    stack: ["Canvas", "React"],
    href: "/games/snake",
    playable: true,
    controls: "方向键或 WASD 控制方向，空格暂停。吃够数量过关，金色食物一个顶三个。",
    touchControls: "用加大版方向键（含暂停），或在棋盘上滑动转向。",
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
    touchControls: "棋盘滑动：左右移动，上滑旋转，下滑直接落底；下方 ↓ 加速，可点暂停。",
  },
  {
    slug: "2048",
    title: "2048",
    status: "shipped",
    summary: "滑动合并相同数字，凑出 2048；支持撤销一步。",
    stack: ["React", "CSS"],
    href: "/games/2048",
    playable: true,
    controls: "方向键或 WASD 移动；U / Backspace 撤销一步。相同数字相撞会合并。",
    touchControls: "在棋盘上滑动；可点「撤销」回退一步。",
  },
  {
    slug: "breakout",
    title: "打砖块",
    status: "shipped",
    summary: "8 个关卡：硬砖块、打不碎的金属块，还有加宽、减速、加命三种道具。",
    stack: ["Canvas", "React"],
    href: "/games/breakout",
    playable: true,
    controls: "移动鼠标或按 ← → 控制球拍，空格发球，P 暂停。金属块打不碎，打掉其余砖块就过关。",
    touchControls: "拖动手指直接移球拍（不拖尾），点一下发球；也可用下方左右键。",
  },
  {
    slug: "minesweeper",
    title: "扫雷",
    status: "shipped",
    summary: "初级 9×9、中级 16×16，第一下永远不会踩雷。",
    stack: ["React", "CSS Grid"],
    href: "/games/minesweeper",
    playable: true,
    controls: "左键翻开，右键或 F 插旗；方向键移动焦点，回车翻开。点已翻开的数字可一次翻开周围。",
    touchControls: "轻点翻开，长按插旗（滑开会取消）；也可开插旗模式。点已翻开的数字可一次翻周围。",
  },
  {
    slug: "poker",
    title: "德州扑克",
    status: "shipped",
    summary: "和三个性格不同的电脑打无限注德州：一个保守，一个爱跟，一个爱诈唬。",
    stack: ["React", "蒙特卡洛"],
    href: "/games/poker",
    playable: true,
    controls: "F 弃牌，C 或空格过牌 / 跟注，R 按滑块金额加注，A 全下；一手结束后按回车发下一手。",
    touchControls: "用下面的按钮操作，拖动滑块选加注金额。",
  },
  {
    slug: "memory",
    title: "记忆翻牌",
    status: "shipped",
    summary: "简单 / 普通 / 困难三档翻牌配对，步数越少越好；本机按难度记最少步数。",
    stack: ["React", "CSS"],
    href: "/games/memory",
    playable: true,
    controls: "方向键移动焦点，回车或空格翻牌；也可鼠标点。图案相同就留下。",
    touchControls: "点两张牌配对。顶部可切换简单 / 普通 / 困难。",
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
