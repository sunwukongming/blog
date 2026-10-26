"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { splitLocale } from "@/lib/i18n";
import { WORLD_BG, worldFor } from "@/lib/worlds";

/**
 * 把当前世界写到 <html data-world>，配色跟着切换；手机浏览器地址栏的颜色（theme-color）也跟着换。
 * Next 会把上一个路由隐藏保留在 DOM 里，所以客户端导航后不能只靠 main[data-world] 判断。
 */
export default function WorldTheme() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    const world = worldFor(splitLocale(pathname).path);
    document.documentElement.dataset.world = world;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", WORLD_BG[world]);
  }, [pathname]);
  return null;
}
