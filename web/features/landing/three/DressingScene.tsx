"use client";

import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { COLOR } from "@/lib/design/tokens";
import { damp } from "@/utils/math";
import type { TierConfig } from "@/hooks/use-device-tier";
import { roundedPlate, traceTube } from "./geometry";
import { fresnelFragment, fresnelVertex, riseFragment, riseVertex, traceFragment, traceVertex } from "./shaders";
import { NodeLabel } from "./NodeLabel";

export interface HeroSceneState {
  scroll: number;
  px: number;
  py: number;
}

const W = 3.2;
const D = 2.2;

/** Sensor layer layout, in the plate's local XZ plane. */
const NODES = {
  probe: new THREE.Vector3(-0.15, 0, -0.02),
  bme: new THREE.Vector3(-1.02, 0, 0.58),
  electrodes: new THREE.Vector3(-0.62, 0, -0.62),
  esp: new THREE.Vector3(1.02, 0, 0.36),
};

const TRACES: [number, number, number][][] = [
  [
    [-0.02, 0, -0.02],
    [0.3, 0, -0.02],
    [0.42, 0, 0.1],
    [0.62, 0, 0.18],
  ],
  [
    [-0.9, 0, 0.58],
    [-0.4, 0, 0.72],
    [0.3, 0, 0.72],
    [0.62, 0, 0.5],
  ],
  [
    [-0.08, 0, -0.62],
    [0.5, 0, -0.62],
    [0.85, 0, -0.35],
    [0.9, 0, 0.06],
  ],
  [
    [1.42, 0, 0.36],
    [1.42, 0, -0.5],
    [1.3, 0, -0.78],
  ],
];

function useTraceMaterial(offset: number, color: string) {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: traceVertex,
        fragmentShader: traceFragment,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uTime: { value: 0 },
          uOffset: { value: offset },
          uSpeed: { value: 0.32 },
          uBase: { value: 0.22 },
          uReach: { value: 1 },
          uColor: { value: new THREE.Color(color) },
        },
      }),
    [offset, color],
  );
}

function SensorLayer({ reduced }: { reduced: boolean }) {
  const plate = useMemo(() => roundedPlate(W - 0.12, D - 0.12, 0.46, 0.028), []);
  const traces = useMemo(() => TRACES.map((pts) => traceTube(pts, 0.011)), []);
  const m0 = useTraceMaterial(0, COLOR.signal);
  const m1 = useTraceMaterial(0.35, COLOR.signal);
  const m2 = useTraceMaterial(0.62, COLOR.copper);
  const m3 = useTraceMaterial(0.8, COLOR.signal);
  const mats = [m0, m1, m2, m3];

  useFrame((_, dt) => {
    if (reduced) return;
    for (const m of mats) m.uniforms.uTime.value += dt;
  });

  return (
    <group>
      <mesh geometry={plate} castShadow receiveShadow>
        <meshStandardMaterial color="#14171a" roughness={0.55} metalness={0.2} />
      </mesh>
      <group position={[0, 0.034, 0]}>
        {traces.map((g, i) => (
          <mesh key={i} geometry={g} material={mats[i]} />
        ))}
        {/* DS18B20 probe: stainless capsule with a lead */}
        <group position={NODES.probe}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <capsuleGeometry args={[0.07, 0.34, 8, 20]} />
            <meshStandardMaterial color="#c9ccd1" metalness={1} roughness={0.22} />
          </mesh>
          <mesh position={[0, -0.02, 0]}>
            <circleGeometry args={[0.34, 48]} />
            <meshBasicMaterial color={COLOR.signal} transparent opacity={0.08} toneMapped={false} />
          </mesh>
        </group>
        {/* BME280 breakout */}
        <group position={NODES.bme}>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.035, 0.26]} />
            <meshStandardMaterial color="#26213a" roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0.02, 0.028, 0]}>
            <boxGeometry args={[0.08, 0.02, 0.08]} />
            <meshStandardMaterial color="#d9dbde" metalness={0.9} roughness={0.25} />
          </mesh>
        </group>
        {/* Copper-tape electrodes: two interleaved combs */}
        <group position={NODES.electrodes}>
          {[-0.18, -0.06, 0.06, 0.18].map((z, i) => (
            <mesh key={z} position={[i % 2 === 0 ? -0.05 : 0.05, 0, z]}>
              <boxGeometry args={[0.9, 0.012, 0.045]} />
              <meshStandardMaterial color={COLOR.copper} metalness={1} roughness={0.32} />
            </mesh>
          ))}
          <mesh position={[-0.52, 0, 0]}>
            <boxGeometry args={[0.05, 0.012, 0.42]} />
            <meshStandardMaterial color={COLOR.copper} metalness={1} roughness={0.32} />
          </mesh>
          <mesh position={[0.52, 0, 0]}>
            <boxGeometry args={[0.05, 0.012, 0.42]} />
            <meshStandardMaterial color={COLOR.copper} metalness={1} roughness={0.32} />
          </mesh>
        </group>
        {/* ESP32-WROOM-32 module with its RF shield and antenna trace */}
        <group position={NODES.esp}>
          <mesh castShadow>
            <boxGeometry args={[0.72, 0.04, 0.5]} />
            <meshStandardMaterial color="#101214" roughness={0.6} />
          </mesh>
          <mesh position={[-0.06, 0.04, 0]} castShadow>
            <boxGeometry args={[0.5, 0.04, 0.42]} />
            <meshStandardMaterial color="#b9bdc3" metalness={1} roughness={0.28} />
          </mesh>
          <mesh position={[0.3, 0.024, 0]}>
            <boxGeometry args={[0.08, 0.008, 0.36]} />
            <meshBasicMaterial color={COLOR.signal} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function RisingParticles({ count, reduced }: { count: number; reduced: boolean }) {
  const { gl } = useThree();
  const [geometry, material] = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 3);
    const origins = [NODES.probe, NODES.bme, NODES.electrodes, NODES.esp];
    for (let i = 0; i < count; i++) {
      const o = origins[i % origins.length];
      const spread = i % 5 === 0 ? 1.6 : 0.45;
      const a = (i * 2.399) % (Math.PI * 2);
      const r = Math.sqrt(((i * 0.618) % 1)) * spread;
      pos.set([o.x + Math.cos(a) * r, 0.05, o.z + Math.sin(a) * r], i * 3);
      seed.set([(i * 0.1377) % 1, 0.05 + ((i * 0.071) % 1) * 0.08, 0.4 + ((i * 0.53) % 1) * 0.9], i * 3);
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
        uSize: { value: 28 },
        uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
        uHeight: { value: 2.6 },
        uOpacity: { value: 0.55 },
        uColorA: { value: new THREE.Color(COLOR.bone) },
        uColorB: { value: new THREE.Color(COLOR.signal) },
      },
    });
    return [g, m];
  }, [count, gl]);

  useFrame((_, dt) => {
    if (!reduced) material.uniforms.uTime.value += dt;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

function Dressing({ state, tier, reduced }: { state: MutableRefObject<HeroSceneState>; tier: TierConfig; reduced: boolean }) {
  const root = useRef<THREE.Group>(null);
  const film = useRef<THREE.Group>(null);
  const pad = useRef<THREE.Group>(null);
  const sensor = useRef<THREE.Group>(null);
  const contact = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const wide = viewport.aspect > 1.25;

  const geo = useMemo(
    () => ({
      contact: roundedPlate(W, D, 0.52, 0.03),
      pad: roundedPlate(W - 1.1, D - 0.8, 0.34, 0.11, 0.04),
      film: roundedPlate(W + 0.1, D + 0.1, 0.56, 0.016, 0.006),
      halo: roundedPlate(W + 0.14, D + 0.14, 0.58, 0.03, 0.012),
    }),
    [],
  );

  const fresnel = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: fresnelVertex,
        fragmentShader: fresnelFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: { uColor: { value: new THREE.Color(COLOR.signalSoft) }, uPower: { value: 2.2 }, uIntensity: { value: 0.55 } },
      }),
    [],
  );

  const current = useRef({ explode: 0.3, ry: -0.5, rx: 0.62, x: 0, y: 0 });

  useFrame((frame, dt) => {
    const s = state.current;
    const c = current.current;
    const t = frame.clock.elapsedTime;
    const explode = 0.28 + Math.min(1, s.scroll * 1.6) * 0.9;
    const lambda = reduced ? 1000 : 3.2;
    c.explode = damp(c.explode, explode, lambda, dt);
    c.ry = damp(c.ry, -0.52 + s.scroll * 0.9 + s.px * 0.22 + (reduced ? 0 : Math.sin(t * 0.18) * 0.05), lambda, dt);
    c.rx = damp(c.rx, 0.6 - s.scroll * 0.18 + s.py * 0.1, lambda, dt);
    if (root.current) {
      root.current.rotation.set(c.rx, c.ry, -0.08);
      root.current.position.x = wide ? 1.1 : 0;
      root.current.position.y = (wide ? 0.1 : -0.1) + (reduced ? 0 : Math.sin(t * 0.6) * 0.035) + s.scroll * 0.4;
    }
    const e = c.explode;
    contact.current?.position.set(0, -0.36 * e, 0);
    sensor.current?.position.set(0, 0.06, 0);
    pad.current?.position.set(0, 0.12 + 0.42 * e, 0);
    film.current?.position.set(0, 0.26 + 0.82 * e, 0);
    fresnel.uniforms.uIntensity.value = 0.35 + e * 0.25;
  });

  return (
    <group ref={root} scale={wide ? 0.9 : 0.8}>
      <group ref={contact}>
        <mesh geometry={geo.contact} receiveShadow>
          <meshPhysicalMaterial color="#8fd6c3" roughness={0.35} metalness={0} transparent opacity={0.28} clearcoat={0.4} />
        </mesh>
      </group>
      <group ref={sensor}>
        <SensorLayer reduced={reduced} />
        <NodeLabel position={[NODES.probe.x, 0.3, NODES.probe.z]} metric="temp" />
        <NodeLabel position={[NODES.bme.x, 0.22, NODES.bme.z]} metric="humidity" />
        <NodeLabel position={[NODES.electrodes.x, 0.18, NODES.electrodes.z]} metric="moisture" />
        <NodeLabel position={[NODES.esp.x, 0.24, NODES.esp.z]} metric="link" />
      </group>
      <group ref={pad}>
        <mesh geometry={geo.pad} castShadow receiveShadow>
          <meshStandardMaterial color="#bdb7ad" roughness={1} metalness={0} />
        </mesh>
      </group>
      <group ref={film}>
        <mesh geometry={geo.film}>
          <meshPhysicalMaterial
            color="#e8f1ee"
            roughness={0.08}
            metalness={0}
            transparent
            opacity={tier.transmission ? 0.14 : 0.1}
            clearcoat={1}
            clearcoatRoughness={0.05}
            envMapIntensity={1.4}
            depthWrite={false}
          />
        </mesh>
        <mesh geometry={geo.halo} material={fresnel} position={[0, -0.007, 0]} />
      </group>
    </group>
  );
}

function CameraRig({ state, reduced }: { state: MutableRefObject<HeroSceneState>; reduced: boolean }) {
  const target = useMemo(() => new THREE.Vector3(0, 0.1, 0), []);
  useFrame(({ camera }, dt) => {
    const s = state.current;
    const lambda = reduced ? 1000 : 2.4;
    camera.position.x = damp(camera.position.x, s.px * 0.35, lambda, dt);
    camera.position.y = damp(camera.position.y, 2.1 - s.py * 0.2 - s.scroll * 0.3, lambda, dt);
    camera.lookAt(target);
  });
  return null;
}

export default function DressingCanvas({
  state,
  tier,
  active,
  reduced,
  onReady,
}: {
  state: MutableRefObject<HeroSceneState>;
  tier: TierConfig;
  active: boolean;
  reduced: boolean;
  onReady?: () => void;
}) {
  const particles = Math.round(420 * tier.particles);
  return (
    <Canvas
      onCreated={() => requestAnimationFrame(() => onReady?.())}
      dpr={tier.dpr}
      frameloop={active ? (reduced ? "demand" : "always") : "never"}
      camera={{ position: [0, 2.1, 6.6], fov: 32, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      shadows={tier.shadows}
      aria-hidden
    >
      <CameraRig state={state} reduced={reduced} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 5, 2]} intensity={1.25} castShadow={tier.shadows} shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-3, 1.5, -2]} intensity={6} color={COLOR.signal} distance={8} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 2]} scale={[6, 2, 1]} rotation={[-Math.PI / 2.4, 0, 0]} />
        <Lightformer form="rect" intensity={0.8} color={COLOR.signal} position={[-4, 1, -1]} scale={[3, 3, 1]} rotation={[0, Math.PI / 2, 0]} />
        <Lightformer form="ring" intensity={1.2} position={[3, 2, -3]} scale={2} />
      </Environment>
      <Dressing state={state} tier={tier} reduced={reduced} />
      {particles > 0 && <RisingParticles count={particles} reduced={reduced} />}
      <ContactShadows position={[0, -1.25, 0]} opacity={0.5} scale={9} blur={2.8} far={3} resolution={256} frames={reduced ? 1 : Infinity} color="#000000" />
      {tier.bloom && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur luminanceThreshold={0.82} luminanceSmoothing={0.2} intensity={0.55} radius={0.6} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
