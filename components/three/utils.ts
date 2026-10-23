"use client";

import { createContext, useContext, useLayoutEffect, useRef, type RefObject } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import type * as THREE from "three";

export type Navigate = (href: string) => void;

/** drei <Html> 标签的挂载点。不指定的话会挂到 eventSource（body）上，撑出横向滚动条 */
export const LabelPortal = createContext<RefObject<HTMLDivElement | null> | undefined>(undefined);
export const useLabelPortal = () => useContext(LabelPortal) as RefObject<HTMLElement> | undefined;

const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 每个世界自己的时间轴；系统开启“减少动态效果”时时间静止，只保留鼠标交互 */
export function useWorldClock() {
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += Math.min(dt, 0.05) * (reduceMotion ? 0 : 1);
  });
  return t;
}

/**
 * 宽屏时把画面整体右移，给左侧正文留出位置。
 * 窄屏时如果给了 anchor（CSS 选择器），画面中心每帧对齐这个元素，跟着页面一起滚动，不会和正文叠在一起
 */
export function useViewShift(
  camera: RefObject<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>,
  fraction: number,
  anchor?: string,
) {
  const size = useThree((s) => s.size);
  const wide = size.width >= 960;
  const lastDy = useRef(NaN);
  useLayoutEffect(() => {
    const cam = camera.current;
    if (!cam) return;
    lastDy.current = NaN;
    const dx = wide ? size.width * fraction : 0;
    if (dx) cam.setViewOffset(size.width, size.height, -dx, 0, size.width, size.height);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }, [camera, size, fraction, wide]);
  useFrame(() => {
    const cam = camera.current;
    const el = !wide && anchor ? document.querySelector(anchor) : null;
    if (!cam || !el) return;
    const r = el.getBoundingClientRect();
    const dy = Math.round(r.top + r.height / 2 - size.height / 2);
    if (dy === lastDy.current) return;
    lastDy.current = dy;
    cam.setViewOffset(size.width, size.height, 0, -dy, size.width, size.height);
    cam.updateProjectionMatrix();
  });
}

/** Canvas 的事件源是 body，盖在上面的链接、按钮和正文面板不应触发 3D 交互 */
export function isFromUI(e: ThreeEvent<PointerEvent | MouseEvent>) {
  const el = e.nativeEvent.target as Element | null;
  return !!el?.closest?.("a, button, input, textarea, [data-ui]");
}

/** 可复现的伪随机数，保证每次渲染的书架和代码行一致 */
export function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
