import type { Messages } from "@/lib/i18n";

const zh = {
  levelAria: (n: number, name: string, locked: boolean) => `第 ${n} 关 ${name}${locked ? "，未解锁" : ""}`,
};

export const LEVEL_SELECT_MESSAGES: Messages<typeof zh> = {
  zh,
  en: {
    levelAria: (n, name, locked) => `Level ${n}: ${name}${locked ? " (locked)" : ""}`,
  },
  ja: {
    levelAria: (n, name, locked) => `ステージ ${n} ${name}${locked ? "（ロック中）" : ""}`,
  },
};
