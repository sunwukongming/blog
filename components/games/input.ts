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

/**
 * 监听整页的按键；onKey 返回 true 表示这个键被游戏用掉了，阻止页面滚动等默认行为。
 * repeat 为 true 表示按住不放产生的重复事件，暂停、旋转、直接落下这类操作应该忽略它
 */
export function useKeys(onKey: (key: string, repeat: boolean) => boolean) {
  const handle = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as Element | null)?.closest?.("input, textarea, select, [contenteditable]")) return;
    if (onKey(e.key, e.repeat)) e.preventDefault();
  });
  useEffect(() => {
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
}

const dirOf = (dx: number, dy: number): Dir =>
  Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";

/**
 * 在元素上滑动换方向；元素需要 touch-action: none，否则手机上会变成滚动页面。
 * continuous：手指滑过一小段就立即触发，不用抬起，一次拖动里可以连续拐弯（贪吃蛇用）；
 * 否则一次滑动只在抬起时触发一次（2048 用）
 */
export function useSwipe(onSwipe: (dir: Dir) => void, { continuous = false } = {}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY };
      // 连续模式下捕获指针，手指滑出棋盘也能继续转向；按在按钮上时不捕获，否则按钮收不到 click
      if (continuous && !(e.target as Element).closest("button")) e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current;
      if (!continuous || !s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      onSwipe(dirOf(dx, dy));
      start.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || continuous) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      onSwipe(dirOf(dx, dy));
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}

/** 手机上轻震一下；不支持的设备（包括 iOS Safari）直接忽略 */
export function buzz(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
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

type Better = (next: number, prev: number) => boolean;
export const higher: Better = (next, prev) => next > prev;
export const lower: Better = (next, prev) => next < prev;

/** better(新, 旧) 为 true 时才覆盖记录；返回是否破了纪录 */
export function saveRecord(key: string, next: number, better: Better) {
  const prev = read(key);
  if (prev !== null && !better(next, prev)) return false;
  try {
    localStorage.setItem(PREFIX + key, String(next));
  } catch {
    return false;
  }
  listeners.forEach((l) => l());
  return true;
}

export function useRecord(key: string, better: Better) {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  return [value, (next: number) => saveRecord(key, next, better)] as const;
}

/** 一次读多条记录（比如每一关的最快用时）；快照拼成字符串，保证引用稳定 */
export function useRecordList(keys: string[]) {
  const snap = useSyncExternalStore(
    subscribe,
    () => keys.map((k) => read(k) ?? "").join(","),
    () => "",
  );
  const values = snap.split(",");
  return keys.map((_, i) => (values[i] ? Number(values[i]) : null));
}
