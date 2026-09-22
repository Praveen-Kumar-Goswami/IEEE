"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Edges, Environment, Lightformer, PresentationControls } from "@react-three/drei";
import { COLOR } from "@/lib/design/tokens";
import { clamp, damp } from "@/utils/math";
import type { TierConfig } from "@/hooks/use-device-tier";
import { roundedPlate } from "./geometry";
import { riseFragment, riseVertex } from "./shaders";

export interface TechSceneState {
  /** 0 = scattered, 1 = assembled. Driven by scroll. */
  assembly: number;
  /** Index of the expanded layer, or -1. */
  selected: number;
}

export const LAYER_COUNT = 6;
const GAP = 0.34;
const SPREAD = 0.62;
const SIZE = 2.2;

/** Deterministic detail pattern per layer: small blocks that read as chips, rows, nodes. */
function detailFor(layer: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const s = SIZE * 0.36;
  switch (layer) {
    case 0: // hardware: sensor chips
      out.push([-s, 0, -s * 0.4, 0.34], [s * 0.3, 0, s * 0.5, 0.22], [s * 0.8, 0, -s * 0.6, 0.18], [-s * 0.2, 0, s * 0.9, 0.14]);
      break;
    case 1: // connectivity: gateway nodes in a ring
      for (let i = 0; i < 8; i++) out.push([Math.cos((i / 8) * Math.PI * 2) * s, 0, Math.sin((i / 8) * Math.PI * 2) * s, 0.08]);
      break;
    case 2: // data: rows
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) out.push([(c - 2.5) * s * 0.34, 0, (r - 1.5) * s * 0.42, 0.07]);
      break;
    case 3: // cloud: three services
      out.push([-s * 0.7, 0, 0, 0.3], [0, 0, 0, 0.3], [s * 0.7, 0, 0, 0.3]);
      break;
    case 4: // analytics: rising bars
      for (let i = 0; i < 7; i++) out.push([(i - 3) * s * 0.26, 0, 0, 0.07 + i * 0.012]);
      break;
    default: // interface: three workspaces
      out.push([-s * 0.75, 0, -s * 0.1, 0.4], [0, 0, s * 0.2, 0.4], [s * 0.75, 0, -s * 0.1, 0.4]);
  }
  return out;
}

function Layer({ index, state }: { index: number; state: MutableRefObject<TechSceneState> }) {
  const group = useRef<THREE.Group>(null);
  const edge = useRef<THREE.LineBasicMaterial>(null);
  const plateMat = useRef<THREE.MeshStandardMaterial>(null);
  const plate = useMemo(() => roundedPlate(SIZE, SIZE, 0.18, 0.05, 0.012), []);
  const details = useMemo(() => detailFor(index), [index]);
  const bone = useMemo(() => new THREE.Color(COLOR.graphite500), []);
  const signal = useMemo(() => new THREE.Color(COLOR.signal), []);
  const scatter = useMemo(() => ({ x: Math.sin(index * 2.1) * 1.6, z: Math.cos(index * 1.7) * 1.2, r: (index % 2 ? 1 : -1) * 0.6 }), [index]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const { assembly, selected } = state.current;
    const a = clamp(assembly, 0, 1);
    const open = selected >= 0;
    const isSel = selected === index;
    const spacing = open ? SPREAD : GAP;
    let y = (index - (LAYER_COUNT - 1) / 2) * spacing;
    if (isSel) y += 0.22;
    const scattered = 1 - a;
    const ty = y + scattered * (index - 2.5) * 0.9;
    g.position.y = damp(g.position.y, ty, 5, dt);
    g.position.x = damp(g.position.x, scattered * scatter.x + (isSel ? 0.25 : 0), 5, dt);
    g.position.z = damp(g.position.z, scattered * scatter.z, 5, dt);
    g.rotation.y = damp(g.rotation.y, scattered * scatter.r, 5, dt);
    if (edge.current) {
      edge.current.color.lerp(isSel ? signal : bone, 1 - Math.exp(-6 * dt));
      edge.current.opacity = damp(edge.current.opacity, open && !isSel ? 0.35 : 1, 6, dt);
    }
    if (plateMat.current) plateMat.current.opacity = damp(plateMat.current.opacity, open && !isSel ? 0.35 : 0.92, 6, dt);
  });

  return (
    <group ref={group}>
      <mesh geometry={plate} castShadow receiveShadow>
        <meshStandardMaterial ref={plateMat} color={index === LAYER_COUNT - 1 ? "#2b3136" : COLOR.graphite850} roughness={0.55} metalness={0.3} transparent opacity={0.92} />
        <Edges threshold={20}>
          <lineBasicMaterial ref={edge} color={COLOR.graphite500} transparent />
        </Edges>
      </mesh>
      {details.map(([x, , z, s], i) => (
        <mesh key={i} position={[x, 0.05 + s / 2, z]} castShadow>
          {index === 1 ? <cylinderGeometry args={[s, s, 0.04, 20]} /> : <boxGeometry args={[index === 4 ? 0.1 : s * 1.6, index === 4 ? s * 3 : 0.05, index === 2 ? 0.12 : s * 1.2]} />}
          <meshStandardMaterial color={index === 0 ? COLOR.copper : COLOR.graphite600} roughness={0.5} metalness={index === 0 ? 0.7 : 0.2} />
        </mesh>
      ))}
    </group>
  );
}

function Core({ count }: { count: number }) {
  const { gl } = useThree();
  const [geo, mat] = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996;
      const r = 0.05 + ((i * 0.618) % 1) * 0.12;
      pos.set([Math.cos(a) * r, -1.4, Math.sin(a) * r], i * 3);
      seed.set([(i * 0.7548) % 1, 0.08 + ((i * 0.5698) % 1) * 0.1, 0.6 + ((i * 0.3183) % 1) * 0.6], i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: riseVertex,
      fragmentShader: riseFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 26 },
        uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
        uHeight: { value: 3.4 },
        uColorA: { value: new THREE.Color(COLOR.signal) },
        uColorB: { value: new THREE.Color(COLOR.bone) },
        uOpacity: { value: 0.9 },
      },
    });
    return [g, m];
  }, [count, gl]);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return (
    <>
      <points geometry={geo} material={mat} frustumCulled={false} />
      <mesh>
        <cylinderGeometry args={[0.006, 0.006, 3.6, 6]} />
        <meshBasicMaterial color={COLOR.signal} transparent opacity={0.5} toneMapped={false} />
      </mesh>
    </>
  );
}

function Rig({ state, reduced }: { state: MutableRefObject<TechSceneState>; reduced: boolean }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!spin.current || reduced) return;
    const target = state.current.selected >= 0 ? spin.current.rotation.y : spin.current.rotation.y + dt * 0.08;
    spin.current.rotation.y = target;
  });
  return (
    <group ref={spin}>
      {Array.from({ length: LAYER_COUNT }, (_, i) => (
        <Layer key={i} index={i} state={state} />
      ))}
    </group>
  );
}

export default function TechCanvas({
  state,
  tier,
  active,
  reduced,
  onReady,
}: {
  state: MutableRefObject<TechSceneState>;
  tier: TierConfig;
  active: boolean;
  reduced: boolean;
  onReady?: () => void;
}) {
  return (
    <Canvas
      onCreated={({ camera }) => {
        camera.lookAt(0, 0, 0);
        requestAnimationFrame(() => onReady?.());
      }}
      dpr={tier.dpr}
      shadows={tier.shadows}
      frameloop={active ? "always" : "never"}
      camera={{ position: [5.2, 3.6, 5.2], fov: 32, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      aria-hidden
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 7, 3]} intensity={1.2} castShadow={tier.shadows} shadow-mapSize={[1024, 1024]} />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={1.6} position={[0, 5, 2]} scale={[8, 2, 1]} rotation={[-Math.PI / 2.4, 0, 0]} />
        <Lightformer form="ring" intensity={0.6} color={COLOR.signal} position={[-4, 1, -2]} scale={2} />
      </Environment>
      <PresentationControls global={false} cursor={false} snap polar={[-0.2, 0.2]} azimuth={[-0.7, 0.7]} speed={1.2} enabled={!reduced}>
        <group position={[0, 0.1, 0]}>
          <Rig state={state} reduced={reduced} />
          <Core count={Math.max(60, Math.round(260 * tier.particles))} />
        </group>
      </PresentationControls>
      {tier.shadows && <ContactShadows position={[0, -1.9, 0]} opacity={0.5} scale={8} blur={2.6} far={3} />}
    </Canvas>
  );
}