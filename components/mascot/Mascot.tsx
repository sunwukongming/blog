"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  COMEBACK,
  COPY,
  greeting,
  HIDE,
  IDLE,
  MASCOT_EVENT,
  MASCOT_NAME,
  pageLines,
  pick,
  POKES,
  SHOW,
  type Line,
  type Mood,
} from "@/lib/mascot";

const HIDDEN_KEY = "gm-lab:mascot-hidden";
const SAY_MS = 5200;
const IDLE_MS = 45_000;

const MOUTH: Record<Mood, React.ReactNode> = {
  normal: <path d="M56 88 Q60 90 64 88" />,
  smile: <path d="M54 86.5 Q60 92.5 66 86.5" />,
  pout: <path d="M56 89.5 Q60 86.5 64 89.5" />,
  smug: <path d="M55 88 Q61 91 66 86.5" />,
  sleepy: <path d="M57 88.5 Q60 89.5 63 88.5" />,
  surprised: <ellipse cx="60" cy="88.5" rx="2.6" ry="3.2" fill="#c2416b" stroke="none" />,
  // 赌狂：咧嘴大笑
  crazy: <path d="M51 85 Q60 97 69 85 Q60 89 51 85 Z" fill="#7a0f24" stroke="#7a0f24" strokeWidth="1" />,
};

// 眉毛：生气时往中间压，惊讶时抬高
const BROWS: Record<Mood, [string, string]> = {
  normal: ["M40 60 Q46 57.5 52 59.5", "M68 59.5 Q74 57.5 80 60"],
  smile: ["M40 60 Q46 57 52 59", "M68 59 Q74 57 80 60"],
  pout: ["M40 58.5 L52 62", "M80 58.5 L68 62"],
  smug: ["M40 61 Q46 59.5 52 60", "M68 58 Q74 56 80 58.5"],
  sleepy: ["M40 61 Q46 60 52 61", "M68 61 Q74 60 80 61"],
  surprised: ["M40 56.5 Q46 53.5 52 56", "M68 56 Q74 53.5 80 56.5"],
  crazy: ["M40 57 Q46 55 52 58.5", "M68 58.5 Q74 55 80 57"],
};

/**
 * Q 版的“梦子风格”女孩（同人，SVG 画的）：黑色齐刘海长直发、红眼睛、红色制服。
 * 眼珠的位置由外面直接改 transform，不触发 React 重渲染
 */
function Girl({ mood, irisL, irisR }: { mood: Mood; irisL: React.Ref<SVGGElement>; irisR: React.Ref<SVGGElement> }) {
  const crazy = mood === "crazy";
  const eye = (cx: number, ref: React.Ref<SVGGElement>) => (
    <g className="mascot__eye" data-sleepy={mood === "sleepy" || undefined}>
      <ellipse cx={cx} cy="73" rx="7.4" ry="8.8" fill="#fff" />
      <g ref={ref} className="mascot__iris">
        <ellipse cx={cx} cy="73.6" rx="5.6" ry="7" fill={crazy ? "url(#mascot-iris-crazy)" : "url(#mascot-iris)"} />
        {/* 赌狂时瞳孔收成一条细缝 */}
        <ellipse cx={cx} cy="74" rx={crazy ? 1 : 2.4} ry={crazy ? 4 : 3.1} fill="#22050c" />
        <circle cx={cx - 1.8} cy="70.4" r="1.7" fill="#fff" />
        <circle cx={cx + 2} cy="76.8" r="0.9" fill="#fff" opacity="0.8" />
      </g>
      <path
        d={`M${cx - 8.4} 67.2 Q${cx} 61.6 ${cx + 8.4} 67.2`}
        stroke="#120c10"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
  return (
    <svg viewBox="0 0 120 150" className="mascot__svg" aria-hidden="true">
      <defs>
        <linearGradient id="mascot-hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2230" />
          <stop offset="1" stopColor="#0f0b12" />
        </linearGradient>
        <linearGradient id="mascot-iris" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a0618" />
          <stop offset="1" stopColor="#e8283f" />
        </linearGradient>
        <radialGradient id="mascot-iris-crazy" cx="0.5" cy="0.55" r="0.6">
          <stop offset="0" stopColor="#ffd0d6" />
          <stop offset="0.45" stopColor="#ff2a4a" />
          <stop offset="1" stopColor="#8a0016" />
        </radialGradient>
      </defs>
      {/* 后面一直垂到腰的黑长直 */}
      <path d="M19 60 C15 22 105 22 101 60 L107 150 L13 150 Z" fill="url(#mascot-hair)" />
      {/* 身体：红色制服外套、白衬衫、黑领结 */}
      <rect x="53" y="94" width="14" height="16" rx="5" fill="#f3cbbd" />
      <path d="M27 121 C32 105 88 105 93 121 L99 150 L21 150 Z" fill="#b5132f" />
      <path d="M50 106 L60 128 L70 106 L74 108 L60 150 L46 108 Z" fill="#f7f3f6" />
      <path d="M44 107 L60 140 L49 150 L36 116 Z M76 107 L60 140 L71 150 L84 116 Z" fill="#7d0b20" />
      <path d="M55 112 L60 117 L65 112 L64 120 L60 118 L56 120 Z" fill="#1a1014" />
      {/* 脸 */}
      <ellipse cx="60" cy="69" rx="31" ry="30" fill="#fff0e8" />
      {eye(46, irisL)}
      {eye(74, irisR)}
      <g stroke="#2a1a22" strokeWidth="1.7" fill="none" strokeLinecap="round">
        <path d={BROWS[mood][0]} />
        <path d={BROWS[mood][1]} />
      </g>
      <ellipse cx="38" cy="83" rx="5.4" ry="2.8" fill="#ff7a9a" opacity={crazy ? 0.95 : mood === "smile" ? 0.6 : 0.4} />
      <ellipse cx="82" cy="83" rx="5.4" ry="2.8" fill="#ff7a9a" opacity={crazy ? 0.95 : mood === "smile" ? 0.6 : 0.4} />
      {crazy && (
        <g stroke="#ff5c7a" strokeWidth="1" opacity="0.8">
          <path d="M34 81 l2 4 M37 81 l2 4 M40 81 l2 4 M80 81 l2 4 M83 81 l2 4 M86 81 l2 4" />
        </g>
      )}
      <g stroke="#a3233f" strokeWidth="1.8" fill="none" strokeLinecap="round">
        {MOUTH[mood]}
      </g>
      {/* 公主切：额前一排齐刘海，两侧垂到下巴的鬓发 */}
      <path d="M27 70 C24 38 40 25 60 25 C80 25 96 38 93 70 L92 56 L28 56 Z" fill="url(#mascot-hair)" />
      <path d="M28 54 L92 54 L92 60 L28 60 Z" fill="url(#mascot-hair)" />
      <path d="M26 56 L33 56 L34 98 L25 98 Z M94 56 L87 56 L86 98 L95 98 Z" fill="url(#mascot-hair)" />
      <path
        d="M40 33 Q50 28 62 29"
        stroke="#5a4a66"
        strokeWidth="1.6"
        fill="none"
        opacity="0.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Mascot() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDDEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [line, setLine] = useState<Line | null>(null);
  const [mood, setMood] = useState<Mood>("normal");
  const irisL = useRef<SVGGElement>(null);
  const irisR = useRef<SVGGElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const lastActive = useRef(0);
  const pokes = useRef(0);
  const firstPath = useRef<string | null>(null);

  const say = (l: Line, ms = SAY_MS) => {
    setLine(l);
    setMood(l.mood);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setLine(null);
      setMood((m) => (m === "sleepy" ? m : "normal"));
    }, ms);
  };
  const sayRef = useRef(say);
  useEffect(() => {
    sayRef.current = say;
  });
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  // 其他组件（比如德州扑克）通过事件让她说话
  useEffect(() => {
    const onSay = (e: Event) => sayRef.current((e as CustomEvent<Line>).detail);
    window.addEventListener(MASCOT_EVENT, onSay);
    return () => window.removeEventListener(MASCOT_EVENT, onSay);
  }, []);

  // 第一次出现按时间打招呼；之后每换一个页面说一句和页面有关的
  useEffect(() => {
    if (hidden) return;
    const first = firstPath.current === null;
    firstPath.current = pathname;
    const id = window.setTimeout(
      () => sayRef.current(first ? pick(greeting(new Date().getHours())) : pick(pageLines(pathname))),
      first ? 1200 : 700,
    );
    return () => window.clearTimeout(id);
  }, [pathname, hidden]);

  // 眼睛跟着鼠标；发呆太久、复制文字、切回标签页时吐槽一句
  useEffect(() => {
    if (hidden) return;
    lastActive.current = Date.now();
    let raf = 0;
    let hiddenAt = 0;
    const look = (e: PointerEvent) => {
      lastActive.current = Date.now();
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const box = root.current?.getBoundingClientRect();
        if (!box) return;
        // 脸大约在小人宽度的一半、高度的 45% 处
        const dx = e.clientX - (box.left + box.width / 2);
        const dy = e.clientY - (box.top + box.height * 0.45);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 300);
        const t = `translate(${((dx / d) * 2.2 * k).toFixed(2)} ${((dy / d) * 2.2 * k).toFixed(2)})`;
        irisL.current?.setAttribute("transform", t);
        irisR.current?.setAttribute("transform", t);
      });
    };
    const active = () => (lastActive.current = Date.now());
    const idle = window.setInterval(() => {
      if (Date.now() - lastActive.current > IDLE_MS && !document.hidden) {
        lastActive.current = Date.now();
        sayRef.current(pick(IDLE));
      }
    }, 5000);
    const copy = () => sayRef.current(pick(COPY));
    const vis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30_000) sayRef.current(pick(COMEBACK));
    };
    window.addEventListener("pointermove", look, { passive: true });
    window.addEventListener("keydown", active);
    window.addEventListener("scroll", active, { passive: true });
    document.addEventListener("copy", copy);
    document.addEventListener("visibilitychange", vis);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(idle);
      window.removeEventListener("pointermove", look);
      window.removeEventListener("keydown", active);
      window.removeEventListener("scroll", active);
      document.removeEventListener("copy", copy);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [hidden]);

  const toggle = (next: boolean) => {
    try {
      localStorage.setItem(HIDDEN_KEY, next ? "1" : "0");
    } catch {}
    if (next) {
      say(pick(HIDE), 1200);
      window.setTimeout(() => setHidden(true), 900);
    } else {
      setHidden(false);
      window.setTimeout(() => sayRef.current(pick(SHOW)), 300);
    }
  };

  const poke = () => {
    say(POKES[pokes.current % POKES.length]);
    pokes.current++;
  };

  if (hidden) {
    return (
      <button
        type="button"
        className="mascot-summon"
        data-ui
        onClick={() => toggle(false)}
        aria-label={`叫${MASCOT_NAME}出来`}
      >
        <Girl mood="smug" irisL={irisL} irisR={irisR} />
      </button>
    );
  }

  return (
    <div ref={root} className="mascot" data-ui data-mood={mood}>
      {line && (
        <p className="mascot__bubble" role="status" key={line.text}>
          {line.text}
        </p>
      )}
      <button type="button" className="mascot__close" onClick={() => toggle(true)} aria-label={`收起${MASCOT_NAME}`}>
        ×
      </button>
      <button type="button" className="mascot__body" onClick={poke} aria-label={`戳一下${MASCOT_NAME}`}>
        <Girl mood={mood} irisL={irisL} irisR={irisR} />
      </button>
    </div>
  );
}
