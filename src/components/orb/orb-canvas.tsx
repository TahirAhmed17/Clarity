"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbState } from "./orb";

/** 3D simplex noise — Ashima Arts / Stefan Gustavson (MIT licence). */
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const VERTEX = /* glsl */ `
uniform float uTime; uniform float uAmp; uniform float uFreq;
varying vec3 vNormal; varying vec3 vView; varying float vNoise;
${NOISE}
void main(){
  float n = snoise(normal * uFreq + vec3(uTime * 0.6, uTime * 0.4, uTime * 0.5));
  float n2 = snoise(normal * uFreq * 2.3 - vec3(uTime * 0.3));
  vNoise = n * 0.7 + n2 * 0.3;
  vec3 displaced = position + normal * vNoise * uAmp;
  vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 uMist; uniform vec3 uTeal; uniform vec3 uMint; uniform vec3 uLime; uniform vec3 uCoral; uniform vec3 uDeep; uniform vec3 uAqua;
uniform float uAlert; uniform float uGlow; uniform float uTime;
varying vec3 vNormal; varying vec3 vView; varying float vNoise;
void main(){
  vec3 N = normalize(vNormal);
  float ndv = max(dot(N, vView), 0.0);
  float fres = pow(1.0 - ndv, 2.6);
  float t = vNoise * 0.5 + 0.5;
  // Depth: deep teal below, aqua/mint above; noise moves colour across the surface like water.
  float up = N.y * 0.5 + 0.5;
  vec3 base = mix(uDeep, uTeal, smoothstep(0.05, 0.55, up + (t - 0.5) * 0.5));
  base = mix(base, uAqua, smoothstep(0.3, 0.75, t) * 0.6);
  base = mix(base, uMint, smoothstep(0.45, 0.9, up * 0.6 + t * 0.6) * 0.8);
  base = mix(base, uLime, smoothstep(0.68, 1.0, t) * 0.55);
  // Coral is a selective accent: a drifting warm band, and the dominant tint in the alert state.
  // Blend coral into a peach-mint (not into teal) so the accent never turns muddy brown.
  float coralBand = smoothstep(0.7, 0.98, sin(N.x * 2.2 - N.y * 1.3 + uTime * 0.25) * 0.5 + 0.5) * smoothstep(0.3, 0.75, up) * 0.6;
  vec3 warm = mix(uCoral, vec3(1.0, 0.86, 0.78), 0.35);
  base = mix(base, mix(uMint, warm, 0.75), coralBand);
  base = mix(base, warm, uAlert * (0.45 + 0.3 * t));
  // Soft key light + glassy specular.
  vec3 L = normalize(vec3(-0.5, 0.8, 0.6));
  float diff = max(dot(N, L), 0.0) * 0.25 + 0.8;
  float spec = pow(max(dot(reflect(-L, N), vView), 0.0), 28.0) * 0.55;
  vec3 col = base * diff + spec + fres * (0.22 + uGlow * 0.5) * uAqua;
  col = mix(col, uMist, fres * 0.25);
  gl_FragColor = vec4(col, 1.0);
  // Colours arrive in linear space (three.js colour management); convert back to sRGB for display.
  #include <colorspace_fragment>
}`;

const TARGETS: Record<OrbState, { amp: number; speed: number; freq: number; alert: number; glow: number }> = {
  idle: { amp: 0.055, speed: 0.22, freq: 1.1, alert: 0, glow: 0 },
  listening: { amp: 0.09, speed: 0.55, freq: 1.25, alert: 0, glow: 0.15 },
  thinking: { amp: 0.14, speed: 1.2, freq: 1.6, alert: 0, glow: 0.1 },
  answering: { amp: 0.07, speed: 0.45, freq: 1.15, alert: 0, glow: 0.35 },
  alert: { amp: 0.08, speed: 0.35, freq: 1.2, alert: 1, glow: 0.1 },
};

const c = (hex: string) => new THREE.Color(hex);

function Blob({ state }: { state: OrbState }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const clock = useRef(0);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: TARGETS.idle.amp },
      uFreq: { value: TARGETS.idle.freq },
      uAlert: { value: 0 },
      uGlow: { value: 0 },
      uMist: { value: c("#D4E8E8") },
      uTeal: { value: c("#32BEB3") },
      uMint: { value: c("#C2E8CC") },
      uLime: { value: c("#AAD253") },
      uCoral: { value: c("#EA7C6A") },
      uDeep: { value: c("#11756E") },
      uAqua: { value: c("#86BFCB") },
    }),
    [],
  );
  const speed = useRef(TARGETS.idle.speed);

  useFrame((_, delta) => {
    const u = material.current?.uniforms;
    if (!u) return;
    const t = TARGETS[state];
    const k = 1 - Math.exp(-delta * 3); // frame-rate independent easing
    u.uAmp.value += (t.amp - u.uAmp.value) * k;
    u.uFreq.value += (t.freq - u.uFreq.value) * k;
    u.uAlert.value += (t.alert - u.uAlert.value) * k;
    u.uGlow.value += (t.glow - u.uGlow.value) * k;
    speed.current += (t.speed - speed.current) * k;
    clock.current += delta * speed.current;
    u.uTime.value = clock.current;
    if (mesh.current) mesh.current.rotation.y += delta * 0.08;
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1, 64]} />
      <shaderMaterial ref={material} vertexShader={VERTEX} fragmentShader={FRAGMENT} uniforms={uniforms} />
    </mesh>
  );
}

export default function OrbCanvas({ state, onReady }: { state: OrbState; onReady?: () => void }) {
  return (
    <Canvas
      aria-hidden
      flat
      dpr={[1, 2]}
      camera={{ position: [0, 0, 3.6], fov: 35 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ background: "transparent" }}
      onCreated={() => onReady?.()}
    >
      <Blob state={state} />
    </Canvas>
  );
}
