"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import type { SystemId } from "@/data/evidence/catalogue";
import { BODY_POINTS, markerTone, TONE_COLOR, type BodySystemState } from "./body-points";

/** Soft translucent figure from primitives — a stylised map, deliberately not anatomical. */
function Figure() {
  const mat = (
    <meshStandardMaterial color="#cfe6e4" roughness={0.35} metalness={0} transparent opacity={0.42} depthWrite={false} />
  );
  return (
    <group>
      <mesh position={[0, 1.78, 0]}>
        <sphereGeometry args={[0.17, 48, 48]} />
        {mat}
      </mesh>
      <mesh position={[0, 1.53, 0]}>
        <cylinderGeometry args={[0.065, 0.075, 0.16, 32]} />
        {mat}
      </mesh>
      <mesh position={[0, 1.12, 0]} scale={[1.0, 1.0, 0.62]}>
        <capsuleGeometry args={[0.26, 0.52, 16, 48]} />
        {mat}
      </mesh>
      <mesh position={[0, 0.66, 0]} scale={[1.0, 0.7, 0.66]}>
        <sphereGeometry args={[0.25, 48, 48]} />
        {mat}
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.39, 1.12, 0]} rotation={[0, 0, s * 0.12]}>
            <capsuleGeometry args={[0.065, 0.5, 12, 32]} />
            {mat}
          </mesh>
          <mesh position={[s * 0.46, 0.62, 0.02]} rotation={[0, 0, s * 0.06]}>
            <capsuleGeometry args={[0.055, 0.44, 12, 32]} />
            {mat}
          </mesh>
          <mesh position={[s * 0.13, 0.12, 0]}>
            <capsuleGeometry args={[0.095, 0.62, 12, 32]} />
            {mat}
          </mesh>
          <mesh position={[s * 0.13, -0.55, 0]}>
            <capsuleGeometry args={[0.075, 0.56, 12, 32]} />
            {mat}
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Marker({
  id,
  state,
  selected,
  onSelect,
  animate,
}: {
  id: SystemId;
  state: BodySystemState;
  selected: boolean;
  onSelect: (id: SystemId) => void;
  animate: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const tone = markerTone(state);
  const color = TONE_COLOR[tone];
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pulse = animate && (selected || tone === "alert") ? 1 + Math.sin(clock.elapsedTime * 3) * 0.12 : 1;
    const base = selected ? 1.45 : hover ? 1.25 : 1;
    ref.current.scale.setScalar(base * pulse);
  });
  const p = BODY_POINTS[id].p3;
  // Kidneys are a pair: mirror the marker.
  const positions: [number, number, number][] = id === "kidneys" ? [p, [-p[0], p[1], p[2]]] : [p];
  return (
    <>
      {positions.map((pos, i) => (
        <mesh
          key={i}
          ref={i === 0 ? ref : undefined}
          position={pos}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(id);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = "";
          }}
        >
          <sphereGeometry args={[0.045, 32, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.9 : 0.45} roughness={0.3} />
        </mesh>
      ))}
    </>
  );
}

export default function BodyCanvas({
  systems,
  selected,
  onSelect,
  animate,
}: {
  systems: BodySystemState[];
  selected: SystemId;
  onSelect: (id: SystemId) => void;
  animate: boolean;
}) {
  return (
    <Canvas aria-hidden flat dpr={[1, 2]} camera={{ position: [0, 0.55, 5.4], fov: 34 }} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}>
      <ambientLight intensity={1.1} />
      <directionalLight position={[2, 3, 3]} intensity={1.4} />
      <directionalLight position={[-3, 1, -2]} intensity={0.5} color="#C2E8CC" />
      <group position={[0, -0.45, 0]}>
        <Figure />
        {systems.map((s) => (
          <Marker key={s.id} id={s.id} state={s} selected={selected === s.id} onSelect={onSelect} animate={animate} />
        ))}
      </group>
      <OrbitControls enablePan={false} enableZoom={false} autoRotate={animate} autoRotateSpeed={0.6} minPolarAngle={Math.PI / 3} maxPolarAngle={(2 * Math.PI) / 3} target={[0, 0.65, 0]} />
    </Canvas>
  );
}
