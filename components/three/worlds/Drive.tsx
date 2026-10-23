"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { rng, useViewShift, useWorldClock } from "../utils";

const BG = "#14021f";
const SPEED = 4;

// 中间是平坦的路，两侧起伏成山
function height(x: number, z: number) {
  const v = Math.max(0, Math.abs(x) - 2.2);
  const k = Math.min(v / 4, 1);
  return (
    k * k * (2.2 + Math.sin(x * 0.55 + z * 0.35) * 1.1 + Math.sin(x * 0.21 - z * 0.6) * 0.9 + Math.sin(z * 1.3) * 0.3)
  );
}

const SUN_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

const SUN_FRAG = /* glsl */ `
uniform float uTime; varying vec2 vUv;
void main(){
  vec3 col = mix(vec3(1.0,0.24,0.54), vec3(1.0,0.85,0.37), smoothstep(0.1,0.9,vUv.y));
  if (vUv.y < 0.5) { float s = fract(vUv.y*14.0 + uTime*0.3); if (s < (0.5 - vUv.y)*0.95) discard; }
  gl_FragColor = vec4(col, 1.0);
}`;

/** E 夜行：归档页。霓虹线框地形朝镜头奔来，远处是条纹落日 */
export default function Drive() {
  const t = useWorldClock();
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const terrain = useRef<THREE.Group>(null);
  const wire = useRef<THREE.Mesh>(null);
  const sunMesh = useRef<THREE.Mesh>(null);
  const lastStep = useRef<number | null>(null);
  useViewShift(cam, 0.15);

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(44, 60, 44, 60);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const sun = useMemo(
    () =>
      new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: SUN_VERT, fragmentShader: SUN_FRAG }),
    [],
  );
  const stars = useMemo(() => {
    const r = rng(19);
    const p = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) p.set([(r() - 0.5) * 160, 8 + r() * 50, -60 - r() * 10], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  useEffect(
    () => () => {
      geo.dispose();
      sun.dispose();
      stars.dispose();
    },
    [geo, sun, stars],
  );

  useFrame((state) => {
    const time = t.current;
    // 网格每格 1 个单位：整体平移小数部分，整数步时重算高度，看起来就是无限向前
    const off = time * SPEED;
    const step = Math.floor(off);
    if (terrain.current) terrain.current.position.z = -24 + (off - step);
    if (wire.current && step !== lastStep.current) {
      const P = wire.current.geometry.attributes.position;
      for (let i = 0; i < P.count; i++) P.setY(i, height(P.getX(i), P.getZ(i) - step));
      P.needsUpdate = true;
      lastStep.current = step;
    }
    if (sunMesh.current) (sunMesh.current.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    const c = cam.current;
    if (c) {
      c.position.x += (state.pointer.x * 1.4 - c.position.x) * 0.06;
      c.position.y += (1.5 + state.pointer.y * 0.5 - c.position.y) * 0.06;
      c.lookAt(state.pointer.x * 0.6, 1, -20);
    }
  });

  return (
    <>
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 8, 46]} />
      <PerspectiveCamera makeDefault ref={cam} fov={62} near={0.1} far={200} position={[0, 1.5, 6]} />
      <group ref={terrain} position-z={-24}>
        <mesh geometry={geo}>
          <meshBasicMaterial color={BG} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        </mesh>
        <mesh ref={wire} geometry={geo}>
          <meshBasicMaterial color="#ff3ea5" wireframe />
        </mesh>
      </group>
      <mesh ref={sunMesh} position={[0, 6, -58]} material={sun}>
        <circleGeometry args={[12, 64]} />
      </mesh>
      <points geometry={stars}>
        <pointsMaterial color="#ffd6f0" size={0.25} fog={false} />
      </points>
    </>
  );
}
