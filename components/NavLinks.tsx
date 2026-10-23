"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/nav";

/** 带当前页面高亮的导航链接；预渲染时由 SiteNav 先输出不带高亮的版本 */
export default function NavLinks() {
  const pathname = usePathname();
  return NAV_LINKS.map((l) => (
    <Link key={l.href} href={l.href} aria-current={pathname.startsWith(l.href) ? "page" : undefined}>
      {l.label}
    </Link>
  ));
}
