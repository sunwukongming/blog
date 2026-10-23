"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, PerspectiveCamera, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { CATEGORIES } from "@/lib/categories";
import type { PostMeta } from "@/lib/posts";
import { isFromUI, rng, useViewShift, useWorldClock, useLabelPortal, type Navigate } from "../utils";

const BG = "#04050c";
// 半径、行星大小、公转角速度；第 4 颗带光环
const ORBITS = [
  { r: 2.0, s: 0.26, w: 0.5 },
  { r: 3.0, s: 0.36, w: 0.34 },
  { r: 4.1, s: 0.3, w: 0.25 },
  { r: 5.2, s: 0.46, w: 0.18, ring: true },
  { r: 6.3, s: 0.25, w: 0.13 },
];
const OVERVIEW_POS = new THREE.Vector3(0, 5.5, 11.5);
const OVERVIEW_LOOK = new THREE.Vector3(0, -0.4, 0);

type Props = { posts: PostMeta[]; focus: string | null; navigate: Navigate };

/** B 轨道索引：分类是行星，文章是卫星。/categories/[slug] 时镜头飞到对应行星 */
export default function Orbit({ posts, focus, navigate }: Props) {
  const t = useWorldClock();
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const group = useRef<THREE.Group>(null);
  const planetRefs = useRef<(THREE.Group | null)[]>([]);
  const look = useRef(OVERVIEW_LOOK.clone());
  const focusIndex = CATEGORIES.findIndex((c) => c.slug === focus);
  useViewShift(cam, focusIndex >= 0 ? 0.2 : 0);
  // 竖屏时把总览镜头拉远，让最外圈轨道也能完整显示
  const aspect = useThree((s) => s.size.width / s.size.height);
  const overview = useMemo(
    () => OVERVIEW_POS.clone().multiplyScalar(aspect < 1 ? 1.6 / Math.max(aspect, 0.45) ** 0.5 : 1),
    [aspect],
  );

  const stars = useMemo(() => {
    const r = rng(7);
    const p = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      const u = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const R = 40 + r() * 20;
      const s = Math.sqrt(1 - u * u);
      p.set([Math.cos(a) * s * R, u * R, Math.sin(a) * s * R], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return geo;
  }, []);
  useEffect(() => () => stars.dispose(), [stars]);

  const glow = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,205,150,0.9)");
    g.addColorStop(0.35, "rgba(255,170,110,0.25)");
    g.addColorStop(1, "rgba(255,150,100,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => glow.dispose(), [glow]);

  const rings = useMemo(
    () =>
      ORBITS.map(({ r }) => {
        const pts = Array.from({ length: 128 }, (_, k) => {
          const a = (k / 128) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
        });
        return new THREE.BufferGeometry().setFromPoints(pts);
      }),
    [],
  );
  useEffect(() => () => rings.forEach((g) => g.dispose()), [rings]);

  const tmp = useMemo(() => ({ p: new THREE.Vector3(), d: new THREE.Vector3() }), []);

  useFrame((state) => {
    const time = t.current;
    const focused = focusIndex >= 0;
    planetRefs.current.forEach((p, i) => {
      if (!p) return;
      const o = ORBITS[i];
      const a = i * 1.9 + time * o.w * (focused ? 0.3 : 1);
      p.position.set(Math.cos(a) * o.r, 0, Math.sin(a) * o.r);
      p.rotation.y = time * 0.5;
    });
    const g = group.current;
    if (g) {
      const k = focused ? 0 : 1;
      g.rotation.x += (state.pointer.y * 0.25 * k - g.rotation.x) * 0.05;
      g.rotation.z += (state.pointer.x * 0.12 * k - g.rotation.z) * 0.05;
    }
    const c = cam.current;
    if (!c) return;
    const target = focused ? planetRefs.current[focusIndex] : null;
    if (target) {
      const s = ORBITS[focusIndex].s;
      target.getWorldPosition(tmp.p);
      tmp.d.set(0, 0.8 + s * 2, 2.2 + s * 4).add(tmp.p);
      c.position.lerp(tmp.d, 0.05);
      look.current.lerp(tmp.p, 0.08);
    } else {
      c.position.lerp(overview, 0.05);
      look.current.lerp(OVERVIEW_LOOK, 0.08);
    }
    c.lookAt(look.current);
  });

  return (
    <>
      <color attach="background" args={[BG]} />
      <PerspectiveCamera makeDefault ref={cam} fov={50} near={0.1} far={200} position={overview.toArray()} />
      <points geometry={stars}>
        <pointsMaterial size={0.14} color="#aab3d6" />
      </points>
      <ambientLight color="#2a3155" intensity={2} />
      <group ref={group}>
        <mesh>
          <sphereGeometry args={[0.85, 32, 16]} />
          <meshBasicMaterial color="#ffe2b8" />
        </mesh>
        <sprite scale={[5, 5, 1]}>
          <spriteMaterial map={glow} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        <pointLight color="#ffe2b8" intensity={60} decay={1.2} />
        {rings.map((geo, i) => (
          <lineLoop key={i} geometry={geo}>
            <lineBasicMaterial color={i === focusIndex ? "#4b5591" : "#283057"} />
          </lineLoop>
        ))}
        {CATEGORIES.map((cat, i) => (
          <Planet
            key={cat.slug}
            ref={(el) => {
              planetRefs.current[i] = el;
            }}
            orbit={ORBITS[i]}
            name={cat.name}
            slug={cat.slug}
            color={cat.color}
            posts={posts.filter((p) => p.category === cat.slug)}
            clock={t}
            navigate={navigate}
          />
        ))}
      </group>
    </>
  );
}

type PlanetProps = {
  ref: (el: THREE.Group | null) => void;
  orbit: (typeof ORBITS)[number];
  name: string;
  slug: string;
  color: string;
  posts: PostMeta[];
  clock: React.RefObject<number>;
  navigate: Navigate;
};

function Planet({ ref, orbit, name, slug, color, posts, clock, navigate }: PlanetProps) {
  const portal = useLabelPortal();
  const [hover, setHover] = useState(false);
  const [hoverPost, setHoverPost] = useState<string | null>(null);
  useCursor(hover || hoverPost !== null);
  const moons = useRef<THREE.Group>(null);
  useFrame(() => {
    if (moons.current) moons.current.rotation.y = clock.current * 0.6;
  });
  const sats = posts.slice(0, 8);

  return (
    <group ref={ref}>
      <mesh
        onPointerOver={(e) => {
          if (isFromUI(e)) return;
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        onClick={(e) => {
          if (isFromUI(e)) return;
          e.stopPropagation();
          navigate(`/categories/${slug}`);
        }}
        scale={hover ? 1.12 : 1}
      >
        <sphereGeometry args={[orbit.s, 32, 16]} />
        <meshStandardMaterial color={color} roughness={0.75} emissive={color} emissiveIntensity={hover ? 0.25 : 0.04} />
      </mesh>
      {orbit.ring && (
        <mesh rotation-x={-Math.PI / 2.5}>
          <ringGeometry args={[orbit.s * 1.4, orbit.s * 2.1, 48]} />
          <meshBasicMaterial color="#e9d79a" side={THREE.DoubleSide} transparent opacity={0.45} />
        </mesh>
      )}
      <group ref={moons}>
        {sats.map((p, k) => {
          const a = (k / sats.length) * Math.PI * 2;
          const d = orbit.s + 0.3;
          return (
            <mesh
              key={p.slug}
              position={[Math.cos(a) * d, ((k % 3) - 1) * 0.08, Math.sin(a) * d]}
              onPointerOver={(e) => {
                if (isFromUI(e)) return;
                e.stopPropagation();
                setHoverPost(p.slug);
              }}
              onPointerOut={() => setHoverPost(null)}
              onClick={(e) => {
                if (isFromUI(e)) return;
                e.stopPropagation();
                navigate(`/blog/${p.slug}`);
              }}
            >
              <sphereGeometry args={[hoverPost === p.slug ? 0.08 : 0.05, 10, 8]} />
              <meshBasicMaterial color="#dfe4ff" />
              {hoverPost === p.slug && (
                <Html portal={portal} center position={[0, 0.25, 0]} zIndexRange={[5, 0]}>
                  <span className="scene-label">{p.title}</span>
                </Html>
              )}
            </mesh>
          );
        })}
      </group>
      <Html portal={portal} center position={[0, orbit.s + 0.42, 0]} zIndexRange={[5, 0]}>
        <button
          type="button"
          className="scene-label scene-label--planet"
          onClick={() => navigate(`/categories/${slug}`)}
        >
          {name}
          <small>{posts.length}</small>
        </button>
      </Html>
    </group>
  );
}
