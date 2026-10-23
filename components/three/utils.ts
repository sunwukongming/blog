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
 * 宽屏时把画面整体右移，给左侧正文留出位置；
 * 窄屏时可选地整体下移（down 是视口高度的比例），给上方正文留出位置
 */
export function useViewShift(
  camera: RefObject<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>,
  fraction: number,
  down = 0,
) {
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    const cam = camera.current;
    if (!cam) return;
    const wide = size.width >= 960;
    const dx = wide ? size.width * fraction : 0;
    const dy = wide ? 0 : size.height * down;
    if (dx || dy) cam.setViewOffset(size.width, size.height, -dx, -dy, size.width, size.height);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }, [camera, size, fraction, down]);
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
