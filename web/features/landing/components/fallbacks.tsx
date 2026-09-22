/* Static SVG compositions that match each 3D scene. */

const iso = (x: number, y: number, z: number) => {
  const a = Math.PI / 6;
  return [(x - z) * Math.cos(a), (x + z) * Math.sin(a) - y] as const;
};

function IsoPlate({ w, d, y, className }: { w: number; d: number; y: number; className: string }) {
  const pts = [
    iso(-w / 2, y, -d / 2),
    iso(w / 2, y, -d / 2),
    iso(w / 2, y, d / 2),
    iso(-w / 2, y, d / 2),
  ];
  return <polygon points={pts.map((p) => p.join(",")).join(" ")} className={className} />;
}

export function DressingFallback() {
  return (
    <svg viewBox="-3.2 -3 6.4 5" className="size-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <g transform="translate(0.6 0.2)" strokeWidth="0.012" vectorEffect="non-scaling-stroke">
        <IsoPlate w={3.2} d={2.2} y={-0.6} className="fill-signal/10 stroke-signal/40" />
        <IsoPlate w={3.1} d={2.1} y={0} className="fill-graphite-850 stroke-graphite-500" />
        <IsoPlate w={2.3} d={1.5} y={0.55} className="fill-bone/80 stroke-bone" />
        <IsoPlate w={3.3} d={2.3} y={1.15} className="fill-white/[0.03] stroke-signal-soft/50" />
        <circle cx={iso(-0.15, 0.02, 0)[0]} cy={iso(-0.15, 0.02, 0)[1]} r="0.06" className="fill-signal" />
        <circle cx={iso(1.02, 0.02, 0.36)[0]} cy={iso(1.02, 0.02, 0.36)[1]} r="0.05" className="fill-signal" />
      </g>
    </svg>
  );
}

export function StationsFallback() {
  const stations = [
    [60, 260],
    [230, 180],
    [400, 220],
    [570, 140],
    [740, 190],
  ];
  return (
    <svg viewBox="0 0 800 400" className="size-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <path d={`M${stations.map((s) => s.join(",")).join(" L")}`} fill="none" className="stroke-signal/40" strokeWidth="1" strokeDasharray="4 6" />
      {stations.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="22" className="fill-graphite-900 stroke-graphite-500" />
          <circle cx={x} cy={y} r="4" className="fill-signal" />
        </g>
      ))}
    </svg>
  );
}

export function StackFallback() {
  return (
    <svg viewBox="-2.6 -3.2 5.2 5" className="size-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <IsoPlate key={i} w={2.6} d={2.6} y={i * 0.42 - 1} className={i === 5 ? "fill-signal/15 stroke-signal/60" : "fill-graphite-850/80 stroke-graphite-500"} />
      ))}
    </svg>
  );
}

export function ShieldFallback() {
  return (
    <svg viewBox="-100 -100 200 200" className="size-full" aria-hidden>
      <circle r="80" fill="none" className="stroke-graphite-600" strokeWidth="0.6" />
      <ellipse rx="92" ry="28" fill="none" className="stroke-signal/40" strokeWidth="0.6" transform="rotate(-18)" />
      <ellipse rx="92" ry="28" fill="none" className="stroke-graphite-500" strokeWidth="0.6" transform="rotate(52)" />
      <polygon points="0,-52 45,-26 45,26 0,52 -45,26 -45,-26" fill="none" className="stroke-graphite-400" strokeWidth="0.6" />
      <circle r="14" className="fill-bone/90" />
    </svg>
  );
}
