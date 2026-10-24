// 游戏列表卡片上的小图标，48×48 的格子里用几个方块画出每个游戏的样子
const box = (x: number, y: number, fill: string, size = 7) => (
  <rect key={`${x}-${y}`} x={x} y={y} width={size} height={size} rx={1.6} fill={fill} />
);

const ICONS: Record<string, React.ReactNode> = {
  snake: (
    <>
      {[
        [6, 30],
        [14, 30],
        [22, 30],
        [22, 22],
        [22, 14],
        [30, 14],
      ].map(([x, y], i) => box(x, y, i === 5 ? "#ffd6f0" : "#ff3ea5"))}
      <circle cx={37.5} cy={33.5} r={3.4} fill="#7af5ff" />
    </>
  ),
  tetris: (
    <>
      {[
        [10, 26],
        [18, 26],
        [26, 26],
        [18, 18],
      ].map(([x, y]) => box(x, y, "#c49bff"))}
      {[
        [10, 34],
        [18, 34],
        [26, 34],
        [34, 34],
      ].map(([x, y]) => box(x, y, "#7af5ff"))}
      {[
        [34, 18],
        [34, 26],
      ].map(([x, y]) => box(x, y, "#ffb86b"))}
      {box(18, 6, "#ff5c8a")}
      {box(26, 6, "#ff5c8a")}
    </>
  ),
  "2048": (
    <>
      {box(7, 7, "#3d1760", 16)}
      {box(25, 7, "#8f1f86", 16)}
      {box(7, 25, "#ff3ea5", 16)}
      {box(25, 25, "#7af5ff", 16)}
      <text x={33} y={37.5} textAnchor="middle" fontSize={8} fontWeight={900} fill="#03222a" fontFamily="sans-serif">
        2048
      </text>
    </>
  ),
  breakout: (
    <>
      {[0, 1, 2, 3].map((c) =>
        ["#ff5c8a", "#c49bff", "#7af5ff"].map((color, r) => (
          <rect key={`${c}-${r}`} x={5 + c * 10} y={7 + r * 6} width={8.5} height={4} rx={1} fill={color} />
        )),
      )}
      <circle cx={27} cy={30} r={2.8} fill="#fff" />
      <rect x={16} y={38} width={16} height={3.5} rx={1.75} fill="#ff3ea5" />
    </>
  ),
  minesweeper: (
    <>
      {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => box(6 + c * 13, 6 + r * 13, r === 2 || c === 0 ? "#ffffff14" : "#ffffff2e", 11)))}
      <text x={11.5} y={27.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#7ab8ff" fontFamily="monospace">
        1
      </text>
      <text x={24.5} y={40.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#7af5c0" fontFamily="monospace">
        2
      </text>
      <path d="M33.5 11v6.5M34 11.5h5l-1.4 2 1.4 2h-5z" stroke="#ff3ea5" strokeWidth={1.4} fill="#ff3ea5" />
      <circle cx={37.5} cy={37.5} r={3.2} fill="#ffd6f0" />
      <path d="M37.5 32.5v10M32.5 37.5h10" stroke="#ffd6f0" strokeWidth={1.3} strokeLinecap="round" />
    </>
  ),
};

// 德州扑克：两张叠在一起的牌
ICONS.poker = (
  <>
    <rect x={8} y={9} width={20} height={28} rx={3} fill="#f5f0ff" transform="rotate(-12 18 23)" />
    <path d="M14.5 17l3 4-3 4-3-4z" fill="#ff4d6d" transform="rotate(-12 18 23)" />
    <rect x={20} y={11} width={20} height={28} rx={3} fill="#ffffff" stroke="#14021f" strokeWidth={1} transform="rotate(10 30 25)" />
    <text x={30} y={29} textAnchor="middle" fontSize={11} fontWeight={800} fill="#1b1530" fontFamily="sans-serif" transform="rotate(10 30 25)">
      A
    </text>
  </>
);


ICONS.memory = (
  <>
    <rect x={6} y={10} width={16} height={22} rx={3} fill="#ff3ea5" />
    <text x={14} y={26} textAnchor="middle" fontSize={12} fontWeight={800} fill="#fff" fontFamily="sans-serif">?</text>
    <rect x={26} y={14} width={16} height={22} rx={3} fill="#fbf8ff" stroke="#ffd95e" strokeWidth={1.5} />
    <text x={34} y={30} textAnchor="middle" fontSize={14} fontWeight={800} fill="#1b1530" fontFamily="sans-serif">*</text>
  </>
);

export default function GameIcon({ slug }: { slug: string }) {
  return (
    <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden="true">
      {ICONS[slug]}
    </svg>
  );
}
