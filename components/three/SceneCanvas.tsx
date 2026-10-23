"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import type { PostMeta } from "@/lib/posts";
import { WORLD_BG, focusedCategory, worldFor } from "@/lib/worlds";
import Room from "./worlds/Room";
import Orbit from "./worlds/Orbit";
import Ring from "./worlds/Ring";
import Field from "./worlds/Field";
import Drive from "./worlds/Drive";
import { LabelPortal } from "./utils";

const FADE_MS = 260;

export default function SceneCanvas({ posts }: { posts: PostMeta[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const target = worldFor(pathname);
  const [world, setWorld] = useState(target);
  const labels = useRef<HTMLDivElement>(null);
  const [maxDpr, setMaxDpr] = useState(1.5);
  const [roomHidden, setRoomHidden] = useState(false);

  // 手机上书房跟着页面里的 .room-stage 滚动，滚出屏幕后就不用再渲染（宽屏时它是 display: none）
  useEffect(() => {
    if (world !== "room") return;
    const el = document.querySelector(".room-stage");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setRoomHidden(!e.isIntersecting && e.target.clientHeight > 0), {
      rootMargin: "80px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [world]);

  // 玩游戏时背景只画一帧静态画面；书房不可见时也暂停。"demand" 模式下场景变化时 R3F 仍会自动重画
  const still = pathname.startsWith("/games/") || (world === "room" && roomHidden);

  // 换到另一个世界时：先用目标世界的底色盖住画面，再切换场景并淡出
  useEffect(() => {
    if (target === world) return;
    const id = setTimeout(() => setWorld(target), FADE_MS);
    return () => clearTimeout(id);
  }, [target, world]);
  const covered = target !== world;

  const navigate = (href: string) => router.push(href);

  return (
    <div className="scene-root" aria-hidden="true">
      <Canvas
        flat
        dpr={[1, maxDpr]}
        frameloop={still ? "demand" : "always"}
        eventSource={document.body}
        eventPrefix="client"
        fallback={null}
      >
        {/* 帧率持续偏低时把像素比降到 1 */}
        <PerformanceMonitor onDecline={() => setMaxDpr(1)} />
        <LabelPortal value={labels}>
          {world === "room" && <Room navigate={navigate} />}
          {world === "orbit" && <Orbit posts={posts} focus={focusedCategory(pathname)} navigate={navigate} />}
          {world === "ring" && <Ring posts={posts} navigate={navigate} />}
          {world === "field" && <Field />}
          {world === "drive" && <Drive />}
        </LabelPortal>
      </Canvas>
      <div ref={labels} className="scene-labels" />
      <div
        className="scene-cover"
        style={{ background: WORLD_BG[target], opacity: covered ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
      />
    </div>
  );
}
