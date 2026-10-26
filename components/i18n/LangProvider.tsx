"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_LOCALE, splitLocale, type Locale, type Messages } from "@/lib/i18n";

const LangContext = createContext<Locale>(DEFAULT_LOCALE);

/** 根布局把当前语言传给所有客户端组件 */
export function LangProvider({ lang, children }: { lang: Locale; children: ReactNode }) {
  return <LangContext value={lang}>{children}</LangContext>;
}

export const useLang = () => useContext(LangContext);

/** 取当前语言的那一份翻译：const t = useT(MESSAGES) */
export function useT<T>(messages: Messages<T>): T {
  return messages[useContext(LangContext)];
}

/** 去掉语言前缀后的路径，用来判断当前在哪个页面：/en/blog/x → "/blog/x" */
export function usePagePath() {
  return splitLocale(usePathname()).path;
}
