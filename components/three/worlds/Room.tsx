"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, OrthographicCamera, useCursor } from "@react-three/drei";
import * as THREE from "three";
import { isFromUI, rng, useViewShift, useWorldClock, useLabelPortal, type Navigate } from "../utils";

const BG = "#1b2236";
const BOOK_COLORS = ["#d0644c", "#e7b24a", "#4f7cac", "#6a9c78", "#efe3d0", "#8a5a9b", "#2f4858"];
const CODE_COLORS = ["#7fd4ff", "#ffc46b", "#b6f09c", "#f78fb3", "#7fd4ff"];

type V3 = [number, number, number];

function Box({
  args,
  color,
  position,
  basic,
  rotation,
}: {
  args: V3;
  color: string;
  position: V3;
  basic?: boolean;
  rotation?: V3;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={args} />
      {basic ? (
        <meshBasicMaterial color={color} />
      ) : (
        <meshStandardMaterial color={color} roughness={0.95} flatShading />
      )}
    </mesh>
  );
}

/** 可点击的物件：悬停时轻轻抬起并显示标签，点击跳转 */
function Hotspot({
  to,
  label,
  labelAt,
  navigate,
  children,
}: {
  to: string;
  label: string;
  labelAt: V3;
  navigate: Navigate;
  children: ReactNode;
}) {
  const portal = useLabelPortal();
  const [hover, setHover] = useState(false);
  useCursor(hover);
  return (
    <group
      position-y={hover ? 0.06 : 0}
      onPointerOver={(e) => {
        if (isFromUI(e)) return;
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
      onClick={(e) => {
        if (isFromUI(e)) return;
        e.stopPropagation();
        navigate(to);
      }}
    >
      {children}
      {hover && (
        <Html portal={portal} center position={labelAt} zIndexRange={[5, 0]}>
          <span className="scene-label">{label}</span>
        </Html>
      )}
    </group>
  );
}

/** C 夜读小屋：首页。电脑 → 文章，书架 → 读书笔记，地球仪 → 分类星系，墙上的画 → 归档，窗户 → 随笔 */
export default function Room({ navigate }: { navigate: Navigate }) {
  const t = useWorldClock();
  const cam = useRef<THREE.OrthographicCamera>(null);
  const room = useRef<THREE.Group>(null);
  const cursor = useRef<THREE.Mesh>(null);
  const plant = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const size = useThree((s) => s.size);
  const zoom = Math.min(size.height / 7.8, size.width / 11.5);
  useViewShift(cam, 0.16, 0.3);

  const books = useMemo(() => {
    const r = rng(11);
    const out: { h: number; w: number; y: number; z: number; color: string }[] = [];
    for (const y0 of [0.06, 0.75, 1.45, 2.15]) {
      let z = -1.3;
      for (;;) {
        const w = 0.07 + r() * 0.09;
        const h = 0.38 + r() * 0.2;
        if (z + w > 0.32) break;
        out.push({ w, h, y: y0 + h / 2, z: z + w / 2, color: BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)] });
        z += w + 0.01;
      }
    }
    return out;
  }, []);

  const code = useMemo(() => {
    const r = rng(3);
    const lines = Array.from({ length: 7 }, (_, k) => {
      const indent = (k % 3) * 0.08;
      const w = 0.15 + r() * 0.45;
      return { w, x: 0.02 + indent + w / 2, y: 1.92 - k * 0.075, color: CODE_COLORS[k % 5] };
    });
    const last = lines[lines.length - 1];
    return { lines, cursor: [last.x + last.w / 2 + 0.04, last.y, -2.598] as V3 };
  }, []);

  const dust = useMemo(() => {
    const r = rng(5);
    const seeds = Array.from({ length: 70 }, () => [r() * 2.6 - 1.3, r() * 1.8, r() * 1.6 - 0.8, r() * 6]);
    const pos = new Float32Array(seeds.length * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { seeds, pos, geo };
  }, []);
  useEffect(() => () => dust.geo.dispose(), [dust]);

  useFrame((state) => {
    const time = t.current;
    if (room.current) room.current.rotation.y += (state.pointer.x * 0.3 - room.current.rotation.y) * 0.06;
    if (cam.current) {
      cam.current.position.y += (8 + state.pointer.y * 1.2 - cam.current.position.y) * 0.06;
      cam.current.lookAt(0, 1.35, 0);
    }
    if (cursor.current) cursor.current.visible = time % 1 < 0.55;
    if (plant.current) plant.current.rotation.z = Math.sin(time * 0.8) * 0.04;
    if (lamp.current) lamp.current.intensity = 9 + Math.sin(time * 3) * 0.2;
    dust.seeds.forEach(([x, y, z, ph], i) => {
      dust.pos[i * 3] = x + Math.sin(time * 0.3 + ph) * 0.1;
      dust.pos[i * 3 + 1] = 0.9 + ((y + time * 0.05) % 1.8);
      dust.pos[i * 3 + 2] = -1.9 + z + Math.cos(time * 0.25 + ph) * 0.1;
    });
    dust.geo.attributes.position.needsUpdate = true;
  });

  const wood = "#7a4e35";

  return (
    <>
      <color attach="background" args={[BG]} />
      <OrthographicCamera makeDefault ref={cam} zoom={zoom} near={0.1} far={100} position={[10, 8, 10]} />
      <ambientLight color="#6c7aa8" intensity={1.7} />
      <directionalLight color="#a9b8ff" intensity={1.1} position={[-8, 6, 3]} />

      <group ref={room}>
        {/* 地板、墙、地毯 */}
        <Box args={[6, 0.3, 6]} color="#b07a52" position={[0, -0.15, 0]} />
        <Box args={[6, 4.2, 0.2]} color="#e2cdb6" position={[0, 2.1, -3.1]} />
        <Box args={[0.2, 4.2, 6]} color="#d3b89d" position={[-3.1, 2.1, 0]} />
        <mesh position={[0.7, 0.015, 0.5]}>
          <cylinderGeometry args={[1.5, 1.5, 0.03, 24]} />
          <meshStandardMaterial color="#8e4b5a" roughness={1} flatShading />
        </mesh>

        {/* 窗户 → 随笔 */}
        <Hotspot to="/categories/essays" label="随笔" labelAt={[-2.9, 3.25, 1.5]} navigate={navigate}>
          <Box args={[0.04, 1.5, 1.3]} color="#3a4766" position={[-2.99, 2.3, 1.5]} />
          <Box args={[0.02, 1.3, 1.1]} color="#2b4a7a" basic position={[-2.96, 2.3, 1.5]} />
          <Box args={[0.03, 1.3, 0.05]} color="#3a4766" position={[-2.94, 2.3, 1.5]} />
          <Box args={[0.03, 0.05, 1.1]} color="#3a4766" position={[-2.94, 2.3, 1.5]} />
          <mesh position={[-2.93, 2.65, 1.78]}>
            <sphereGeometry args={[0.11, 12, 8]} />
            <meshBasicMaterial color="#f4efc9" />
          </mesh>
        </Hotspot>

        {/* 墙上的画 → 归档 */}
        <Hotspot to="/archive" label="归档" labelAt={[-1.4, 3.25, -2.9]} navigate={navigate}>
          <Box args={[0.9, 0.62, 0.04]} color="#efe4d4" position={[-1.4, 2.7, -2.98]} />
          <Box args={[0.76, 0.48, 0.02]} color="#5b8fb9" basic position={[-1.4, 2.7, -2.95]} />
          <Box args={[0.5, 0.2, 0.02]} color="#3f6b8f" basic position={[-1.45, 2.56, -2.94]} />
        </Hotspot>

        {/* 书桌 */}
        <Box args={[2.5, 0.1, 1.1]} color="#6b4632" position={[0.5, 1.0, -2.35]} />
        {[
          [-1.1, -0.45],
          [1.1, -0.45],
          [-1.1, 0.45],
          [1.1, 0.45],
        ].map(([dx, dz], i) => (
          <Box key={i} args={[0.08, 1, 0.08]} color="#5a3a29" position={[0.5 + dx, 0.5, -2.35 + dz]} />
        ))}

        {/* 电脑 → 文章 */}
        <Hotspot to="/blog" label="文章" labelAt={[0.5, 2.3, -2.5]} navigate={navigate}>
          <Box args={[0.08, 0.3, 0.08]} color="#2b2e36" position={[0.5, 1.2, -2.62]} />
          <Box args={[1.2, 0.74, 0.06]} color="#22252e" position={[0.5, 1.7, -2.64]} />
          <Box args={[1.1, 0.64, 0.01]} color="#0f2a3f" basic position={[0.5, 1.7, -2.605]} />
          {code.lines.map((l, k) => (
            <Box key={k} args={[l.w, 0.028, 0.005]} color={l.color} basic position={[l.x, l.y, -2.598]} />
          ))}
          <mesh ref={cursor} position={code.cursor}>
            <boxGeometry args={[0.03, 0.045, 0.005]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <pointLight color="#7fc8ff" intensity={2.5} distance={3} decay={1} position={[0.5, 1.7, -2.2]} />
          <Box args={[0.7, 0.03, 0.22]} color="#cfd3da" position={[0.5, 1.065, -2.05]} />
        </Hotspot>

        <mesh position={[1.35, 1.12, -2.1]}>
          <cylinderGeometry args={[0.07, 0.07, 0.14, 10]} />
          <meshStandardMaterial color="#e07a5f" roughness={0.9} flatShading />
        </mesh>

        {/* 台灯 */}
        <mesh position={[-0.35, 1.07, -2.55]}>
          <cylinderGeometry args={[0.14, 0.14, 0.04, 12]} />
          <meshStandardMaterial color="#2d2f36" />
        </mesh>
        <Box args={[0.03, 0.55, 0.03]} color="#2d2f36" position={[-0.35, 1.35, -2.55]} rotation={[0, 0, -0.25]} />
        <mesh position={[-0.28, 1.66, -2.52]}>
          <coneGeometry args={[0.2, 0.24, 12]} />
          <meshStandardMaterial color="#f2c14e" emissive="#7a4a10" flatShading />
        </mesh>
        <mesh position={[-0.28, 1.55, -2.52]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshBasicMaterial color="#fff2c8" />
        </mesh>
        <pointLight ref={lamp} color="#ffb86b" intensity={9} distance={7} decay={1} position={[-0.28, 1.45, -2.3]} />

        {/* 椅子 */}
        <Box args={[0.7, 0.08, 0.7]} color="#3f5f7d" position={[0.5, 0.62, -1.45]} />
        <Box args={[0.7, 0.8, 0.08]} color="#3f5f7d" position={[0.5, 1.05, -1.12]} />
        <Box args={[0.08, 0.6, 0.08]} color="#2b3340" position={[0.5, 0.3, -1.45]} />
        <Box args={[0.7, 0.04, 0.1]} color="#2b3340" position={[0.5, 0.02, -1.45]} />

        {/* 书架 → 读书笔记 */}
        <Hotspot to="/categories/cloud" label="云与可观测" labelAt={[-2.75, 3.1, -0.5]} navigate={navigate}>
          <Box args={[0.04, 2.8, 1.8]} color="#5e3b28" position={[-2.98, 1.4, -0.5]} />
          <Box args={[0.5, 2.8, 0.06]} color={wood} position={[-2.75, 1.4, -1.37]} />
          <Box args={[0.5, 2.8, 0.06]} color={wood} position={[-2.75, 1.4, 0.37]} />
          {[0.03, 0.72, 1.42, 2.12, 2.77].map((y) => (
            <Box key={y} args={[0.5, 0.06, 1.8]} color={wood} position={[-2.75, y, -0.5]} />
          ))}
          {books.map((b, i) => (
            <Box key={i} args={[0.36, b.h, b.w]} color={b.color} position={[-2.72, b.y, b.z]} />
          ))}
        </Hotspot>

        {/* 书架顶上的地球仪 → 分类星系 */}
        <Hotspot to="/categories" label="分类星系" labelAt={[-2.75, 3.55, 0.05]} navigate={navigate}>
          <mesh position={[-2.75, 2.85, 0.05]}>
            <cylinderGeometry args={[0.1, 0.12, 0.06, 10]} />
            <meshStandardMaterial color="#2d2f36" />
          </mesh>
          <mesh position={[-2.75, 3.08, 0.05]}>
            <icosahedronGeometry args={[0.2, 1]} />
            <meshStandardMaterial color="#6fa8ff" emissive="#1d3a6b" flatShading />
          </mesh>
          <mesh position={[-2.75, 3.08, 0.05]} rotation={[-1.2, 0, 0.3]}>
            <torusGeometry args={[0.28, 0.012, 6, 32]} />
            <meshBasicMaterial color="#e2c46a" />
          </mesh>
        </Hotspot>

        {/* 植物 */}
        <mesh position={[2.3, 0.225, -2.3]}>
          <cylinderGeometry args={[0.25, 0.19, 0.45, 8]} />
          <meshStandardMaterial color="#c46a4a" roughness={0.95} flatShading />
        </mesh>
        <group ref={plant} position={[2.3, 0.45, -2.3]}>
          {(
            [
              [0, 0.35, 0, 0.38],
              [-0.16, 0.62, 0.1, 0.3],
              [0.15, 0.66, -0.1, 0.28],
              [0, 0.9, 0, 0.22],
            ] as const
          ).map(([x, y, z, s], i) => (
            <mesh key={i} position={[x, y, z]}>
              <icosahedronGeometry args={[s, 0]} />
              <meshStandardMaterial color="#4f8a5b" roughness={0.95} flatShading />
            </mesh>
          ))}
        </group>

        {/* 台灯下的浮尘 */}
        <points geometry={dust.geo}>
          <pointsMaterial color="#ffd9a0" size={2.5} sizeAttenuation={false} transparent opacity={0.7} />
        </points>
      </group>
    </>
  );
}
