"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { worldFor } from "@/lib/worlds";

/**
 * 把当前世界写到 <html data-world>，配色跟着切换。
 * Next 会把上一个路由隐藏保留在 DOM 里，所以客户端导航后不能只靠 main[data-world] 判断。
 */
export default function WorldTheme() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    document.documentElement.dataset.world = worldFor(pathname);
  }, [pathname]);
  return null;
}
