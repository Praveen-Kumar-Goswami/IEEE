"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { COLOR } from "@/lib/design/tokens";
import { damp } from "@/utils/math";
import type { TierConfig } from "@/hooks/use-device-tier";
import { fresnelFragment, fresnelVertex } from "./shaders";

export interface SecuritySceneState {
  /** Highlighted concept: 0 shell, 1-3 rings, 4 core. -1 for none. */
  focus: number;
  px: number;
  py: number;
}

const RINGS = [
  { radius: 1.55, tilt: [1.2, 0.2, 0], speed: 0.16, nodes: 3 },
  { radius: 1.8, tilt: [0.3, 0.9, 0.4], speed: -0.11, nodes: 2 },
  { radius: 2.05, tilt: [-0.5, -0.4, 1.1], speed: 0.08, nodes: 4 },
] as const;

function Ring({ index, state }: { index: number; state: MutableRefObject<SecuritySceneState> }) {
  const cfg = RINGS[index];
  const spin = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const nodeMat = useRef<THREE.MeshBasicMaterial>(null);
  const idle = useMemo(() => new THREE.Color(COLOR.graphite400), []);
  const lit = useMemo(() => new THREE.Color(COLOR.signal), []);
  const bone = useMemo(() => new THREE.Color(COLOR.bone), []);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.z += dt * cfg.speed;
    const on = state.current.focus === index + 1;
    if (mat.current) {
      mat.current.color.lerp(on ? lit : idle, 1 - Math.exp(-6 * dt));
      mat.current.opacity = damp(mat.current.opacity, on ? 0.95 : 0.4, 6, dt);
    }
    if (nodeMat.current) nodeMat.current.color.lerp(on ? lit : bone, 1 - Math.exp(-6 * dt));
  });
  return (
    <group rotation={cfg.tilt as unknown as [number, number, number]}>
      <group ref={spin}>
        <mesh>
          <torusGeometry args={[cfg.radius, 0.004, 6, 180]} />
          <meshBasicMaterial ref={mat} color={COLOR.graphite400} transparent opacity={0.4} toneMapped={false} />
        </mesh>
        {Array.from({ length: cfg.nodes }, (_, i) => {
          const a = (i / cfg.nodes) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * cfg.radius, Math.sin(a) * cfg.radius, 0]}>
              <sphereGeometry args={[0.035, 16, 16]} />
              <meshBasicMaterial ref={i === 0 ? nodeMat : undefined} color={COLOR.bone} toneMapped={false} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function Structure({ state, reduced }: { state: MutableRefObject<SecuritySceneState>; reduced: boolean }) {
  const root = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Group>(null);
  const edgeMat = useRef<THREE.LineBasicMaterial>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const ico = useMemo(() => new THREE.IcosahedronGeometry(1.15, 1), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(ico, 1), [ico]);
  const fresnel = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: fresnelVertex,
        fragmentShader: fresnelFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color(COLOR.signal) }, uPower: { value: 2.4 }, uIntensity: { value: 0.5 } },
      }),
    [],
  );
  const idle = useMemo(() => new THREE.Color(COLOR.graphite500), []);
  const lit = useMemo(() => new THREE.Color(COLOR.signalSoft), []);

  useFrame((frame, dt) => {
    const t = frame.clock.elapsedTime;
    const { focus, px, py } = state.current;
    if (shell.current && !reduced) {
      shell.current.rotation.y += dt * 0.06;
      shell.current.rotation.x = Math.sin(t * 0.1) * 0.15;
    }
    if (root.current) {
      root.current.rotation.y = damp(root.current.rotation.y, px * 0.25, 2.5, dt);
      root.current.rotation.x = damp(root.current.rotation.x, py * 0.18, 2.5, dt);
    }
    if (edgeMat.current) {
      edgeMat.current.color.lerp(focus === 0 ? lit : idle, 1 - Math.exp(-6 * dt));
      edgeMat.current.opacity = damp(edgeMat.current.opacity, focus === 0 ? 0.9 : 0.45, 6, dt);
    }
    fresnel.uniforms.uIntensity.value = damp(fresnel.uniforms.uIntensity.value, focus === 0 ? 1 : 0.5, 6, dt);
    if (coreMat.current) coreMat.current.emissiveIntensity = damp(coreMat.current.emissiveIntensity, focus === 4 ? 2.2 : 0.6 + Math.sin(t * 1.2) * 0.1, 5, dt);
  });

  return (
    <group ref={root}>
      <group ref={shell}>
        <mesh geometry={ico} material={fresnel} />
        <lineSegments geometry={edges}>
          <lineBasicMaterial ref={edgeMat} color={COLOR.graphite500} transparent opacity={0.45} />
        </lineSegments>
      </group>
      <mesh>
        <icosahedronGeometry args={[0.26, 3]} />
        <meshStandardMaterial ref={coreMat} color={COLOR.bone} emissive={COLOR.signal} emissiveIntensity={0.6} roughness={0.3} metalness={0.2} toneMapped={false} />
      </mesh>
      {RINGS.map((_, i) => (
        <Ring key={i} index={i} state={state} />
      ))}
    </group>
  );
}

export default function SecurityCanvas({
  state,
  tier,
  active,
  reduced,
  onReady,
}: {
  state: MutableRefObject<SecuritySceneState>;
  tier: TierConfig;
  active: boolean;
  reduced: boolean;
  onReady?: () => void;
}) {
  return (
    <Canvas
      onCreated={() => requestAnimationFrame(() => onReady?.())}
      dpr={tier.dpr}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0, 6.4], fov: 34 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      aria-hidden
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 3, 4]} intensity={20} color={COLOR.bone} />
      <Structure state={state} reduced={reduced} />
      {tier.bloom && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur luminanceThreshold={0.7} intensity={0.55} radius={0.6} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
