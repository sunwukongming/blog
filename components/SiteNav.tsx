import { Suspense } from "react";
import Link from "next/link";
import LangSwitcher from "@/components/i18n/LangSwitcher";
import NavLinks from "@/components/NavLinks";
import { LANG_NAME, LANG_SHORT, LOCALES, localePath } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { UI } from "@/lib/messages";
import { NAV_LINKS } from "@/lib/nav";
import { getSite } from "@/lib/site";

export default async function SiteNav() {
  const lang = await getLang();
  const t = UI[lang].nav;
  const plain = NAV_LINKS.map((l) => (
    <Link key={l.path} href={localePath(lang, l.path)}>
      {t[l.key]}
    </Link>
  ));
  // 预渲染时还不知道当前路径，先让语言链接指向各语言首页
  const plainLangs = LOCALES.map((l) => (
    <a
      key={l}
      href={localePath(l, "/")}
      hrefLang={l}
      lang={l}
      aria-label={LANG_NAME[l]}
      aria-current={l === lang ? "true" : undefined}
    >
      <span className="lang-switch__long">{LANG_NAME[l]}</span>
      <span className="lang-switch__short" aria-hidden="true">
        {LANG_SHORT[l]}
      </span>
    </a>
  ));
  return (
    <header className="site-nav">
      <Link href={localePath(lang, "/")} className="site-nav__name">
        {getSite(lang).name}
      </Link>
      <div className="site-nav__end">
        <nav aria-label={t.label}>
          <Suspense fallback={plain}>
            <NavLinks />
          </Suspense>
        </nav>
        <nav className="lang-switch" aria-label={t.language}>
          <Suspense fallback={plainLangs}>
            <LangSwitcher />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
