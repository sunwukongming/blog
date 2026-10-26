"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n/LangProvider";
import { UI } from "@/lib/messages";
import type { Heading } from "@/lib/toc";

const useArticleT = () => useT(UI).article;

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
  const t = useArticleT();
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
    <nav ref={root} className="toc toc--collapsible" aria-label={t.toc} data-ui>
      <details open>
        <summary className="toc__title">{t.tocTitle(headings.length)}</summary>
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
  const t = useArticleT();
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const article = articleOf(marker.current);
    if (!article) return;
    const timers: number[] = [];
    const buttons = [...article.querySelectorAll("pre")].map((pre) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-code";
      btn.textContent = t.copy;
      btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(pre.innerText);
          btn.textContent = t.copied;
        } catch {
          btn.textContent = t.copyFailed;
        }
        timers.push(window.setTimeout(() => (btn.textContent = t.copy), 1500));
      };
      (pre.parentElement ?? pre).append(btn);
      return btn;
    });
    return () => {
      timers.forEach(clearTimeout);
      buttons.forEach((b) => b.remove());
    };
  }, [t]);
  return <span ref={marker} hidden />;
}

/** 文章页：复制当前篇链接（不含 hash） */
export function CopyLink() {
  const t = useArticleT();
  const [label, setLabel] = useState<"copyLink" | "copied" | "copyFailed">("copyLink");
  return (
    <button
      type="button"
      className="copy-link"
      data-ui
      onClick={async () => {
        const url = typeof location !== "undefined" ? location.href.replace(/#.*$/, "") : "";
        try {
          await navigator.clipboard.writeText(url);
          setLabel("copied");
        } catch {
          setLabel("copyFailed");
        }
        window.setTimeout(() => setLabel("copyLink"), 1500);
      }}
    >
      {t[label]}
    </button>
  );
}

/** 分享当前文章到 X（Twitter intent） */
export function ShareX({ title }: { title: string }) {
  const t = useArticleT();
  return (
    <button
      type="button"
      className="share-x"
      data-ui
      onClick={() => {
        const url = typeof location !== "undefined" ? location.href.replace(/#.*$/, "") : "";
        const intent = new URL("https://twitter.com/intent/tweet");
        intent.searchParams.set("text", title);
        intent.searchParams.set("url", url);
        window.open(intent.toString(), "_blank", "noopener,noreferrer");
      }}
    >
      {t.shareX}
    </button>
  );
}

/** 相关推荐旁的阅读进度点（按正文滚动比例点亮） */
export function ReadingDots({ count = 5 }: { count?: number }) {
  const t = useArticleT();
  const root = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(0);
  useEffect(() => {
    const el = root.current;
    const article = articleOf(el);
    if (!el || !article) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = article.getBoundingClientRect();
      const total = r.height - innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : r.top < innerHeight ? 1 : 0;
      setLit(Math.round(p * (count - 1)));
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
  }, [count]);
  return (
    <div ref={root} className="reading-dots" aria-hidden="true" title={t.progress}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="reading-dots__dot" data-on={i <= lit || undefined} />
      ))}
    </div>
  );
}
