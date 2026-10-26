import type { UIMessages } from "./messages";

/** 主导航：路径不带语言前缀，文字在 UI.nav 里 */
export const NAV_LINKS: { path: string; key: Exclude<keyof UIMessages["nav"], "label" | "language"> }[] = [
  { path: "/blog", key: "blog" },
  { path: "/categories", key: "categories" },
  { path: "/games", key: "games" },
  { path: "/archive", key: "archive" },
];
