"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
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
      <Canvas flat dpr={[1, 1.5]} eventSource={document.body} eventPrefix="client" fallback={null}>
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
