"use client";

import Link from "next/link";
import { useLang, usePagePath } from "@/components/i18n/LangProvider";
import { LANG_NAME, LANG_SHORT, LOCALE_COOKIE, LOCALES, localePath, type Locale } from "@/lib/i18n";

/** 记住手动选过的语言，proxy 在访客打开根路径时读取 */
function remember(l: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
}

/** 切到同一页面的其他语言版本，并记住选择：下次访问根路径时直接进这个语言 */
export default function LangSwitcher() {
  const lang = useLang();
  const path = usePagePath();
  return LOCALES.map((l) => (
    <Link
      key={l}
      href={localePath(l, path)}
      hrefLang={l}
      lang={l}
      aria-current={l === lang ? "true" : undefined}
      aria-label={LANG_NAME[l]}
      onClick={() => remember(l)}
    >
      <span className="lang-switch__long">{LANG_NAME[l]}</span>
      <span className="lang-switch__short" aria-hidden="true">
        {LANG_SHORT[l]}
      </span>
    </Link>
  ));
}
