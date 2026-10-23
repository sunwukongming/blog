"use client";

import { useEffect, useEffectEvent, useRef, useSyncExternalStore, type PointerEvent } from "react";

export type Dir = "up" | "down" | "left" | "right";

export const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

/** 监听整页的按键；onKey 返回 true 表示这个键被游戏用掉了，阻止页面滚动等默认行为 */
export function useKeys(onKey: (key: string) => boolean) {
  const handle = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as Element | null)?.closest?.("input, textarea, select, [contenteditable]")) return;
    if (onKey(e.key)) e.preventDefault();
  });
  useEffect(() => {
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
}

/** 在元素上滑动换方向；元素需要 touch-action: none，否则手机上会变成滚动页面 */
export function useSwipe(onSwipe: (dir: Dir) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}

// 最高分 / 最快用时存在 localStorage 里，只对当前浏览器有效
const PREFIX = "gm-lab:games:";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(key: string): number | null {
  try {
    const v = Number(localStorage.getItem(PREFIX + key) ?? NaN);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** better(新, 旧) 为 true 时才覆盖记录；submit 返回是否破了纪录 */
export function useRecord(key: string, better: (next: number, prev: number) => boolean) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const submit = (next: number) => {
    const prev = read(key);
    if (prev !== null && !better(next, prev)) return false;
    try {
      localStorage.setItem(PREFIX + key, String(next));
    } catch {
      return false;
    }
    listeners.forEach((l) => l());
    return true;
  };
  return [value, submit] as const;
}
