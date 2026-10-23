import type { ReactNode } from "react";

export type LevelCard = { name: string; best?: string };

const LockIcon = () => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
    <rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.6" fill="none" />
  </svg>
);

/** 选关界面：已解锁的关卡可以点，后面的上锁；unlocked 是已解锁的关数 */
export default function LevelSelect({
  title,
  levels,
  unlocked,
  onPick,
  children,
}: {
  title: string;
  levels: LevelCard[];
  unlocked: number;
  onPick: (index: number) => void;
  children?: ReactNode;
}) {
  return (
    <div className="levels">
      <strong>{title}</strong>
      <ol className="levels__grid">
        {levels.map((l, i) => {
          const locked = i >= unlocked;
          return (
            <li key={l.name}>
              <button
                type="button"
                className="level"
                disabled={locked}
                onClick={() => onPick(i)}
                aria-label={`第 ${i + 1} 关 ${l.name}${locked ? "，未解锁" : ""}`}
              >
                <span className="level__n">{locked ? <LockIcon /> : i + 1}</span>
                <span className="level__name">{l.name}</span>
                {l.best && <span className="level__best">{l.best}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {children}
    </div>
  );
}
