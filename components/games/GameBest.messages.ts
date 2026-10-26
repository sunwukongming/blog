import type { Messages } from "@/lib/i18n";

const zh = {
  never: "还没玩过",
  minesEasy: (s: number) => `初级 ${s}s`,
  minesMedium: (s: number) => `中级 ${s}s`,
  memoryEasy: (n: number) => `简单 ${n}`,
  memoryNormal: (n: number) => `普通 ${n}`,
  memoryHard: (n: number) => `困难 ${n}`,
  /** parts 已经用 " / " 连好 */
  memoryFewest: (parts: string) => `最少 ${parts} 步`,
  stage: (v: number) => `闯到第 ${v} 关`,
  score: (v: number) => `最高 ${v} 分`,
  chips: (v: number) => `最多 ${v} 筹码`,
};

export const GAME_BEST_MESSAGES: Messages<typeof zh> = {
  zh,
  en: {
    never: "Not played yet",
    minesEasy: (s) => `Beginner ${s}s`,
    minesMedium: (s) => `Intermediate ${s}s`,
    memoryEasy: (n) => `Easy ${n}`,
    memoryNormal: (n) => `Normal ${n}`,
    memoryHard: (n) => `Hard ${n}`,
    memoryFewest: (parts) => `Fewest moves ${parts}`,
    stage: (v) => `Reached level ${v}`,
    score: (v) => `Best ${v}`,
    chips: (v) => `Most chips ${v}`,
  },
  ja: {
    never: "未プレイ",
    minesEasy: (s) => `初級 ${s}秒`,
    minesMedium: (s) => `中級 ${s}秒`,
    memoryEasy: (n) => `かんたん ${n}`,
    memoryNormal: (n) => `ふつう ${n}`,
    memoryHard: (n) => `むずかしい ${n}`,
    memoryFewest: (parts) => `最少 ${parts} 手`,
    stage: (v) => `ステージ ${v} 到達`,
    score: (v) => `ベスト ${v} 点`,
    chips: (v) => `最多 ${v} チップ`,
  },
};
