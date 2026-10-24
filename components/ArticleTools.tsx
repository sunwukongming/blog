"use client";

import { useEffect, useRef, useState } from "react";
import type { Heading } from "@/lib/toc";

// Next 会把上一个路由隐藏着留在 DOM 里，所以都从自己所在的 <main> 往下找，不用 document.querySelector
const articleOf = (el: Element | null) => el?.closest("main")?.querySelector<HTMLElement>(".article") ?? null;

/** 顶部的阅读进度条 */
export function ReadingProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current;
    const article = articleOf(el);
    if (!el || !article) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = article.getBoundingClientRect();
      const total = r.height - innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : r.top < innerHeight ? 1 : 0;
      el.style.transform = `scaleX(${p})`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    schedule();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
    };
  }, []);
  return (
    <div className="reading-progress" aria-hidden="true">
      <div ref={bar} />
    </div>
  );
}

/** 文章目录：窄屏在正文上方，宽屏固定在正文右侧并高亮当前小节 */
export function Toc({ headings }: { headings: Heading[] }) {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(headings[0]?.id);
  useEffect(() => {
    const article = articleOf(root.current);
    if (!article) return;
    const targets = headings.flatMap((h) => article.querySelector<HTMLElement>(`[id="${CSS.escape(h.id)}"]`) ?? []);
    let raf = 0;
    const update = () => {
      raf = 0;
      // 滚到底时最后几节到不了判定线，保留点击目录时设置的高亮
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) return;
      let current = headings[0]?.id;
      for (const el of targets) if (el.getBoundingClientRect().top < 140) current = el.id;
      setActive(current);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    schedule();
    addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", schedule);
    };
  }, [headings]);

  return (
    <nav ref={root} className="toc toc--collapsible" aria-label="目录" data-ui>
      <details open>
        <summary className="toc__title">目录 · {headings.length} 节</summary>
        <ol>
          {headings.map((h) => (
            <li key={h.id} data-depth={h.depth}>
              <a
                href={`#${h.id}`}
                aria-current={active === h.id ? "location" : undefined}
                onClick={() => setActive(h.id)}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ol>
      </details>
    </nav>
  );
}

/** 给正文里的代码块加「复制」按钮 */
export function CodeCopy() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const article = articleOf(marker.current);
    if (!article) return;
    const timers: number[] = [];
    const buttons = [...article.querySelectorAll("pre")].map((pre) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-code";
      btn.textContent = "复制";
      btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(pre.innerText);
          btn.textContent = "已复制";
        } catch {
          btn.textContent = "复制失败";
        }
        timers.push(window.setTimeout(() => (btn.textContent = "复制"), 1500));
      };
      (pre.parentElement ?? pre).append(btn);
      return btn;
    });
    return () => {
      timers.forEach(clearTimeout);
      buttons.forEach((b) => b.remove());
    };
  }, []);
  return <span ref={marker} hidden />;
}

/** 文章页：复制当前篇链接（不含 hash） */
export function CopyLink() {
  const [label, setLabel] = useState("复制链接");
  return (
    <button
      type="button"
      className="copy-link"
      data-ui
      onClick={async () => {
        const url = typeof location !== "undefined" ? location.href.replace(/#.*$/, "") : "";
        try {
          await navigator.clipboard.writeText(url);
          setLabel("已复制");
        } catch {
          setLabel("复制失败");
        }
        window.setTimeout(() => setLabel("复制链接"), 1500);
      }}
    >
      {label}
    </button>
  );
}
