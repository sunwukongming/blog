// 站点支持的语言。网址都带语言前缀：/zh、/en、/ja；中文是原文语言
export const LOCALES = ["zh", "en", "ja"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh";

/** 记住访客手动选过的语言，访问根路径时优先用它 */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const hasLocale = (s: string | undefined | null): s is Locale =>
  !!s && (LOCALES as readonly string[]).includes(s);

/** <html lang>、JSON-LD inLanguage、hreflang 用的语言标签 */
export const HTML_LANG: Record<Locale, string> = { zh: "zh-CN", en: "en", ja: "ja" };
export const OG_LOCALE: Record<Locale, string> = { zh: "zh_CN", en: "en_US", ja: "ja_JP" };
/** 语言切换器里显示的名字，用各自的语言写 */
export const LANG_NAME: Record<Locale, string> = { zh: "中文", en: "English", ja: "日本語" };
/** 窄屏上的简称 */
export const LANG_SHORT: Record<Locale, string> = { zh: "中", en: "EN", ja: "日" };

/** 给站内路径加语言前缀：localePath("en", "/blog") → "/en/blog"，localePath("en", "/") → "/en" */
export function localePath(lang: Locale, path: string) {
  return path === "/" || path === "" ? `/${lang}` : `/${lang}${path}`;
}

/** 拆出路径里的语言前缀：/en/blog/x → { lang: "en", path: "/blog/x" }；没有前缀时 lang 为 null */
export function splitLocale(pathname: string): { lang: Locale | null; path: string } {
  const seg = pathname.split("/")[1];
  if (!hasLocale(seg)) return { lang: null, path: pathname || "/" };
  return { lang: seg, path: pathname.slice(seg.length + 1) || "/" };
}

/** 每种语言一份的翻译表；用 satisfies 让三种语言的结构保持一致 */
export type Messages<T> = Record<Locale, T>;
