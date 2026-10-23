"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { getCategory } from "@/lib/categories";
import type { PostMeta } from "@/lib/posts";
import { isFromUI, useWorldClock, type Navigate } from "../utils";

const BG = "#dde2ea";
const CJK = '"PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",sans-serif';
// 卡片上分类色条用的深色版本，浅底上更清楚
const TAG_INK: Record<string, string> = {
  frontend: "#3550d6",
  graphics: "#d0503a",
  essays: "#2f8f6b",
  tools: "#b07d12",
  reading: "#7b4fb0",
};

function cardTexture(post: PostMeta) {
  const c = document.createElement("canvas");
  c.width = 360;
  c.height = 480;
  const x = c.getContext("2d")!;
  x.fillStyle = "#fbfcfd";
  x.fillRect(0, 0, 360, 480);
  x.fillStyle = TAG_INK[post.category] ?? "#1b2a44";
  x.fillRect(28, 30, 8, 26);
  x.font = `600 20px ${CJK}`;
  x.fillText(getCategory(post.category)?.name ?? post.category, 46, 51);
  x.fillStyle = "#1b2a44";
  x.font = `700 36px ${CJK}`;
  let line = "";
  let y = 120;
  for (const ch of post.title) {
    if (x.measureText(line + ch).width > 300) {
      x.fillText(line, 28, y);
      line = ch;
      y += 48;
    } else line += ch;
  }
  x.fillText(line, 28, y);
  x.fillStyle = "#d5dbe4";
  for (let i = 0; i < 5; i++) x.fillRect(28, y + 50 + i * 26, i === 4 ? 160 : 300, 10);
  x.fillStyle = "#7a8597";
  x.font = "18px ui-monospace,Menlo,monospace";
  x.fillText(post.date.replaceAll("-", "."), 28, 448);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** F 卡片环：文章列表页。每篇文章是一张卡片，悬停浮起，点击进入 */
export default function Ring({ posts, navigate }: { posts: PostMeta[]; navigate: Navigate }) {
  const t = useWorldClock();
  const ring = useRef<THREE.Group>(null);
  const cards = useRef<(THREE.Group | null)[]>([]);
  const lift = useRef<number[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  useCursor(hovered !== null);

  const shown = useMemo(() => posts.slice(0, 24), [posts]);
  const R = Math.max(2.8, shown.length * 0.48);
  const textures = useMemo(() => shown.map(cardTexture), [shown]);
  useEffect(() => () => textures.forEach((x) => x.dispose()), [textures]);

  useFrame((state) => {
    const time = t.current;
    const g = ring.current;
    if (g) {
      g.rotation.y = time * 0.12 + state.pointer.x * 0.9;
      g.rotation.x += (state.pointer.y * 0.08 - g.rotation.x) * 0.05;
    }
    cards.current.forEach((c, i) => {
      if (!c) return;
      const l = (lift.current[i] ?? 0) + ((hovered === i ? 1 : 0) - (lift.current[i] ?? 0)) * 0.12;
      lift.current[i] = l;
      c.position.y = Math.sin(time * 0.8 + i * 1.7) * 0.08 + l * 0.35;
      c.scale.setScalar(1 + l * 0.08);
    });
  });

  return (
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, R + 5.5, R + 12]} />
      <PerspectiveCamera
        makeDefault
        fov={45}
        near={0.1}
        far={100}
        position={[0, 1.6, R + 6]}
        onUpdate={(c) => c.lookAt(0, -0.2, 0)}
      />
      <group ref={ring}>
        {shown.map((p, i) => {
          const a = (i / shown.length) * Math.PI * 2;
          return (
            <group
              key={p.slug}
              ref={(el) => {
                cards.current[i] = el;
              }}
              position={[Math.sin(a) * R, 0, Math.cos(a) * R]}
              rotation-y={a}
            >
              <mesh
                onPointerOver={(e) => {
                  if (isFromUI(e)) return;
                  e.stopPropagation();
                  setHovered(i);
                }}
                onPointerOut={() => setHovered((h) => (h === i ? null : h))}
                onClick={(e) => {
                  if (isFromUI(e)) return;
                  e.stopPropagation();
                  navigate(`/blog/${p.slug}`);
                }}
              >
                <planeGeometry args={[1.5, 2]} />
                <meshBasicMaterial map={textures[i]} />
              </mesh>
              <mesh rotation-y={Math.PI}>
                <planeGeometry args={[1.5, 2]} />
                <meshBasicMaterial color="#c9d1dc" />
              </mesh>
            </group>
          );
        })}
      </group>
    </>
  );
}
