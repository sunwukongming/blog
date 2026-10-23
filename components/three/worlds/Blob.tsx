"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { useViewShift, useWorldClock } from "../utils";

const BG = "#e9e8f1";

// Ashima Arts 的 3D simplex noise（MIT）
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const VERT = /* glsl */ `
${NOISE}
uniform float uTime;
varying vec3 vN; varying vec3 vV; varying float vD;
void main(){
  float d = snoise(normal*1.4 + uTime*0.35)*0.3 + snoise(normal*3.2 - uTime*0.2)*0.08;
  vec3 p = position + normal*d;
  vec4 mv = modelViewMatrix*vec4(p,1.0);
  vN = normalize(normalMatrix*normal); vV = -mv.xyz; vD = d;
  gl_Position = projectionMatrix*mv;
}`;

// 用位移量和菲涅尔项查余弦调色板，得到虹彩
const FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vN; varying vec3 vV; varying float vD;
void main(){
  float fres = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.0);
  vec3 col = 0.5 + 0.5*cos(6.2831*(vec3(0.0,0.33,0.67) + vD*1.6 + fres*0.5 + uTime*0.04));
  col = mix(col, vec3(0.62,0.5,0.95), 0.35);
  col = mix(col, vec3(1.0), 0.25 + fres*0.45);
  col *= 0.85 + 0.25*(vN.y*0.5+0.5);
  gl_FragColor = vec4(col, 1.0);
}`;

/** D 软体雕塑：关于页。一团缓慢呼吸的虹彩形体，旁边绕着一颗小卫星 */
export default function Blob() {
  const t = useWorldClock();
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const blob = useRef<THREE.Mesh>(null);
  const moon = useRef<THREE.Mesh>(null);
  useViewShift(cam, 0.2);

  const material = useMemo(
    () => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: VERT, fragmentShader: FRAG }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    const time = t.current;
    if (blob.current) {
      (blob.current.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      blob.current.rotation.y = time * 0.15 + state.pointer.x * 0.6;
      blob.current.rotation.x += (-state.pointer.y * 0.4 - blob.current.rotation.x) * 0.06;
    }
    moon.current?.position.set(
      Math.cos(time * 0.5) * 2.1,
      0.9 + Math.sin(time * 0.7) * 0.3,
      Math.sin(time * 0.5) * 1.2,
    );
  });

  return (
    <>
      <color attach="background" args={[BG]} />
      <PerspectiveCamera makeDefault ref={cam} fov={45} near={0.1} far={100} position={[0, 0, 5.6]} />
      <mesh ref={blob} material={material}>
        <icosahedronGeometry args={[1.35, 48]} />
      </mesh>
      <mesh ref={moon} material={material}>
        <icosahedronGeometry args={[0.28, 12]} />
      </mesh>
    </>
  );
}
