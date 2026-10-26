"use client";

import Link from "next/link";
import { useLang, usePagePath } from "@/components/i18n/LangProvider";
import { localePath } from "@/lib/i18n";
import { UI } from "@/lib/messages";
import { NAV_LINKS } from "@/lib/nav";

/** 带当前页面高亮的导航链接；预渲染时由 SiteNav 先输出不带高亮的版本 */
export default function NavLinks() {
  const lang = useLang();
  const path = usePagePath();
  return NAV_LINKS.map((l) => (
    <Link key={l.path} href={localePath(lang, l.path)} aria-current={path.startsWith(l.path) ? "page" : undefined}>
      {UI[lang].nav[l.key]}
    </Link>
  ));
}
