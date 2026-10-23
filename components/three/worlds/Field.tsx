"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { useWorldClock } from "../utils";

const BG = "#0a0c10";
const FOG: [number, number] = [6, 15];

// 起伏和颜色都在顶点着色器里算，CPU 每帧只更新几个 uniform
const VERT = /* glsl */ `
uniform float uTime, uAmp, uScale, uSize;
uniform vec2 uMouse;
uniform vec3 uBase, uHi, uAcc;
varying vec3 vColor;
varying float vDepth;
void main() {
  vec3 p = position;
  vec2 d = p.xz - uMouse;
  float b = exp(-dot(d, d) * 0.7);
  float y = 0.32 * sin(p.x * 0.6 + uTime * 0.9) + 0.22 * cos(p.z * 0.8 - uTime * 0.7) + 0.12 * sin((p.x + p.z) * 1.3 + uTime * 1.4);
  p.y = (y + b * 0.9) * uAmp;
  vColor = mix(mix(uBase, uHi, clamp((y + 0.5) * 0.7, 0.0, 1.0)), uAcc, clamp(b * 1.4, 0.0, 1.0)) * (0.35 + 0.65 * uAmp);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_PointSize = uSize * uScale / vDepth;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uFog;
uniform vec2 uFogRange;
varying vec3 vColor;
varying float vDepth;
void main() {
  gl_FragColor = vec4(mix(vColor, uFog, smoothstep(uFogRange.x, uFogRange.y, vDepth)), 1.0);
  #include <colorspace_fragment>
}`;

/** A 信号场：文章页背景。页面顶部是起伏的点阵，向下滚动时被压平、变暗，成为正文背后的纹理 */
export default function Field() {
  const t = useWorldClock();
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const points = useRef<THREE.Points>(null);
  const small = useThree((s) => s.size.width < 700);
  const NX = small ? 90 : 150;
  const NZ = small ? 50 : 70;

  const geo = useMemo(() => {
    const S = 0.16;
    const pos = new Float32Array(NX * NZ * 3);
    for (let iz = 0; iz < NZ; iz++)
      for (let ix = 0; ix < NX; ix++) {
        const i = (iz * NX + ix) * 3;
        pos[i] = (ix - NX / 2) * S;
        pos[i + 2] = (iz - NZ / 2) * S;
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    // 顶点高度在着色器里算，包围球按最大起伏放大，避免被视锥裁掉
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(NX, NZ) * S);
    return g;
  }, [NX, NZ]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uAmp: { value: 1 },
          uScale: { value: 1 },
          uSize: { value: 0.045 },
          uMouse: { value: new THREE.Vector2() },
          uBase: { value: new THREE.Color("#8f9aa8") },
          uHi: { value: new THREE.Color("#e6ebf1") },
          uAcc: { value: new THREE.Color("#5b8cff") },
          uFog: { value: new THREE.Color(BG) },
          uFogRange: { value: new THREE.Vector2(...FOG) },
        },
      }),
    [],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const u = (points.current?.material as THREE.ShaderMaterial | undefined)?.uniforms;
    if (!u) return;
    u.uTime.value = t.current;
    u.uAmp.value += (Math.max(0.25, 1 - window.scrollY / 500) - u.uAmp.value) * 0.08;
    u.uMouse.value.set(state.pointer.x * 6, -state.pointer.y * 4 + 0.5);
    // 和 PointsMaterial 的 sizeAttenuation 一致：像素大小 = size × 画布高度一半 / 深度
    u.uScale.value = state.size.height * state.viewport.dpr * 0.5;
    if (cam.current) {
      cam.current.position.x = state.pointer.x * 0.6;
      cam.current.lookAt(0, -0.4, 0);
    }
  });

  return (
    <>
      <color attach="background" args={[BG]} />
      <PerspectiveCamera makeDefault ref={cam} fov={50} near={0.1} far={100} position={[0, 3.4, 7.6]} />
      <points ref={points} geometry={geo} material={material} />
    </>
  );
}
