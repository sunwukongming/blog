"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { useWorldClock } from "../utils";

const BG = "#0a0c10";

/** A 信号场：文章页背景。页面顶部是起伏的点阵，向下滚动时被压平、变暗，成为正文背后的纹理 */
export default function Field() {
  const t = useWorldClock();
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const small = useThree((s) => s.size.width < 700);
  const NX = small ? 90 : 150;
  const NZ = small ? 50 : 70;

  const points = useRef<THREE.Points>(null);
  const field = useMemo(() => {
    const S = 0.16;
    const pos = new Float32Array(NX * NZ * 3);
    for (let iz = 0; iz < NZ; iz++)
      for (let ix = 0; ix < NX; ix++) {
        const i = (iz * NX + ix) * 3;
        pos[i] = (ix - NX / 2) * S;
        pos[i + 2] = (iz - NZ / 2) * S;
      }
    return { pos, col: new Float32Array(NX * NZ * 3) };
  }, [NX, NZ]);

  const amp = useRef(1);
  const colors = useMemo(
    () => ({
      base: new THREE.Color("#8f9aa8"),
      hi: new THREE.Color("#e6ebf1"),
      acc: new THREE.Color("#5b8cff"),
      tmp: new THREE.Color(),
    }),
    [],
  );

  useFrame((state) => {
    const time = t.current;
    const geo = points.current?.geometry;
    if (!geo) return;
    const pos = geo.attributes.position.array as Float32Array;
    const col = geo.attributes.color.array as Float32Array;
    const { base, hi, acc, tmp } = colors;
    amp.current += (Math.max(0.25, 1 - window.scrollY / 500) - amp.current) * 0.08;
    const a = amp.current;
    const dim = 0.35 + 0.65 * a;
    const mx = state.pointer.x * 6;
    const mz = -state.pointer.y * 4 + 0.5;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const z = pos[i + 2];
      const dx = x - mx;
      const dz = z - mz;
      const b = Math.exp(-(dx * dx + dz * dz) * 0.7);
      const y =
        0.32 * Math.sin(x * 0.6 + time * 0.9) +
        0.22 * Math.cos(z * 0.8 - time * 0.7) +
        0.12 * Math.sin((x + z) * 1.3 + time * 1.4);
      pos[i + 1] = (y + b * 0.9) * a;
      tmp
        .copy(base)
        .lerp(hi, Math.min(Math.max((y + 0.5) * 0.7, 0), 1))
        .lerp(acc, Math.min(b * 1.4, 1))
        .multiplyScalar(dim);
      col[i] = tmp.r;
      col[i + 1] = tmp.g;
      col[i + 2] = tmp.b;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    if (cam.current) {
      cam.current.position.x = state.pointer.x * 0.6;
      cam.current.lookAt(0, -0.4, 0);
    }
  });

  return (
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 6, 15]} />
      <PerspectiveCamera makeDefault ref={cam} fov={50} near={0.1} far={100} position={[0, 3.4, 7.6]} />
      <points ref={points} key={field.pos.length}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[field.pos, 3]} />
          <bufferAttribute attach="attributes-color" args={[field.col, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.045} vertexColors />
      </points>
    </>
  );
}
