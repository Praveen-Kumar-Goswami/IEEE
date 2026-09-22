"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { COLOR } from "@/lib/design/tokens";
import { clamp, damp } from "@/utils/math";
import type { TierConfig } from "@/hooks/use-device-tier";
import { curveTexture } from "./geometry";
import { flowFragment, flowVertex, traceFragment, traceVertex } from "./shaders";

export interface SystemSceneState {
  progress: number;
}

export const STATIONS = [
  new THREE.Vector3(-5.2, -0.2, 0.4),
  new THREE.Vector3(-2.6, 0.5, -0.6),
  new THREE.Vector3(0, 0, 0.2),
  new THREE.Vector3(2.6, 0.55, -0.5),
  new THREE.Vector3(5.2, 0.1, 0.1),
];

const PATH = new THREE.CatmullRomCurve3(
  [
    STATIONS[0],
    new THREE.Vector3(-3.9, 0.55, 0.2),
    STATIONS[1],
    new THREE.Vector3(-1.3, 0.05, -0.5),
    STATIONS[2],
    new THREE.Vector3(1.3, 0.55, 0.1),
    STATIONS[3],
    new THREE.Vector3(3.9, 0.1, -0.4),
    STATIONS[4],
  ],
  false,
  "centripetal",
);

/** Path parameter of each station, so flow can stop exactly at the active one. */
const STATION_T = STATIONS.map((s) => {
  let best = 0;
  let dist = Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i <= 400; i++) {
    PATH.getPointAt(i / 400, v);
    const d = v.distanceTo(s);
    if (d < dist) {
      dist = d;
      best = i / 400;
    }
  }
  return best;
});

/** Continuous "how far has data travelled" for a scroll progress in [0, 1]. */
function reachFor(progress: number) {
  const f = clamp(progress, 0, 1) * (STATIONS.length - 1);
  const i = Math.floor(f);
  if (i >= STATIONS.length - 1) return 1;
  const local = f - i;
  const eased = clamp((local - 0.15) / 0.7, 0, 1);
  return STATION_T[i] + (STATION_T[i + 1] - STATION_T[i]) * eased;
}

function Station({ index, state, children }: { index: number; state: MutableRefObject<SystemSceneState>; children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    const f = state.current.progress * (STATIONS.length - 1);
    const reached = f >= index - 0.35;
    const focus = 1 - clamp(Math.abs(f - index), 0, 1);
    if (group.current) {
      const s = damp(group.current.scale.x, reached ? 1 + focus * 0.12 : 0.86, 4, dt);
      group.current.scale.setScalar(s);
    }
    if (halo.current) {
      const m = halo.current.material as THREE.MeshBasicMaterial;
      m.opacity = damp(m.opacity, reached ? 0.08 + focus * 0.22 : 0.02, 4, dt);
    }
  });
  return (
    <group position={STATIONS[index]}>
      <group ref={group}>{children}</group>
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]}>
        <ringGeometry args={[0.7, 0.72, 64]} />
        <meshBasicMaterial color={COLOR.signal} transparent opacity={0.02} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Stations({ state }: { state: MutableRefObject<SystemSceneState> }) {
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshStandardMaterial>(null);
  const core = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const screens = useRef<THREE.Group>(null);
  const watch = useMemo(() => new THREE.Color(COLOR.watch), []);
  const signal = useMemo(() => new THREE.Color(COLOR.signal), []);

  useFrame((frame, dt) => {
    const t = frame.clock.elapsedTime;
    const f = state.current.progress * (STATIONS.length - 1);
    if (shell.current) shell.current.rotation.y = t * 0.25;
    if (core.current) core.current.rotation.x = t * 0.4;
    if (ring.current) ring.current.rotation.z = t * 0.2;
    if (ringMat.current) {
      const flagged = clamp((f - 1.7) / 0.5, 0, 1);
      ringMat.current.emissive.copy(signal).lerp(watch, flagged);
      ringMat.current.emissiveIntensity = damp(ringMat.current.emissiveIntensity, 0.4 + flagged * 1.4, 4, dt);
    }
    if (screens.current) {
      const alerted = clamp((f - 2.6) / 0.4, 0, 1);
      screens.current.children.forEach((c, i) => {
        const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (m && "opacity" in m && i < 2) m.opacity = 0.25 + alerted * 0.75 * (0.85 + Math.sin(t * 3 + i) * 0.15);
      });
    }
  });

  return (
    <>
      {/* 01 dressing */}
      <Station index={0} state={state}>
        <RoundedBox args={[1.1, 0.07, 0.78]} radius={0.03} smoothness={4}>
          <meshStandardMaterial color="#bdb7ad" roughness={1} />
        </RoundedBox>
        <mesh position={[0, 0.06, 0]}>
          <sphereGeometry args={[0.06, 24, 24]} />
          <meshBasicMaterial color={COLOR.signal} toneMapped={false} />
        </mesh>
      </Station>
      {/* 02 processing: phone gateway feeding a lattice */}
      <Station index={1} state={state}>
        <mesh ref={shell}>
          <icosahedronGeometry args={[0.55, 1]} />
          <meshBasicMaterial color={COLOR.graphite300} wireframe transparent opacity={0.35} />
        </mesh>
        <mesh ref={core}>
          <octahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial color={COLOR.bone} metalness={0.6} roughness={0.25} />
        </mesh>
      </Station>
      {/* 03 threshold ring */}
      <Station index={2} state={state}>
        <mesh ref={ring} rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[0.55, 0.035, 16, 96]} />
          <meshStandardMaterial ref={ringMat} color="#1c1f23" emissive={COLOR.signal} emissiveIntensity={0.4} metalness={0.4} roughness={0.3} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[0.8, 0.006, 8, 96]} />
          <meshBasicMaterial color={COLOR.graphite400} transparent opacity={0.5} />
        </mesh>
      </Station>
      {/* 04 care team: nurse and doctor devices */}
      <Station index={3} state={state}>
        <group ref={screens}>
          <mesh position={[-0.28, 0.05, 0]} rotation={[0, 0.25, 0]}>
            <planeGeometry args={[0.42, 0.72]} />
            <meshBasicMaterial color={COLOR.watch} transparent opacity={0.25} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0.32, 0.12, -0.1]} rotation={[0, -0.2, 0]}>
            <planeGeometry args={[0.62, 0.42]} />
            <meshBasicMaterial color={COLOR.signal} transparent opacity={0.25} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[-0.28, 0.05, -0.01]} rotation={[0, 0.25, 0]}>
            <planeGeometry args={[0.46, 0.76]} />
            <meshStandardMaterial color="#0f1113" metalness={0.5} roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0.32, 0.12, -0.11]} rotation={[0, -0.2, 0]}>
            <planeGeometry args={[0.66, 0.46]} />
            <meshStandardMaterial color="#0f1113" metalness={0.5} roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </Station>
      {/* 05 record: the clinical workspace screen the next section expands out of */}
      <Station index={4} state={state}>
        {[0, 1, 2].map((i) => (
          <RoundedBox key={i} args={[1.3, 0.025, 0.9]} radius={0.01} position={[0, -0.28 + i * 0.12, 0]}>
            <meshStandardMaterial color={i === 2 ? COLOR.bone : "#2a2e34"} roughness={0.6} metalness={0.2} />
          </RoundedBox>
        ))}
        <mesh position={[0, 0.55, -0.3]}>
          <planeGeometry args={[1.6, 0.95]} />
          <meshBasicMaterial color={COLOR.signal} transparent opacity={0.12} toneMapped={false} />
        </mesh>
      </Station>
    </>
  );
}

function Flow({ state, count }: { state: MutableRefObject<SystemSceneState>; count: number }) {
  const { gl } = useThree();
  const tube = useMemo(() => new THREE.TubeGeometry(PATH, 400, 0.012, 6, false), []);
  const tubeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: traceVertex,
        fragmentShader: traceFragment,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uTime: { value: 0 },
          uOffset: { value: 0 },
          uSpeed: { value: 0.18 },
          uBase: { value: 0.3 },
          uReach: { value: 0 },
          uColor: { value: new THREE.Color(COLOR.signal) },
        },
      }),
    [],
  );
  const ghost = useMemo(() => new THREE.MeshBasicMaterial({ color: COLOR.graphite600, transparent: true, opacity: 0.35 }), []);

  const [points, pointsMat] = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const progress = new Float32Array(count);
    const speed = new Float32Array(count);
    const offset = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      progress[i] = (i * 0.61803) % 1;
      speed[i] = 0.035 + ((i * 0.3137) % 1) * 0.05;
      const a = i * 2.39996;
      const r = 0.02 + ((i * 0.7071) % 1) * 0.1;
      offset.set([Math.cos(a) * r, Math.sin(a) * r, Math.sin(a * 0.5) * r], i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aProgress", new THREE.BufferAttribute(progress, 1));
    g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    g.setAttribute("aOffset", new THREE.BufferAttribute(offset, 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: flowVertex,
      fragmentShader: flowFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uReach: { value: 0 },
        uSize: { value: 22 },
        uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
        uPath: { value: curveTexture(PATH) },
        uColor: { value: new THREE.Color(COLOR.signalSoft) },
      },
    });
    return [g, m];
  }, [count, gl]);

  const reach = useRef(0);
  useFrame((_, dt) => {
    reach.current = damp(reach.current, reachFor(state.current.progress), 5, dt);
    tubeMat.uniforms.uTime.value += dt;
    tubeMat.uniforms.uReach.value = reach.current;
    pointsMat.uniforms.uTime.value += dt;
    pointsMat.uniforms.uReach.value = Math.max(0.001, reach.current);
  });

  return (
    <>
      <mesh geometry={tube} material={ghost} />
      <mesh geometry={tube} material={tubeMat} />
      <points geometry={points} material={pointsMat} frustumCulled={false} />
    </>
  );
}

function CameraRail({ state, reduced }: { state: MutableRefObject<SystemSceneState>; reduced: boolean }) {
  const { size } = useThree();
  const look = useRef(new THREE.Vector3());
  const pos = useRef(new THREE.Vector3(-6, 2.4, 7));
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const narrow = size.width < 768;

  useFrame(({ camera }, dt) => {
    const p = clamp(state.current.progress, 0, 1);
    const f = p * (STATIONS.length - 1);
    const i = Math.min(STATIONS.length - 2, Math.floor(f));
    const local = f - i;
    tmp.copy(STATIONS[i]).lerp(STATIONS[i + 1], local * local * (3 - 2 * local));
    const end = clamp((p - 0.86) / 0.14, 0, 1);
    const distance = (narrow ? 7.4 : 5.6) - end * 2.2;
    const targetPos = new THREE.Vector3(tmp.x - (narrow ? 0 : 1.1) * (1 - end), tmp.y + 1.5 - end * 0.9, tmp.z + distance);
    const lambda = reduced ? 1000 : 3;
    pos.current.set(damp(pos.current.x, targetPos.x, lambda, dt), damp(pos.current.y, targetPos.y, lambda, dt), damp(pos.current.z, targetPos.z, lambda, dt));
    look.current.set(damp(look.current.x, tmp.x, lambda, dt), damp(look.current.y, tmp.y + end * 0.45, lambda, dt), damp(look.current.z, tmp.z, lambda, dt));
    camera.position.copy(pos.current);
    camera.lookAt(look.current);
  });
  return null;
}

export default function SystemCanvas({
  state,
  tier,
  active,
  reduced,
  onReady,
}: {
  state: MutableRefObject<SystemSceneState>;
  tier: TierConfig;
  active: boolean;
  reduced: boolean;
  onReady?: () => void;
}) {
  const count = Math.max(200, Math.round(1200 * tier.particles));
  return (
    <Canvas
      onCreated={() => requestAnimationFrame(() => onReady?.())}
      dpr={tier.dpr}
      frameloop={active ? "always" : "never"}
      camera={{ position: [-6, 2.4, 7], fov: 36, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      aria-hidden
    >
      <CameraRail state={state} reduced={reduced} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 6, 4]} intensity={1.1} />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={1.8} position={[0, 5, 3]} scale={[10, 2, 1]} rotation={[-Math.PI / 2.5, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} color={COLOR.signal} position={[-6, 1, 0]} scale={[3, 3, 1]} rotation={[0, Math.PI / 2, 0]} />
      </Environment>
      <gridHelper args={[40, 40, COLOR.graphite700, COLOR.graphite800]} position={[0, -0.9, 0]} />
      <Stations state={state} />
      <Flow state={state} count={count} />
      {tier.bloom && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur luminanceThreshold={0.8} intensity={0.6} radius={0.55} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
